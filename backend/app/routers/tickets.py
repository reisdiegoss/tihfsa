"""
Router Tickets — Helpdesk completo com fluxo de validação.

Endpoints:
- POST   /tickets          → Abrir chamado
- GET    /tickets           → Listar chamados
- GET    /tickets/{id}      → Detalhe com interações
- PATCH  /tickets/{id}      → Atualizar
- PATCH  /tickets/{id}/solve → Técnico resolve (dispara validação)
- POST   /tickets/{id}/validate → Gestor aprova/rejeita
- POST   /tickets/{id}/interactions → Adicionar comentário
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import get_current_user, require_technician
from app.models.user import User, UserRole
from app.models.ticket import Ticket, TicketStatus, TicketPriority
from app.models.ticket_interaction import TicketInteraction
from app.models.asset import Asset
from app.models.category import Category, Subcategory
from app.schemas.ticket import (
    TicketCreate, TicketUpdate, TicketSolve, TicketValidate,
    TicketResponse, TicketDetail, InteractionCreate, InteractionResponse,
)
from app.services.ticket_service import TicketService

router = APIRouter(prefix="/api/v1/tickets", tags=["Helpdesk"])


@router.post("/", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(
    data: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Abre um novo chamado.
    - Técnico: pode abrir em nome de qualquer usuário/apto.
    - Usuário: abre para si mesmo.
    """
    ticket = Ticket(
        title=data.title,
        description=data.description,
        priority=TicketPriority(data.priority) if data.priority else TicketPriority.MEDIUM,
        requester_id=data.requester_id,
        technician_id=data.technician_id or current_user.id,
        asset_id=data.asset_id,
        category_id=data.category_id,
        subcategory_id=data.subcategory_id,
        problem_type_id=data.problem_type_id,
        status=TicketStatus.NEW,
    )

    # Se o técnico já está criando com solução, muda para IN_PROGRESS
    if data.technician_id:
        ticket.status = TicketStatus.IN_PROGRESS

    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("/", response_model=list[TicketResponse])
def list_tickets(
    status_filter: str | None = Query(None, alias="status"),
    technician_id: int | None = None,
    requester_id: int | None = None,
    category_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista chamados com filtros e visibilidade por papel."""
    from sqlalchemy.orm import joinedload
    from sqlalchemy import or_

    query = db.query(Ticket).options(
        joinedload(Ticket.requester),
        joinedload(Ticket.technician),
        joinedload(Ticket.category),
    )

    # Visibilidade por Papéis (Multi-Role)
    role_val = current_user.role.value if isinstance(current_user.role, UserRole) else str(current_user.role).lower()
    u_roles = current_user.roles if (current_user.roles and isinstance(current_user.roles, list)) else [role_val]
    u_roles_lower = [r.lower() for r in u_roles]

    is_admin = "admin" in u_roles_lower
    is_tech = "technician" in u_roles_lower or "tecnico" in u_roles_lower
    is_mgr = "manager" in u_roles_lower or "gerente" in u_roles_lower

    if is_admin or is_tech:
        pass  # Acesso completo a todos os chamados
    elif is_mgr:
        managed_dept_ids = [d.id for d in current_user.managed_departments] if current_user.managed_departments else []
        if current_user.department_id and current_user.department_id not in managed_dept_ids:
            managed_dept_ids.append(current_user.department_id)

        if managed_dept_ids:
            query = query.join(Ticket.requester).filter(
                or_(
                    Ticket.requester_id == current_user.id,
                    User.department_id.in_(managed_dept_ids)
                )
            )
        else:
            query = query.filter(Ticket.requester_id == current_user.id)
    else:
        query = query.filter(Ticket.requester_id == current_user.id)

    if status_filter and isinstance(status_filter, str) and status_filter.strip():
        target_status = None
        for s in TicketStatus:
            if s.value == status_filter or s.name == status_filter:
                target_status = s
                break
        if target_status:
            query = query.filter(Ticket.status == target_status)

    if technician_id:
        query = query.filter(Ticket.technician_id == technician_id)
    if requester_id:
        query = query.filter(Ticket.requester_id == requester_id)
    if category_id:
        query = query.filter(Ticket.category_id == category_id)

    tickets = query.order_by(Ticket.created_at.desc()).offset(offset).limit(limit).all()

    return [
        TicketResponse(
            id=t.id,
            title=t.title,
            description=t.description,
            status=t.status.value,
            priority=t.priority.value,
            requester_id=t.requester_id,
            technician_id=t.technician_id,
            asset_id=t.asset_id,
            category_id=t.category_id,
            subcategory_id=t.subcategory_id,
            created_at=t.created_at,
            updated_at=t.updated_at,
            solved_at=t.solved_at,
            closed_at=t.closed_at,
            requester_name=t.requester.display_name if t.requester else None,
            technician_name=t.technician.display_name if t.technician else None,
            category_name=t.category.name if t.category else None,
        )
        for t in tickets
    ]


@router.get("/stats")
def ticket_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """KPIs do dashboard: contagem por status."""
    total = db.query(Ticket).count()
    by_status = {}
    for s in TicketStatus:
        by_status[s.value] = db.query(Ticket).filter(Ticket.status == s).count()
    return {"total": total, "by_status": by_status}


@router.get("/{ticket_id}", response_model=TicketDetail)
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Detalhe do chamado com interações, anexos e nomes expandidos."""
    from app.models.ticket_attachment import TicketAttachment
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")

    # Expandir nomes
    requester = db.query(User).filter(User.id == ticket.requester_id).first()
    technician = db.query(User).filter(User.id == ticket.technician_id).first() if ticket.technician_id else None
    asset = db.query(Asset).filter(Asset.id == ticket.asset_id).first() if ticket.asset_id else None
    category = db.query(Category).filter(Category.id == ticket.category_id).first() if ticket.category_id else None
    subcategory = db.query(Subcategory).filter(Subcategory.id == ticket.subcategory_id).first() if ticket.subcategory_id else None

    interactions = (
        db.query(TicketInteraction)
        .filter(TicketInteraction.ticket_id == ticket_id)
        .order_by(TicketInteraction.created_at)
        .all()
    )
    
    attachments = (
        db.query(TicketAttachment)
        .filter(TicketAttachment.ticket_id == ticket_id)
        .order_by(TicketAttachment.created_at)
        .all()
    )

    from app.schemas.ticket import TicketAttachmentResponse, InteractionResponse

    interaction_responses = []
    for i in interactions:
        u_name = i.user.display_name if i.user else f"Usuário #{i.user_id}"
        u_role = i.user.role.value if (i.user and hasattr(i.user.role, "value")) else str(i.user.role if i.user else "user")
        i_attachments = [a for a in attachments if a.interaction_id == i.id]

        interaction_responses.append(
            InteractionResponse(
                id=i.id,
                message=i.message,
                is_solution=i.is_solution,
                user_id=i.user_id,
                user_name=u_name,
                user_role=u_role,
                attachments=[TicketAttachmentResponse.model_validate(a) for a in i_attachments],
                created_at=i.created_at,
            )
        )

    return TicketDetail(
        id=ticket.id,
        title=ticket.title,
        description=ticket.description,
        status=ticket.status.value,
        priority=ticket.priority.value,
        requester_id=ticket.requester_id,
        technician_id=ticket.technician_id,
        asset_id=ticket.asset_id,
        category_id=ticket.category_id,
        subcategory_id=ticket.subcategory_id,
        problem_type_id=ticket.problem_type_id,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        solved_at=ticket.solved_at,
        closed_at=ticket.closed_at,
        requester_name=requester.display_name if requester else None,
        technician_name=technician.display_name if technician else None,
        asset_name=asset.name if asset else None,
        category_name=category.name if category else None,
        subcategory_name=subcategory.name if subcategory else None,
        interactions=interaction_responses,
        attachments=[TicketAttachmentResponse.model_validate(a) for a in attachments],
    )


@router.patch("/{ticket_id}", response_model=TicketResponse)
def update_ticket(
    ticket_id: int,
    data: TicketUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Atualiza dados de um chamado (técnico)."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data:
        update_data["status"] = TicketStatus(update_data["status"])
    if "priority" in update_data:
        update_data["priority"] = TicketPriority(update_data["priority"])
    for field, value in update_data.items():
        setattr(ticket, field, value)

    db.commit()
    db.refresh(ticket)
    return ticket


@router.patch("/{ticket_id}/solve", response_model=TicketResponse)
def solve_ticket(
    ticket_id: int,
    data: TicketSolve,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
):
    """
    Técnico marca chamado como resolvido.
    Dispara validação para o gestor do solicitante.
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")

    if ticket.status == TicketStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Chamado já está fechado")

    return TicketService.solve_ticket(db, ticket, current_user, data.solution_message)


@router.post("/{ticket_id}/validate", response_model=TicketResponse)
def validate_ticket(
    ticket_id: int,
    data: TicketValidate,
    db: Session = Depends(get_db),
):
    """
    Gestor valida a solução via magic link (não requer autenticação JWT).
    O token no body contém a identidade do gestor.
    """
    if not data.token:
        raise HTTPException(status_code=400, detail="Token de validação é obrigatório")

    try:
        return TicketService.validate_ticket(
            db, ticket_id, data.token, data.action, data.rejection_reason
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{ticket_id}/interactions", response_model=InteractionResponse, status_code=status.HTTP_201_CREATED)
def add_interaction(
    ticket_id: int,
    data: InteractionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Adiciona um comentário/interação ao chamado."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")

    interaction = TicketInteraction(
        ticket_id=ticket_id,
        user_id=current_user.id,
        message=data.message,
        is_solution=data.is_solution,
    )
    db.add(interaction)
    db.commit()
    db.refresh(interaction)

    u_name = current_user.display_name
    u_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)

    return InteractionResponse(
        id=interaction.id,
        message=interaction.message,
        is_solution=interaction.is_solution,
        user_id=interaction.user_id,
        user_name=u_name,
        user_role=u_role,
        created_at=interaction.created_at,
    )
