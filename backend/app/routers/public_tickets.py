"""
Router Public Tickets — endpoints públicos para abertura de chamados sem autenticação JWT.

Captura automaticamente IP, hostname (via reverse DNS) e User-Agent do solicitante
para auditoria anti-fraude (alguém abrindo chamado em nome de outra pessoa).
"""
import os
import uuid
import concurrent.futures
import socket
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.ticket import Ticket, TicketStatus, TicketPriority
from app.models.asset import Asset
from app.models.location import Location
from app.models.category import Category, Subcategory
from app.models.problem_type import ProblemType
from app.models.ticket_attachment import TicketAttachment
from app.schemas.ticket import CategoryWithSubs, SubcategoryResponse, ProblemTypeResponse, TicketAttachmentResponse
from app.services.evolution_service import EvolutionService

router = APIRouter(prefix="/api/v1/public", tags=["Public Helpdesk"])


# --- Schemas ---

class UserLookupResponse(BaseModel):
    id: int
    ad_username: str | None = None
    display_name: str
    department_name: str | None = None
    manager_name: str | None = None
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
    requester_name: str
    department_name: str | None = None
    manager_name: str | None = None
    created_at: datetime


class ClientInfoResponse(BaseModel):
    ip: str
    hostname: str | None = None
    asset_id: int | None = None
    user_agent: str | None = None


class PublicLocationResponse(BaseModel):
    id: int
    name: str
    building: str | None = None
    floor: str | None = None


class PublicRoomResponse(BaseModel):
    id: int
    name: str
    number: str
    floor: str | None = None


# --- Helpers ---

def _resolve_client_info_and_asset(
    request: Request,
    user: User | None = None,
    db: Session | None = None,
    timeout_sec: float = 0.8,
) -> tuple[dict, int | None]:
    """
    Identifica de forma profunda e resiliente o IP, Hostname e Equipamento (Asset)
    do solicitante a partir do request HTTP e da base de inventário CMDB / Sentinel Agent:

    1. Extração do IP real (X-Forwarded-For, X-Real-IP ou request.client.host).
    2. Busca no CMDB do TIHFSA pelo IP (tabela assets.ip_address):
       - As estações corporativas com o Sentinel Agent reportam seu IP de rede e nome de computador (ex: HFSA000080D).
       - Como redes locais DHCP frequentemente não possuem zona reversa PTR no DNS, essa é a fonte
         mais precisa e imediata para resolver o hostname de qualquer máquina da rede.
    3. Busca no CMDB pelo Colaborador (assets.assigned_user_id == user.id):
       - Caso o IP seja novo/DHCP e ainda não atualizado no ativo, identifica a máquina
         nominalmente atribuída ao colaborador.
    4. Busca no CMDB pelo último usuário logado (assets.specs['logged_user']):
       - Verifica se o ad_username do solicitante é o usuário ativo registrado pelo Sentinel Agent.
    5. DNS Reverso do Sistema Operacional (socket.gethostbyaddr):
       - Executado em thread separada com timeout para faixas que possuam PTR configurado.
    """
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

    hostname = None
    detected_asset_id = None
    is_valid_lan_ip = bool(client_ip and client_ip not in ("unknown", "127.0.0.1", "localhost", "::1"))

    # 1. Busca por IP no CMDB (Mais preciso para a rede do hotel)
    if is_valid_lan_ip and db:
        try:
            asset_by_ip = (
                db.query(Asset)
                .filter(
                    or_(
                        Asset.ip_address == client_ip,
                        Asset.ip_address.ilike(f"%{client_ip}%"),
                    ),
                    Asset.is_active == True,  # noqa: E712
                )
                .first()
            )
            if asset_by_ip:
                hostname = asset_by_ip.name
                detected_asset_id = asset_by_ip.id
        except Exception as e:
            print(f"[ClientInfo] Erro ao buscar asset por IP: {e}")

    # 2. Busca por Colaborador no CMDB (Equipamento atribuído)
    if not hostname and user and db:
        try:
            asset_by_user = (
                db.query(Asset)
                .filter(
                    Asset.assigned_user_id == user.id,
                    Asset.is_active == True,  # noqa: E712
                )
                .first()
            )
            if asset_by_user:
                hostname = asset_by_user.name
                detected_asset_id = asset_by_user.id
        except Exception as e:
            print(f"[ClientInfo] Erro ao buscar asset por user: {e}")

    # 3. Busca por Usuário Logado nas specs do Sentinel Agent
    if not hostname and user and user.ad_username and db:
        try:
            ad_clean = user.ad_username.lower().replace("fasanobr\\", "").strip()
            assets_with_specs = (
                db.query(Asset)
                .filter(Asset.specs.isnot(None), Asset.is_active == True)  # noqa: E712
                .all()
            )
            for a in assets_with_specs:
                if a.specs and isinstance(a.specs, dict):
                    logged = str(a.specs.get("logged_user", "")).lower()
                    if ad_clean and ad_clean in logged:
                        hostname = a.name
                        detected_asset_id = a.id
                        break
        except Exception as e:
            print(f"[ClientInfo] Erro ao buscar asset por logged_user: {e}")

    # 4. Fallback: Tentativa de DNS reverso via socket padrão
    if not hostname and is_valid_lan_ip:
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(socket.gethostbyaddr, client_ip)
                resolved = future.result(timeout=timeout_sec)[0]
                if resolved:
                    hostname = resolved.split(".")[0] if "." in resolved else resolved
        except Exception:
            pass

    user_agent = request.headers.get("User-Agent", "unknown")

    return {
        "ip": client_ip,
        "hostname": hostname,
        "user_agent": user_agent,
    }, detected_asset_id


def _get_manager_name(u: User) -> str | None:
    """Obtém o nome do gestor direto ou chefe do departamento do usuário."""
    if u.manager:
        return u.manager.display_name
    if u.department:
        if u.department.dept_manager:
            return u.department.dept_manager.display_name
        if u.department.managers:
            return u.department.managers[0].display_name
    return None


# --- Endpoints ---

@router.get("/lookup-user", response_model=list[UserLookupResponse])
def lookup_user_by_username(
    username: str,
    db: Session = Depends(get_db),
):
    """
    Busca colaboradores pelo login de rede (ad_username), nome completo ou e-mail.
    Retorna lista com nome completo, setor e chefe do setor para confirmação de visibilidade.
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
                User.email.ilike(f"%{term}%"),
            ),
            User.is_active == True,  # noqa: E712
            User.is_room == False,  # Apenas colaboradores com setor
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
            department_name=u.department.name if u.department else "Sem Setor",
            manager_name=_get_manager_name(u),
            email=u.email,
        )
        for u in users
    ]


@router.get("/categories", response_model=list[CategoryWithSubs])
def list_public_categories(db: Session = Depends(get_db)):
    """Lista categorias públicas ativas com subcategorias — endpoint público sem JWT."""
    categories = (
        db.query(Category)
        .filter(Category.is_active == True, Category.is_public == True)  # noqa: E712
        .order_by(Category.name)
        .all()
    )
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
            is_public=cat.is_public,
            subcategories=subs,
            problem_types=cat_pts,
        ))
    return result


@router.get("/locations", response_model=list[PublicLocationResponse])
def list_public_locations(db: Session = Depends(get_db)):
    """Lista locais físicos ativos e públicos (Lobby, Gero, Bar da Piscina, etc.)."""
    locs = (
        db.query(Location)
        .filter(Location.is_active == True, Location.is_public == True)  # noqa: E712
        .order_by(Location.name.asc())
        .all()
    )
    return [
        PublicLocationResponse(
            id=l.id,
            name=l.name,
            building=l.building,
            floor=l.floor,
        )
        for l in locs
    ]


@router.get("/rooms", response_model=list[PublicRoomResponse])
def list_public_rooms(db: Session = Depends(get_db)):
    """Lista UHs / Apartamentos ativos do hotel ordenados numericamente."""
    import re
    rooms = (
        db.query(User)
        .filter(User.is_room == True, User.is_active == True)  # noqa: E712
        .all()
    )

    def _sort_key(u: User):
        nums = re.findall(r"\d+", u.display_name)
        return int(nums[0]) if nums else 9999

    sorted_rooms = sorted(rooms, key=_sort_key)
    res = []
    for r in sorted_rooms:
        nums = re.findall(r"\d+", r.display_name)
        num_str = nums[0] if nums else r.display_name
        floor_label = f"{num_str[0]}º Andar" if len(num_str) == 3 and num_str[0] in "123456789" else None
        res.append(
            PublicRoomResponse(
                id=r.id,
                name=f"UH {num_str}",
                number=num_str,
                floor=floor_label,
            )
        )
    return res


@router.get("/client-info", response_model=ClientInfoResponse)
def get_public_client_info(
    request: Request,
    user_id: int | None = None,
    db: Session = Depends(get_db),
):
    """Retorna IP, Hostname detectado e Equipamento do solicitante para pré-visualização."""
    user = db.query(User).filter(User.id == user_id).first() if user_id else None
    client_info, detected_asset_id = _resolve_client_info_and_asset(request, user=user, db=db)
    return ClientInfoResponse(
        ip=client_info["ip"],
        hostname=client_info["hostname"],
        asset_id=detected_asset_id,
        user_agent=client_info["user_agent"],
    )


@router.post("/tickets", response_model=PublicTicketResponse, status_code=status.HTTP_201_CREATED)
def create_public_ticket(
    data: PublicTicketCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Abre chamado via formulário público (sem JWT).
    Obrigatório vincular a um solicitante ativo para garantir que ele e o chefe de setor visualizem.
    Captura IP, hostname e user-agent de forma transparente para auditoria anti-fraude.
    """
    # 1. Validar usuário solicitante obrigatório
    if not data.user_id and not data.username:
        raise HTTPException(
            status_code=400,
            detail="É obrigatório selecionar o colaborador solicitante para garantir a visualização no setor."
        )

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
        raise HTTPException(status_code=404, detail="Colaborador solicitante não encontrado ou inativo")

    # 2. Capturar informações do cliente para auditoria e identificar equipamento
    client_info, detected_asset_id = _resolve_client_info_and_asset(request, user=user, db=db)
    dept_name = user.department.name if user.department else "Sem Setor"
    mgr_name = _get_manager_name(user)

    # 3. Montar título com localização (se fornecida)
    final_title = f"[{data.location}] {data.title}" if data.location else data.title

    # 4. Montar descrição com metadados de auditoria
    hostname_label = client_info["hostname"] or "Não detectado"
    audit_block = (
        f"\n\n---\n"
        f"📋 Origem: Formulário Público\n"
        f"👤 Solicitante: {user.display_name} (Setor: {dept_name})\n"
        f"👔 Chefe/Gestor do Setor: {mgr_name or 'Não cadastrado'}\n"
        f"🖥️ IP de Origem: {client_info['ip']}\n"
        f"🏷️ Hostname da Máquina: {hostname_label}\n"
        f"🌐 User-Agent: {client_info['user_agent']}\n"
        f"📅 Data/Hora de Abertura: {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M:%S UTC')}"
    )
    final_description = (data.description or "") + audit_block

    # 5. Criar o ticket vinculado ao solicitante real (requester_id) e ao ativo identificado
    ticket = Ticket(
        title=final_title,
        description=final_description,
        priority=TicketPriority(data.priority) if data.priority else TicketPriority.MEDIUM,
        requester_id=user.id,
        asset_id=detected_asset_id,
        category_id=data.category_id,
        subcategory_id=data.subcategory_id,
        problem_type_id=data.problem_type_id,
        status=TicketStatus.NEW,
    )

    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    # 6. Notificação WhatsApp no grupo de TI
    asset_str = f" ({hostname_label})" if hostname_label != "Não detectado" else ""
    msg_text = (
        f"🎫 *[Novo Chamado - Formulário Público]*\n\n"
        f"*Ticket ID:* #{ticket.id}\n"
        f"*Solicitante:* {user.display_name} ({dept_name})\n"
        f"*Chefe do Setor:* {mgr_name or 'N/A'}\n"
        f"*Local / UH:* {data.location or 'Não informado'}\n"
        f"*Título:* {ticket.title}\n"
        f"*Prioridade:* {ticket.priority.value}\n\n"
        f"*Descrição:* {data.description or 'Sem descrição'}\n\n"
        f"🌐 *Auditoria Anti-Fraude:*\n"
        f"• IP: {client_info['ip']}\n"
        f"• Hostname: {hostname_label}{asset_str}"
    )
    background_tasks.add_task(EvolutionService.send_whatsapp_message, msg_text)

    return PublicTicketResponse(
        id=ticket.id,
        title=ticket.title,
        status=ticket.status.value,
        requester_name=user.display_name,
        department_name=dept_name,
        manager_name=mgr_name,
        created_at=ticket.created_at,
    )


@router.post("/tickets/{ticket_id}/attachments", response_model=TicketAttachmentResponse, status_code=status.HTTP_201_CREATED)
async def upload_public_attachment(
    ticket_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload público de evidência / foto para um chamado recém-aberto via formulário público.
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")

    ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Formato não suportado. Use JPG, PNG, WEBP ou PDF.")

    ticket_upload_dir = os.path.join("uploads", "tickets", str(ticket_id))
    os.makedirs(ticket_upload_dir, exist_ok=True)

    ext = os.path.splitext(file.filename)[1] if file.filename else ""
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(ticket_upload_dir, unique_filename)

    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao salvar arquivo: {e}")

    web_path = f"/uploads/tickets/{ticket_id}/{unique_filename}"
    attachment = TicketAttachment(
        ticket_id=ticket.id,
        file_name=file.filename or "Evidência",
        file_path=web_path,
        content_type=file.content_type,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return attachment
