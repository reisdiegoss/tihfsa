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
from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import get_current_user, require_technician
from app.models.user import User, UserRole
from app.models.ticket import Ticket, TicketStatus, TicketPriority
from app.models.ticket_interaction import TicketInteraction
from app.models.asset import Asset
from app.models.category import Category, Subcategory
from datetime import datetime, timezone
from app.schemas.ticket import (
    TicketCreate, TicketUpdate, TicketSolve, TicketValidate, TicketBatchStatusUpdate,
    TicketResponse, TicketDetail, InteractionCreate, InteractionResponse,
)
from app.services.ticket_service import TicketService
from app.services.evolution_service import EvolutionService
from app.config import get_app_base_url

router = APIRouter(prefix="/api/v1/tickets", tags=["Helpdesk"])


def dispatch_csat_survey(ticket: Ticket, db: Session, background_tasks: BackgroundTasks):
    """Gera token CSAT e agenda o envio do e-mail de satisfação com estrelas ao solicitante."""
    try:
        from app.models.system_setting import SystemSetting
        from app.models.satisfaction_survey import TicketSatisfactionSurvey
        from app.services.email_service import send_ticket_solved_csat_notification
        import uuid

        setting = db.query(SystemSetting).first()
        csat_enabled = setting.csat_enabled if setting else True
        notify_on_solve = setting.notify_requester_on_solve if setting else True
        if not (csat_enabled and notify_on_solve):
            return

        req_user = db.query(User).filter(User.id == ticket.requester_id).first()
        if not req_user or not req_user.email:
            return

        tech_user = db.query(User).filter(User.id == ticket.technician_id).first() if ticket.technician_id else None
        tech_name = tech_user.display_name if tech_user else "Equipe de TI"

        survey = db.query(TicketSatisfactionSurvey).filter(TicketSatisfactionSurvey.ticket_id == ticket.id).first()
        if not survey:
            survey = TicketSatisfactionSurvey(
                ticket_id=ticket.id,
                token=uuid.uuid4().hex,
            )
            db.add(survey)
            db.commit()
            db.refresh(survey)

        warranty_days = setting.ticket_warranty_days if setting else 7
        solution_txt = ticket.closure_reason or "Problema atendido e finalizado com sucesso pela equipe de suporte técnico."

        background_tasks.add_task(
            send_ticket_solved_csat_notification,
            ticket=ticket,
            requester_name=req_user.display_name,
            requester_email=req_user.email,
            technician_name=tech_name,
            solution=solution_txt,
            csat_token=survey.token,
            warranty_days=warranty_days,
        )
    except Exception as e:
        print(f"[WARN] Falha ao disparar pesquisa CSAT: {e}")


@router.post("/", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(
    data: TicketCreate,
    background_tasks: BackgroundTasks,
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
    
    # Notificação Evolution API para o Grupo da TI
    base_url = get_app_base_url()
    icon = "🚨" if "NOC Auto-Alerta" in ticket.title else "🎫"
    msg_type = "ATENÇÃO: ATIVO OFFLINE" if "NOC Auto-Alerta" in ticket.title else "Novo Chamado Aberto"
    msg_text = (
        f"{icon} *[{msg_type}]*\n\n"
        f"*Ticket ID:* #{ticket.id}\n"
        f"*Título:* {ticket.title}\n"
        f"*Prioridade:* {ticket.priority.value}\n"
        f"*Status:* {ticket.status.value}\n\n"
        f"*Descrição:* {ticket.description}\n\n"
        f"🔗 *Acessar chamado:* {base_url}/admin/tickets?ticketId={ticket.id}"
    )
    background_tasks.add_task(EvolutionService.send_whatsapp_message, msg_text, ticket_id=ticket.id)

    # Notificações ao Solicitante e à Equipe de TI
    try:
        from app.models.system_setting import SystemSetting
        from app.services.email_service import (
            send_ticket_created_notification,
            send_ticket_created_staff_notification,
        )
        setting = db.query(SystemSetting).first()
        notify_req = setting.notify_requester_on_create if setting else True
        notify_ti = getattr(setting, "notify_ti_on_create", True) if setting else True

        req_user = db.query(User).filter(User.id == ticket.requester_id).first()
        req_name = req_user.display_name if req_user else "Solicitante"
        req_dept = req_user.department.name if (req_user and req_user.department) else "Geral"

        # 1. E-mail de confirmação ao Solicitante
        if notify_req and req_user and req_user.email:
            background_tasks.add_task(
                send_ticket_created_notification,
                ticket=ticket,
                requester_name=req_name,
                requester_email=req_user.email,
            )

        # 2. WhatsApp ao Solicitante (se tiver telefone)
        if req_user and req_user.phone:
            user_wa = (
                f"🎫 *[TIHFSA] Chamado #{ticket.id} Registrado!*\n\n"
                f"Olá, *{req_name}*!\n"
                f"Seu chamado foi registrado com sucesso em nosso sistema de TI.\n"
                f"*Título:* {ticket.title}\n"
                f"*Prioridade:* {ticket.priority.value}\n\n"
                f"Nossa equipe técnica já foi notificada e em breve dará início ao atendimento.\n\n"
                f"🔗 *Acompanhar chamado:* {base_url}/app?ticketId={ticket.id}"
            )
            background_tasks.add_task(
                EvolutionService.send_whatsapp_message,
                user_wa,
                recipient=req_user.phone,
                ticket_id=ticket.id,
                recipient_name=req_name,
            )

        # 3. E-mail à Equipe de TI / Suporte (support_notification_email)
        if notify_ti:
            asset_label = ticket.asset.name if ticket.asset else ""
            background_tasks.add_task(
                send_ticket_created_staff_notification,
                ticket=ticket,
                requester_name=req_name,
                requester_dept=req_dept,
                origin="Painel / Sistema Interno",
                location_or_asset=asset_label,
            )
    except Exception as e:
        print(f"[WARN] Falha ao agendar notificações de abertura de chamado: {e}")
    
    return ticket



@router.get("/notifications")
def get_notifications(
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna a lista de notificações ativas/recentes e contadores para a central do Header:
    - Chamados com alertas de infraestrutura NOC (UniFi / Zabbix)
    - Chamados Críticos e Altos em aberto
    - Chamados Aguardando Validação
    - Chamados Novos aguardando atendimento
    """
    from sqlalchemy.orm import joinedload

    role_val = current_user.role.value if isinstance(current_user.role, UserRole) else str(current_user.role).lower()
    u_roles = current_user.roles if (current_user.roles and isinstance(current_user.roles, list)) else [role_val]
    u_roles_lower = [r.lower() for r in u_roles]

    is_admin = "admin" in u_roles_lower
    is_tech = "technician" in u_roles_lower or "tecnico" in u_roles_lower

    query = db.query(Ticket).options(
        joinedload(Ticket.requester),
        joinedload(Ticket.asset),
    )

    if not (is_admin or is_tech):
        query = query.filter(Ticket.requester_id == current_user.id)

    recent_tickets = query.order_by(
        Ticket.status.in_([TicketStatus.NEW, TicketStatus.IN_PROGRESS, TicketStatus.PENDING_VALIDATION]).desc(),
        Ticket.created_at.desc()
    ).limit(limit).all()

    items = []
    critical_count = 0
    active_count = 0
    pending_validation_count = 0

    for t in recent_tickets:
        is_noc = bool(
            (t.title and any(k in t.title for k in ["[NOC", "NOC Auto", "ALERTA NOC", "[Zabbix]"]))
            or (t.description and "Alerta Automático NOC" in t.description)
        )
        is_critical = (t.priority == TicketPriority.CRITICAL)
        is_active = t.status in [TicketStatus.NEW, TicketStatus.IN_PROGRESS, TicketStatus.PENDING_VALIDATION]
        
        if is_active:
            active_count += 1
            if is_critical or is_noc:
                critical_count += 1
            if t.status == TicketStatus.PENDING_VALIDATION:
                pending_validation_count += 1

        if is_noc and is_critical:
            cat = "noc_critical"
        elif is_noc:
            cat = "noc_alert"
        elif t.status == TicketStatus.PENDING_VALIDATION:
            cat = "pending_validation"
        elif t.status == TicketStatus.NEW:
            cat = "new_ticket"
        elif t.status == TicketStatus.CLOSED:
            cat = "closed"
        else:
            cat = "in_progress"

        desc_clean = (t.description or "").replace("#", "").replace("*", "").strip()
        lines = [line.strip() for line in desc_clean.splitlines() if line.strip()]
        summary = lines[0] if lines else ""
        if len(summary) > 120:
            summary = summary[:117] + "..."

        items.append({
            "id": t.id,
            "title": t.title,
            "summary": summary,
            "status": t.status.value if hasattr(t.status, "value") else str(t.status),
            "priority": t.priority.value if hasattr(t.priority, "value") else str(t.priority),
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "updated_at": t.updated_at.isoformat() if t.updated_at else None,
            "requester_name": t.requester.display_name if t.requester else "Sistema",
            "asset_name": t.asset.name if t.asset else None,
            "is_noc": is_noc,
            "is_active": is_active,
            "category": cat,
        })

    return {
        "active_count": active_count,
        "critical_count": critical_count,
        "pending_validation_count": pending_validation_count,
        "items": items,
    }


@router.get("/", response_model=list[TicketResponse])

def list_tickets(
    status_filter: str | None = Query(None, alias="status"),
    technician_id: int | None = None,
    requester_id: int | None = None,
    category_id: int | None = None,
    priority: str | None = None,
    search: str | None = None,
    order_by: str = "created_at",
    order_dir: str = "desc",
    limit: int = Query(500, ge=1, le=2000),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista chamados com filtros, ordenação e visibilidade por papel."""
    from sqlalchemy.orm import joinedload
    from sqlalchemy import or_, cast, String

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

    if priority and isinstance(priority, str) and priority.strip():
        target_prio = None
        for p in TicketPriority:
            if p.value.lower() == priority.lower() or p.name.lower() == priority.lower():
                target_prio = p
                break
        if target_prio:
            query = query.filter(Ticket.priority == target_prio)

    if technician_id:
        query = query.filter(Ticket.technician_id == technician_id)
    if requester_id:
        query = query.filter(Ticket.requester_id == requester_id)
    if category_id:
        query = query.filter(Ticket.category_id == category_id)

    if search and isinstance(search, str) and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Ticket.title.ilike(term),
                Ticket.description.ilike(term),
                cast(Ticket.id, String).ilike(term),
            )
        )

    # Ordenação flexível
    sort_column = Ticket.created_at
    if order_by == "id":
        sort_column = Ticket.id
    elif order_by == "title":
        sort_column = Ticket.title
    elif order_by == "priority":
        sort_column = Ticket.priority
    elif order_by == "status":
        sort_column = Ticket.status

    if order_dir.lower() == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    tickets = query.offset(offset).limit(limit).all()

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
        .order_by(TicketInteraction.created_at.desc())
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

    from datetime import timedelta
    from app.models.system_setting import SystemSetting
    from app.models.satisfaction_survey import TicketSatisfactionSurvey

    setting = db.query(SystemSetting).first()
    warranty_days = setting.ticket_warranty_days if (setting and setting.ticket_warranty_days) else 7

    can_reopen = False
    warranty_expires_at = None
    if ticket.status == TicketStatus.CLOSED and ticket.closed_at:
        warranty_expires_at = ticket.closed_at + timedelta(days=warranty_days)
        if datetime.now(timezone.utc) <= warranty_expires_at:
            can_reopen = True

    survey = db.query(TicketSatisfactionSurvey).filter(TicketSatisfactionSurvey.ticket_id == ticket_id).first()
    satisfaction_rating = survey.rating if survey else None

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
        closure_reason=ticket.closure_reason,
        reopened_at=ticket.reopened_at,
        reopen_count=ticket.reopen_count or 0,
        can_reopen=can_reopen,
        warranty_expires_at=warranty_expires_at,
        satisfaction_rating=satisfaction_rating,
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
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
):
    """Atualiza dados de um chamado (técnico ou admin)."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")

    update_data = data.model_dump(exclude_unset=True)
    new_status = None
    if "status" in update_data:
        for s in TicketStatus:
            if s.value == update_data["status"] or s.name == update_data["status"]:
                new_status = s
                break
        if not new_status:
            raise HTTPException(status_code=400, detail=f"Status '{update_data['status']}' inválido")
        update_data["status"] = new_status

    if "priority" in update_data:
        for p in TicketPriority:
            if p.value == update_data["priority"] or p.name == update_data["priority"]:
                update_data["priority"] = p
                break

    # Se for alteração de status para Fechado
    if new_status == TicketStatus.CLOSED:
        closure_reason = (update_data.get("closure_reason") or "").strip()
        if not closure_reason:
            raise HTTPException(status_code=400, detail="O motivo do fechamento é obrigatório ao encerrar o chamado.")
        now = datetime.now(timezone.utc)
        ticket.closed_at = now
        ticket.closure_reason = closure_reason
        update_data["closed_at"] = now
        update_data["closure_reason"] = closure_reason

        # Registrar interação de fechamento na linha do tempo
        close_msg = f"🔒 [Chamado Fechado] Chamado encerrado por {current_user.display_name}.\nMotivo: {closure_reason}"
        db.add(TicketInteraction(
            ticket_id=ticket.id,
            user_id=current_user.id,
            message=close_msg,
            is_solution=False,
        ))
    elif new_status and new_status != TicketStatus.CLOSED and ticket.status == TicketStatus.CLOSED:
        # Se estava fechado e está sendo reaberto
        ticket.closed_at = None
        ticket.closure_reason = None
        update_data["closed_at"] = None
        update_data["closure_reason"] = None

    for field, value in update_data.items():
        setattr(ticket, field, value)

    db.commit()
    db.refresh(ticket)
    
    if new_status:
        from app.models.system_setting import SystemSetting
        from app.services.email_service import (
            send_ticket_closed_staff_notification,
            send_ticket_status_changed_notification,
        )
        setting = db.query(SystemSetting).first()
        notify_ti_close = getattr(setting, "notify_ti_on_close", True) if setting else True
        notify_req_update = getattr(setting, "notify_requester_on_update", True) if setting else True
        req_user = db.query(User).filter(User.id == ticket.requester_id).first()
        req_name = req_user.display_name if req_user else "Solicitante"

        base_url = get_app_base_url()
        if new_status == TicketStatus.CLOSED:
            reason = ticket.closure_reason or "Não informado"
            msg_text = (
                f"🔒 *[Chamado Fechado]*\n\n"
                f"*Ticket ID:* #{ticket.id}\n"
                f"*Título:* {ticket.title}\n"
                f"*Responsável:* {current_user.display_name}\n"
                f"*Motivo do Fechamento:* {reason}\n\n"
                f"🔗 *Ver chamado:* {base_url}/admin/tickets?ticketId={ticket.id}"
            )
            background_tasks.add_task(EvolutionService.send_whatsapp_message, msg_text, ticket_id=ticket.id)
            
            # Pesquisa CSAT ao solicitante
            dispatch_csat_survey(ticket, db, background_tasks)

            # Notificação por E-mail à Equipe de TI
            if notify_ti_close:
                background_tasks.add_task(
                    send_ticket_closed_staff_notification,
                    ticket=ticket,
                    closed_by_name=current_user.display_name,
                    solution_or_reason=reason,
                    requester_name=req_name,
                )

            # WhatsApp de encerramento ao solicitante se tiver telefone
            if req_user and req_user.phone:
                wa_close = (
                    f"🔒 *[TIHFSA] Chamado #{ticket.id} Encerrado!*\n\n"
                    f"Olá, *{req_name}*!\n"
                    f"Seu chamado *'{ticket.title}'* foi finalizado pela equipe de TI.\n"
                    f"*Responsável:* {current_user.display_name}\n"
                    f"*Motivo / Resolução:* {reason}\n\n"
                    f"Enviamos a pesquisa de avaliação para o seu e-mail corporativo.\n\n"
                    f"🔗 *Ver no portal:* {base_url}/app?ticketId={ticket.id}"
                )
                background_tasks.add_task(
                    EvolutionService.send_whatsapp_message,
                    wa_close,
                    recipient=req_user.phone,
                    ticket_id=ticket.id,
                    recipient_name=req_name,
                )
        else:
            msg_text = (
                f"🔄 *[Chamado Atualizado]*\n\n"
                f"*Ticket ID:* #{ticket.id}\n"
                f"*Título:* {ticket.title}\n"
                f"*Novo Status:* {ticket.status.value}\n"
                f"*Responsável:* {current_user.display_name}\n\n"
                f"🔗 *Acessar chamado:* {base_url}/admin/tickets?ticketId={ticket.id}"
            )
            background_tasks.add_task(EvolutionService.send_whatsapp_message, msg_text, ticket_id=ticket.id)

            # Notificação ao Solicitante da alteração de status
            if notify_req_update and req_user:
                if req_user.email:
                    background_tasks.add_task(
                        send_ticket_status_changed_notification,
                        ticket=ticket,
                        new_status=ticket.status.value,
                        changed_by_name=current_user.display_name,
                        requester_name=req_name,
                        requester_email=req_user.email,
                    )
                if req_user.phone:
                    wa_status = (
                        f"🔄 *[TIHFSA] Atualização do Chamado #{ticket.id}*\n\n"
                        f"Olá, *{req_name}*!\n"
                        f"O status do seu chamado *'{ticket.title}'* mudou para: *{ticket.status.value}* por {current_user.display_name}.\n\n"
                        f"🔗 *Acompanhar chamado:* {base_url}/app?ticketId={ticket.id}"
                    )
                    background_tasks.add_task(
                        EvolutionService.send_whatsapp_message,
                        wa_status,
                        recipient=req_user.phone,
                        ticket_id=ticket.id,
                        recipient_name=req_name,
                    )

    # Notificação ao Solicitante se técnico foi designado
    if "technician_id" in update_data and update_data["technician_id"]:
        try:
            from app.models.system_setting import SystemSetting
            from app.services.email_service import send_ticket_assigned_notification
            setting = db.query(SystemSetting).first()
            if not setting or setting.notify_requester_on_assign:
                req_user = db.query(User).filter(User.id == ticket.requester_id).first()
                tech_user = db.query(User).filter(User.id == update_data["technician_id"]).first()
                if req_user and req_user.email and tech_user:
                    background_tasks.add_task(
                        send_ticket_assigned_notification,
                        ticket=ticket,
                        requester_name=req_user.display_name,
                        requester_email=req_user.email,
                        technician_name=tech_user.display_name,
                    )
        except Exception as e:
            print(f"[WARN] Falha ao agendar e-mail de técnico designado: {e}")
        
    return ticket



@router.post("/batch-status")
def batch_update_status(
    data: TicketBatchStatusUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
):
    """
    Atualiza o status de múltiplos chamados em lote.
    Garante registro detalhado de auditoria (TicketInteraction) em cada chamado,
    indicando quem fez a alteração, data/hora e justificativa.
    Se o status for 'Fechado', o motivo do fechamento é obrigatório e inserido em massa em todos os chamados.
    Permissão: Apenas administradores e técnicos (require_technician).
    """
    if not data.ticket_ids:
        raise HTTPException(status_code=400, detail="Nenhum chamado informado para atualização")

    target_status = None
    for s in TicketStatus:
        if s.value == data.status or s.name == data.status:
            target_status = s
            break
    if not target_status:
        raise HTTPException(status_code=400, detail=f"Status '{data.status}' inválido")

    # Validação obrigatória de motivo se for Fechamento em Massa
    closure_reason = (data.closure_reason or data.comment or "").strip()
    if target_status == TicketStatus.CLOSED and not closure_reason:
        raise HTTPException(
            status_code=400,
            detail="O motivo do fechamento é obrigatório ao encerrar chamados em massa."
        )

    now = datetime.now(timezone.utc)
    updated_tickets = []

    for t_id in data.ticket_ids:
        ticket = db.query(Ticket).filter(Ticket.id == t_id).first()
        if not ticket:
            continue

        old_status_label = ticket.status.value
        ticket.status = target_status
        ticket.updated_at = now

        if target_status == TicketStatus.CLOSED:
            ticket.closed_at = now
            ticket.closure_reason = closure_reason
            audit_msg = f"🔒 [Fechamento em Massa] Chamado encerrado por {current_user.display_name}.\nMotivo: {closure_reason}"
        elif target_status == TicketStatus.PENDING_VALIDATION:
            ticket.solved_at = now
            if not ticket.technician_id:
                ticket.technician_id = current_user.id
            audit_msg = f"📋 [Atualização em Massa] Status alterado de '{old_status_label}' para '{target_status.value}' por {current_user.display_name}."
            if data.comment and data.comment.strip():
                audit_msg += f"\nMotivo/Observação: {data.comment.strip()}"
        else:
            if old_status_label == TicketStatus.CLOSED.value:
                ticket.closed_at = None
                ticket.closure_reason = None
            audit_msg = f"📋 [Atualização em Massa] Status alterado de '{old_status_label}' para '{target_status.value}' por {current_user.display_name}."
            if data.comment and data.comment.strip():
                audit_msg += f"\nMotivo/Observação: {data.comment.strip()}"

        interaction = TicketInteraction(
            ticket_id=ticket.id,
            user_id=current_user.id,
            message=audit_msg,
            is_solution=(target_status == TicketStatus.PENDING_VALIDATION),
        )
        db.add(interaction)
        updated_tickets.append(ticket)

    db.commit()

    if target_status == TicketStatus.CLOSED:
        from app.models.system_setting import SystemSetting
        from app.services.email_service import send_ticket_closed_staff_notification
        setting = db.query(SystemSetting).first()
        notify_ti_close = getattr(setting, "notify_ti_on_close", True) if setting else True

        for t in updated_tickets:
            dispatch_csat_survey(t, db, background_tasks)
            if notify_ti_close:
                req_u = db.query(User).filter(User.id == t.requester_id).first()
                req_disp = req_u.display_name if req_u else "Solicitante"
                background_tasks.add_task(
                    send_ticket_closed_staff_notification,
                    ticket=t,
                    closed_by_name=current_user.display_name,
                    solution_or_reason=closure_reason,
                    requester_name=req_disp,
                )
    else:
        from app.models.system_setting import SystemSetting
        from app.services.email_service import send_ticket_status_changed_notification
        setting = db.query(SystemSetting).first()
        notify_req_update = getattr(setting, "notify_requester_on_update", True) if setting else True
        if notify_req_update:
            for t in updated_tickets:
                req_u = db.query(User).filter(User.id == t.requester_id).first()
                if req_u and req_u.email:
                    background_tasks.add_task(
                        send_ticket_status_changed_notification,
                        ticket=t,
                        new_status=target_status.value,
                        changed_by_name=current_user.display_name,
                        requester_name=req_u.display_name,
                        requester_email=req_u.email,
                    )

    # Notificação opcional no WhatsApp
    if data.notify_whatsapp and updated_tickets:
        ticket_refs = ", ".join([f"#{t.id}" for t in updated_tickets[:8]])
        if len(updated_tickets) > 8:
            ticket_refs += f" e mais {len(updated_tickets) - 8} chamados"

        if target_status == TicketStatus.CLOSED:
            msg_text = (
                f"🔒 *[Fechamento em Massa de Chamados]*\n\n"
                f"*Responsável:* {current_user.display_name}\n"
                f"*Status:* Fechado com Sucesso\n"
                f"*Quantidade:* {len(updated_tickets)} chamados\n"
                f"*Motivo do Fechamento:* {closure_reason}\n"
                f"*Tickets:* {ticket_refs}"
            )
        else:
            msg_text = (
                f"🔄 *[Atualização em Massa de Chamados]*\n\n"
                f"*Responsável:* {current_user.display_name}\n"
                f"*Novo Status:* {target_status.value}\n"
                f"*Quantidade:* {len(updated_tickets)} chamados\n"
                f"*Tickets:* {ticket_refs}"
            )
            if data.comment and data.comment.strip():
                msg_text += f"\n*Observação:* {data.comment.strip()}"

        background_tasks.add_task(EvolutionService.send_whatsapp_message, msg_text)

    return {
        "success": True,
        "updated_count": len(updated_tickets),
        "updated_ids": [t.id for t in updated_tickets],
        "new_status": target_status.value,
        "closure_reason": closure_reason if target_status == TicketStatus.CLOSED else None,
    }


@router.patch("/{ticket_id}/solve", response_model=TicketResponse)
def solve_ticket(
    ticket_id: int,
    data: TicketSolve,
    background_tasks: BackgroundTasks,
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

    ticket = TicketService.solve_ticket(db, ticket, current_user, data.solution_message)
    
    msg_text = f"✅ *[Chamado Resolvido - Aguardando Validação]*\n\n*Ticket ID:* #{ticket.id}\n*Título:* {ticket.title}\n*Técnico:* {current_user.display_name}\n\n*Solução:* {data.solution_message}"
    background_tasks.add_task(EvolutionService.send_whatsapp_message, msg_text)
    
    return ticket


@router.post("/{ticket_id}/validate", response_model=TicketResponse)
def validate_ticket(
    ticket_id: int,
    data: TicketValidate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Gestor valida a solução via magic link (não requer autenticação JWT).
    O token no body contém a identidade do gestor.
    """
    if not data.token:
        raise HTTPException(status_code=400, detail="Token de validação é obrigatório")

    try:
        ticket = TicketService.validate_ticket(
            db, ticket_id, data.token, data.action, data.rejection_reason
        )
        
        if data.action == "approve":
            msg_text = f"✅ *[Chamado Fechado]*\n\n*Ticket ID:* #{ticket.id}\n*Título:* {ticket.title}\n*Status:* Fechado com Sucesso"
            dispatch_csat_survey(ticket, db, background_tasks)
            try:
                from app.models.system_setting import SystemSetting
                from app.services.email_service import send_ticket_closed_staff_notification
                setting = db.query(SystemSetting).first()
                if not setting or getattr(setting, "notify_ti_on_close", True):
                    req_u = db.query(User).filter(User.id == ticket.requester_id).first()
                    req_disp = req_u.display_name if req_u else "Solicitante"
                    background_tasks.add_task(
                        send_ticket_closed_staff_notification,
                        ticket=ticket,
                        closed_by_name="Gestor (Aprovação)",
                        solution_or_reason=ticket.closure_reason or "Solução validada e aprovada pelo gestor.",
                        requester_name=req_disp,
                    )
            except Exception as e:
                print(f"[WARN] Falha ao agendar notificação de fechamento para a TI: {e}")
        else:
            msg_text = f"❌ *[Solução Rejeitada]*\n\n*Ticket ID:* #{ticket.id}\n*Título:* {ticket.title}\n*Motivo:* {data.rejection_reason or 'Não informado'}"
            
        background_tasks.add_task(EvolutionService.send_whatsapp_message, msg_text, ticket_id=ticket.id)
        
        return ticket
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{ticket_id}/interactions", response_model=InteractionResponse, status_code=status.HTTP_201_CREATED)
def add_interaction(
    ticket_id: int,
    data: InteractionCreate,
    background_tasks: BackgroundTasks,
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

    base_url = get_app_base_url()

    # 1. Notificação Evolution API para o Grupo da TI
    msg_text = (
        f"💬 *[Novo Comentário no Chamado #{ticket.id}]*\n\n"
        f"*Título:* {ticket.title}\n"
        f"*Por:* {u_name}\n\n"
        f"*Mensagem:* {interaction.message}\n\n"
        f"🔗 *Acessar chamado:* {base_url}/admin/tickets?ticketId={ticket.id}"
    )
    background_tasks.add_task(EvolutionService.send_whatsapp_message, msg_text, ticket_id=ticket.id)

    # 2. Notificações adicionais por E-mail e WhatsApp
    try:
        from app.models.system_setting import SystemSetting
        from app.services.email_service import send_ticket_interaction_notification, get_support_email
        setting = db.query(SystemSetting).first()
        notify_req_update = getattr(setting, "notify_requester_on_update", True) if setting else True
        notify_ti_update = getattr(setting, "notify_ti_on_update", True) if setting else True

        req_user = db.query(User).filter(User.id == ticket.requester_id).first()
        req_name = req_user.display_name if req_user else "Solicitante"

        is_staff_author = current_user.id != ticket.requester_id

        if is_staff_author:
            # Autor é técnico/admin -> Notificar o Solicitante
            if notify_req_update and req_user:
                if req_user.email:
                    background_tasks.add_task(
                        send_ticket_interaction_notification,
                        ticket=ticket,
                        author_name=u_name,
                        message_text=interaction.message,
                        to_email=req_user.email,
                        recipient_name=req_name,
                        is_for_requester=True,
                    )
                if req_user.phone:
                    wa_req = (
                        f"💬 *[TIHFSA] Nova Resposta no Chamado #{ticket.id}*\n\n"
                        f"Olá, *{req_name}*!\n"
                        f"O analista *{u_name}* adicionou uma mensagem no seu chamado *'{ticket.title}'*:\n\n"
                        f"\"{interaction.message}\"\n\n"
                        f"🔗 *Responder no portal:* {base_url}/app?ticketId={ticket.id}"
                    )
                    background_tasks.add_task(
                        EvolutionService.send_whatsapp_message,
                        wa_req,
                        recipient=req_user.phone,
                        ticket_id=ticket.id,
                        recipient_name=req_name,
                    )
        else:
            # Autor é o próprio solicitante -> Notificar a Equipe de TI por E-mail (além do grupo WhatsApp que já recebeu)
            if notify_ti_update:
                background_tasks.add_task(
                    send_ticket_interaction_notification,
                    ticket=ticket,
                    author_name=u_name,
                    message_text=interaction.message,
                    to_email=get_support_email(),
                    recipient_name="Equipe de TI",
                    is_for_requester=False,
                )
    except Exception as e:
        print(f"[WARN] Falha ao agendar notificações de interação: {e}")

    return InteractionResponse(
        id=interaction.id,
        message=interaction.message,
        is_solution=interaction.is_solution,
        user_id=interaction.user_id,
        user_name=u_name,
        user_role=u_role,
        created_at=interaction.created_at,
    )


class TicketReopenRequest(BaseModel):
    reason: str


@router.post("/{ticket_id}/reopen", response_model=TicketResponse, summary="Reabrir chamado sob garantia")
def reopen_ticket(
    ticket_id: int,
    data: TicketReopenRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reabre um chamado concluído dentro do período de garantia configurado.
    Permissão: Solicitante original do chamado ou técnicos/administradores.
    """
    from datetime import timedelta
    from app.models.system_setting import SystemSetting
    from app.services.email_service import send_ticket_reopened_notification

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Chamado não encontrado.")

    if ticket.status != TicketStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Apenas chamados finalizados podem ser reabertos.")

    role_val = current_user.role.value if isinstance(current_user.role, UserRole) else str(current_user.role).lower()
    u_roles = current_user.roles if (current_user.roles and isinstance(current_user.roles, list)) else [role_val]
    u_roles_lower = [r.lower() for r in u_roles]
    is_privileged = any(r in u_roles_lower for r in ["admin", "technician", "tecnico"])

    if not is_privileged and ticket.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="Você não tem permissão para reabrir este chamado.")

    reason = data.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail="É necessário informar a justificativa para reabrir o chamado.")

    setting = db.query(SystemSetting).first()
    warranty_days = setting.ticket_warranty_days if (setting and setting.ticket_warranty_days) else 7

    now = datetime.now(timezone.utc)
    if ticket.closed_at:
        expiration_date = ticket.closed_at + timedelta(days=warranty_days)
        if now > expiration_date:
            raise HTTPException(
                status_code=400,
                detail=f"O prazo de garantia ({warranty_days} dias) para reabertura deste chamado expirou em {expiration_date.strftime('%d/%m/%Y')}. Por favor, abra um novo chamado."
            )

    ticket.status = TicketStatus.IN_PROGRESS
    ticket.reopen_count = (ticket.reopen_count or 0) + 1
    ticket.reopened_at = now
    ticket.closed_at = None
    ticket.closure_reason = None
    ticket.updated_at = now

    audit_msg = f"🔄 [Chamado Reaberto sob Garantia] Reaberto por {current_user.display_name} (#{ticket.reopen_count}ª reabertura).\nJustificativa: {reason}"
    db.add(TicketInteraction(
        ticket_id=ticket.id,
        user_id=current_user.id,
        message=audit_msg,
        is_solution=False,
    ))

    db.commit()
    db.refresh(ticket)

    # Notificações imediatas
    whatsapp_msg = (
        f"🔄 *[Chamado Reaberto sob Garantia]*\n\n"
        f"*Ticket ID:* #{ticket.id}\n"
        f"*Título:* {ticket.title}\n"
        f"*Solicitante:* {current_user.display_name}\n"
        f"*Reabertura:* #{ticket.reopen_count}\n"
        f"*Motivo:* {reason}"
    )
    background_tasks.add_task(EvolutionService.send_whatsapp_message, whatsapp_msg)
    background_tasks.add_task(send_ticket_reopened_notification, ticket=ticket, user_name=current_user.display_name, reason=reason)

    return ticket

