"""
Router Public Tickets — endpoints públicos para abertura de chamados sem autenticação JWT.

Captura automaticamente IP, hostname (via reverse DNS) e User-Agent do solicitante
para auditoria anti-fraude (alguém abrindo chamado em nome de outra pessoa).
"""
import concurrent.futures
import socket
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, status
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.ticket import Ticket, TicketStatus, TicketPriority
from app.models.category import Category, Subcategory
from app.models.problem_type import ProblemType
from app.schemas.ticket import CategoryWithSubs, SubcategoryResponse, ProblemTypeResponse
from app.services.evolution_service import EvolutionService

router = APIRouter(prefix="/api/v1/public", tags=["Public Helpdesk"])


# --- Schemas ---

class UserLookupResponse(BaseModel):
    id: int
    ad_username: str | None = None
    display_name: str
    department_name: str | None = None
    email: str | None = None


class PublicTicketCreate(BaseModel):
    user_id: int | None = None
    username: str | None = None
    title: str
    description: str | None = None
    priority: str = "Média"
    category_id: int | None = None
    subcategory_id: int | None = None
    problem_type_id: int | None = None
    location: str | None = None


class PublicTicketResponse(BaseModel):
    id: int
    title: str
    status: str
    created_at: datetime


class ClientInfoResponse(BaseModel):
    ip: str
    hostname: str | None = None
    user_agent: str | None = None


# --- Helpers ---

def _resolve_hostname(ip: str, timeout_sec: float = 0.8) -> str | None:
    """Tenta resolver o Hostname reverso da máquina com timeout rápido para não bloquear a requisição."""
    if not ip or ip in ("unknown", "127.0.0.1", "localhost", "::1"):
        return None
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(socket.gethostbyaddr, ip)
            return future.result(timeout=timeout_sec)[0]
    except Exception:
        return None


def _get_client_info(request: Request) -> dict:
    """Extrai IP, hostname e user-agent do request HTTP de forma transparente."""
    forwarded = request.headers.get("X-Forwarded-For")
    real_ip = request.headers.get("X-Real-IP")

    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    elif real_ip:
        client_ip = real_ip.strip()
    elif request.client:
        client_ip = request.client.host
    else:
        client_ip = "unknown"

    hostname = _resolve_hostname(client_ip)
    user_agent = request.headers.get("User-Agent", "unknown")

    return {
        "ip": client_ip,
        "hostname": hostname,
        "user_agent": user_agent,
    }


# --- Endpoints ---

@router.get("/lookup-user", response_model=list[UserLookupResponse])
def lookup_user_by_username(
    username: str,
    db: Session = Depends(get_db),
):
    """
    Busca usuários pelo ad_username (login de rede) ou nome completo.
    Retorna lista com nome completo e setor para confirmação.
    """
    if not username or len(username.strip()) < 2:
        raise HTTPException(status_code=400, detail="Digite pelo menos 2 caracteres")

    term = username.strip()
    users = (
        db.query(User)
        .filter(
            or_(
                User.ad_username.ilike(f"%{term}%"),
                User.display_name.ilike(f"%{term}%"),
            ),
            User.is_active == True,  # noqa: E712
            User.is_room == False,  # noqa: E712
        )
        .order_by(User.display_name)
        .limit(10)
        .all()
    )

    return [
        UserLookupResponse(
            id=u.id,
            ad_username=u.ad_username,
            display_name=u.display_name,
            department_name=u.department.name if u.department else None,
            email=u.email,
        )
        for u in users
    ]


@router.get("/categories", response_model=list[CategoryWithSubs])
def list_public_categories(db: Session = Depends(get_db)):
    """Lista categorias ativas com subcategorias — endpoint público sem JWT."""
    categories = db.query(Category).filter(Category.is_active == True).order_by(Category.name).all()  # noqa: E712
    result = []
    for cat in categories:
        subs = []
        for s in cat.subcategories:
            if s.is_active:
                pts = [ProblemTypeResponse.model_validate(pt) for pt in s.problem_types if pt.is_active]
                sub_resp = SubcategoryResponse.model_validate(s)
                sub_resp.problem_types = pts
                subs.append(sub_resp)

        cat_pts = [ProblemTypeResponse.model_validate(pt) for pt in cat.problem_types if pt.is_active]
        result.append(CategoryWithSubs(
            id=cat.id,
            name=cat.name,
            description=cat.description,
            zabbix_group_id=cat.zabbix_group_id,
            zabbix_group_name=cat.zabbix_group_name,
            is_global=cat.is_global,
            subcategories=subs,
            problem_types=cat_pts,
        ))
    return result


@router.post("/tickets", response_model=PublicTicketResponse, status_code=status.HTTP_201_CREATED)
def create_public_ticket(
    data: PublicTicketCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Abre chamado via formulário público (sem JWT).
    Captura IP, hostname e user-agent de forma transparente para auditoria.
    """
    # 1. Validar usuário por ID ou username
    user = None
    if data.user_id:
        user = db.query(User).filter(User.id == data.user_id, User.is_active == True).first()
    elif data.username:
        user = (
            db.query(User)
            .filter(
                or_(
                    User.ad_username.ilike(data.username),
                    User.display_name.ilike(data.username),
                ),
                User.is_active == True,  # noqa: E712
            )
            .first()
        )

    if not user:
        raise HTTPException(status_code=404, detail="Usuário solicitante não encontrado")

    # 2. Capturar informações do cliente (transparente)
    client_info = _get_client_info(request)

    # 3. Montar título com localização (se fornecida)
    final_title = f"[{data.location}] {data.title}" if data.location else data.title

    # 4. Montar descrição com metadados de auditoria (transparente, no final da descrição)
    audit_block = (
        f"\n\n---\n"
        f"📋 Origem: Formulário Público\n"
        f"🖥️ IP: {client_info['ip']}\n"
        f"🏷️ Hostname: {client_info['hostname'] or 'N/A'}\n"
        f"🌐 User-Agent: {client_info['user_agent']}\n"
        f"📅 Data/Hora: {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M:%S UTC')}"
    )
    final_description = (data.description or "") + audit_block

    # 5. Criar o ticket
    ticket = Ticket(
        title=final_title,
        description=final_description,
        priority=TicketPriority(data.priority) if data.priority else TicketPriority.MEDIUM,
        requester_id=user.id,
        category_id=data.category_id,
        subcategory_id=data.subcategory_id,
        problem_type_id=data.problem_type_id,
        status=TicketStatus.NEW,
    )

    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    # 6. Notificação WhatsApp
    msg_text = (
        f"🎫 *[Novo Chamado - Formulário Público]*\n\n"
        f"*Solicitante:* {user.display_name}\n"
        f"*Título:* {ticket.title}\n"
        f"*Prioridade:* {ticket.priority.value}\n"
        f"*IP:* {client_info['ip']}\n"
        f"*Hostname:* {client_info['hostname'] or 'N/A'}\n\n"
        f"*Descrição:* {data.description or 'Sem descrição'}"
    )
    background_tasks.add_task(EvolutionService.send_whatsapp_message, msg_text)

    return PublicTicketResponse(
        id=ticket.id,
        title=ticket.title,
        status=ticket.status.value,
        created_at=ticket.created_at,
    )
