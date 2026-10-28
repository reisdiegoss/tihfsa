"""
Router Projects — Gestão de Projetos, Portfólio, Kanban, CMDB, Equipe e Linha do Tempo.
"""
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.project import Project, ProjectTask, ProjectStatus, ProjectPriority, TaskStatus, ProjectTimeline
from app.models.asset import Asset
from app.models.ticket import Ticket, TicketStatus, TicketPriority, SupportLevel
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectDetailResponse,
    ProjectTaskCreate,
    ProjectTaskUpdate,
    ProjectTaskResponse,
    ProjectTicketSummary,
    ProjectCreateTicketRequest,
    ProjectLinkTicketRequest,
    ProjectMemberRequest,
    ProjectAssetRequest,
    AssetMiniSummary,
    ProjectTimelineCreate,
    ProjectTimelineResponse,
    UserMiniSummary,
)

router = APIRouter(prefix="/api/v1/projects", tags=["Projetos & Portfólio"])


def _check_project_permission(user: User, action: str = "view"):
    """
    Verifica se o usuário tem permissão para a ação solicitada no módulo de projetos.
    Ações: 'view', 'create', 'edit', 'delete', 'manage'.
    """
    if user.role == UserRole.ADMIN:
        return True

    roles = user.roles or ([user.role.value] if hasattr(user.role, "value") else [str(user.role)])
    if "admin" in roles:
        return True

    # Técnicos de TI e membros da equipe técnica têm acesso operacional por padrão
    is_tech = (user.role == UserRole.TECHNICIAN) or ("technician" in roles) or getattr(user, "is_staff", False)
    allowed_modules = user.allowed_modules or []

    if not (is_tech or ("projects" in allowed_modules)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado ao módulo de Projetos.",
        )

    # Permissões granulares configuradas no usuário
    if user.module_permissions and isinstance(user.module_permissions, dict):
        mod_perms = user.module_permissions.get("projects", {})
        if action in mod_perms and not mod_perms[action]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Você não tem permissão para '{action}' no módulo de Projetos.",
            )

    return True


def _generate_project_code(db: Session) -> str:
    """Gera o próximo código sequencial de projeto: PRJ-001, PRJ-002, etc."""
    last_project = db.query(Project).order_by(desc(Project.id)).first()
    next_num = 1
    if last_project and last_project.code:
        try:
            parts = last_project.code.split("-")
            if len(parts) == 2 and parts[1].isdigit():
                next_num = int(parts[1]) + 1
        except Exception:
            next_num = last_project.id + 1
    return f"PRJ-{next_num:03d}"


def _format_user_summary(user: Optional[User]) -> Optional[UserMiniSummary]:
    if not user:
        return None
    return UserMiniSummary(
        id=user.id,
        display_name=user.display_name,
        email=user.email,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
    )


def _format_asset_summary(asset: Optional[Asset]) -> Optional[AssetMiniSummary]:
    if not asset:
        return None
    loc_name = asset.location.name if getattr(asset, "location", None) else None
    return AssetMiniSummary(
        id=asset.id,
        asset_tag=asset.asset_tag,
        name=asset.name,
        type=asset.type.value if hasattr(asset.type, "value") else str(asset.type),
        brand=asset.brand,
        model=asset.model,
        ip_address=asset.ip_address,
        location_name=loc_name,
    )


def _format_timeline_response(entry: ProjectTimeline) -> ProjectTimelineResponse:
    return ProjectTimelineResponse(
        id=entry.id,
        project_id=entry.project_id,
        author_id=entry.author_id,
        author=_format_user_summary(entry.author),
        event_type=entry.event_type,
        content=entry.content,
        created_at=entry.created_at,
    )


def _add_timeline_event(db: Session, project_id: int, content: str, event_type: str = "system", author_id: Optional[int] = None):
    try:
        event = ProjectTimeline(
            project_id=project_id,
            author_id=author_id,
            event_type=event_type,
            content=content,
        )
        db.add(event)
    except Exception as e:
        print(f"[Timeline Event Error] {e}")


def _format_ticket_summary(ticket: Ticket) -> ProjectTicketSummary:
    status_str = ticket.status.value if hasattr(ticket.status, "value") else str(ticket.status)
    priority_str = ticket.priority.value if hasattr(ticket.priority, "value") else str(ticket.priority)
    level_str = ticket.support_level.value if hasattr(ticket.support_level, "value") else str(ticket.support_level)
    return ProjectTicketSummary(
        id=ticket.id,
        title=ticket.title,
        status=status_str,
        priority=priority_str,
        support_level=level_str,
        requester_name=ticket.requester.display_name if ticket.requester else None,
        technician_name=ticket.technician.display_name if ticket.technician else None,
        created_at=ticket.created_at,
    )


def _format_task_response(task: ProjectTask) -> ProjectTaskResponse:
    ticket_summary = _format_ticket_summary(task.ticket) if task.ticket else None
    assigned_summary = _format_user_summary(task.assigned_to) if task.assigned_to else None
    asset_summary = _format_asset_summary(task.asset) if getattr(task, "asset", None) else None
    return ProjectTaskResponse(
        id=task.id,
        project_id=task.project_id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        is_blocked=getattr(task, "is_blocked", False) or False,
        blocked_reason=getattr(task, "blocked_reason", None),
        assigned_to_id=task.assigned_to_id,
        assigned_to=assigned_summary,
        ticket_id=task.ticket_id,
        ticket=ticket_summary,
        asset_id=getattr(task, "asset_id", None),
        asset=asset_summary,
        checklist=getattr(task, "checklist", []) or [],
        due_date=task.due_date,
        order=task.order,
        completed_at=task.completed_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


def _recalc_project_progress(project: Project):
    """Calcula a porcentagem de progresso baseado no total de tarefas e tarefas concluídas."""
    if not project.tasks:
        return
    total = len(project.tasks)
    completed = sum(1 for t in project.tasks if t.status == TaskStatus.CONCLUIDO.value)
    project.progress = int((completed / total) * 100)


# ====================================================
# ENDPOINTS DE PROJETOS
# ====================================================

@router.get("", response_model=List[ProjectResponse])
def list_projects(
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = None,
    category: Optional[str] = None,
    manager_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista todos os projetos com contadores e filtros."""
    _check_project_permission(current_user, action="view")

    query = db.query(Project)

    if status_filter:
        query = query.filter(Project.status == status_filter)
    if priority:
        query = query.filter(Project.priority == priority)
    if category:
        query = query.filter(Project.category == category)
    if manager_id:
        query = query.filter(Project.manager_id == manager_id)
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Project.title.ilike(search_term),
                Project.code.ilike(search_term),
                Project.description.ilike(search_term),
            )
        )

    projects = query.order_by(desc(Project.created_at)).all()

    result = []
    for p in projects:
        tasks_count = len(p.tasks)
        tasks_completed = sum(1 for t in p.tasks if t.status == TaskStatus.CONCLUIDO.value)
        tickets_count = len(p.tickets)
        assets_count = len(p.assets)
        members_count = len(p.members)
        members_formatted = [_format_user_summary(m) for m in p.members]

        result.append(
            ProjectResponse(
                id=p.id,
                code=p.code,
                title=p.title,
                description=p.description,
                status=p.status,
                priority=p.priority,
                category=p.category,
                start_date=p.start_date,
                due_date=p.due_date,
                completed_at=p.completed_at,
                progress=p.progress,
                budget=p.budget,
                spent=p.spent,
                manager_id=p.manager_id,
                created_by_id=p.created_by_id,
                manager=_format_user_summary(p.manager),
                created_by=_format_user_summary(p.created_by),
                members=members_formatted,
                tasks_count=tasks_count,
                tasks_completed_count=tasks_completed,
                tickets_count=tickets_count,
                assets_count=assets_count,
                members_count=members_count,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
        )

    return result


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cria um novo projeto com código gerado sequencialmente."""
    _check_project_permission(current_user, action="create")

    code = _generate_project_code(db)

    project = Project(
        code=code,
        title=data.title,
        description=data.description,
        status=data.status or ProjectStatus.PLANEJAMENTO.value,
        priority=data.priority or ProjectPriority.MEDIA.value,
        category=data.category or "Infraestrutura",
        start_date=data.start_date,
        due_date=data.due_date,
        budget=data.budget or 0.0,
        spent=data.spent or 0.0,
        manager_id=data.manager_id or current_user.id,
        created_by_id=current_user.id,
        progress=0,
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    # Registrar evento inicial na timeline
    _add_timeline_event(
        db, project.id,
        f"Projeto {project.code} — '{project.title}' criado por {current_user.display_name}.",
        event_type="system",
        author_id=current_user.id
    )
    db.commit()

    return ProjectResponse(
        id=project.id,
        code=project.code,
        title=project.title,
        description=project.description,
        status=project.status,
        priority=project.priority,
        category=project.category,
        start_date=project.start_date,
        due_date=project.due_date,
        completed_at=project.completed_at,
        progress=project.progress,
        budget=project.budget,
        spent=project.spent,
        manager_id=project.manager_id,
        created_by_id=project.created_by_id,
        manager=_format_user_summary(project.manager),
        created_by=_format_user_summary(project.created_by),
        members=[],
        tasks_count=0,
        tasks_completed_count=0,
        tickets_count=0,
        assets_count=0,
        members_count=0,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.get("/{project_id}", response_model=ProjectDetailResponse)
def get_project_detail(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtém detalhes de um projeto com tarefas, chamados, ativos, equipe e linha do tempo."""
    _check_project_permission(current_user, action="view")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")

    tasks_count = len(project.tasks)
    tasks_completed = sum(1 for t in project.tasks if t.status == TaskStatus.CONCLUIDO.value)
    tickets_count = len(project.tickets)
    assets_count = len(project.assets)
    members_count = len(project.members)

    tasks_formatted = [_format_task_response(t) for t in project.tasks]
    tickets_formatted = [_format_ticket_summary(t) for t in project.tickets]
    assets_formatted = [_format_asset_summary(a) for a in project.assets]
    members_formatted = [_format_user_summary(m) for m in project.members]
    timeline_formatted = [_format_timeline_response(tl) for tl in project.timeline]

    return ProjectDetailResponse(
        id=project.id,
        code=project.code,
        title=project.title,
        description=project.description,
        status=project.status,
        priority=project.priority,
        category=project.category,
        start_date=project.start_date,
        due_date=project.due_date,
        completed_at=project.completed_at,
        progress=project.progress,
        budget=project.budget,
        spent=project.spent,
        manager_id=project.manager_id,
        created_by_id=project.created_by_id,
        manager=_format_user_summary(project.manager),
        created_by=_format_user_summary(project.created_by),
        members=members_formatted,
        tasks_count=tasks_count,
        tasks_completed_count=tasks_completed,
        tickets_count=tickets_count,
        assets_count=assets_count,
        members_count=members_count,
        tasks=tasks_formatted,
        tickets=tickets_formatted,
        assets=assets_formatted,
        timeline=timeline_formatted,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza dados do projeto."""
    _check_project_permission(current_user, action="edit")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")

    update_dict = data.dict(exclude_unset=True)
    old_status = project.status

    # Se status mudou para Concluído, registrar completed_at
    if "status" in update_dict and update_dict["status"] == ProjectStatus.CONCLUIDO.value:
        if not project.completed_at:
            project.completed_at = datetime.now(timezone.utc)
            project.progress = 100
    elif "status" in update_dict and update_dict["status"] != ProjectStatus.CONCLUIDO.value:
        project.completed_at = None

    for field, val in update_dict.items():
        setattr(project, field, val)

    # Evento de alteração de status
    if "status" in update_dict and update_dict["status"] != old_status:
        _add_timeline_event(
            db, project.id,
            f"Status do projeto alterado de '{old_status}' para '{project.status}'.",
            event_type="status",
            author_id=current_user.id
        )

    db.commit()
    db.refresh(project)

    tasks_count = len(project.tasks)
    tasks_completed = sum(1 for t in project.tasks if t.status == TaskStatus.CONCLUIDO.value)
    tickets_count = len(project.tickets)
    assets_count = len(project.assets)
    members_count = len(project.members)
    members_formatted = [_format_user_summary(m) for m in project.members]

    return ProjectResponse(
        id=project.id,
        code=project.code,
        title=project.title,
        description=project.description,
        status=project.status,
        priority=project.priority,
        category=project.category,
        start_date=project.start_date,
        due_date=project.due_date,
        completed_at=project.completed_at,
        progress=project.progress,
        budget=project.budget,
        spent=project.spent,
        manager_id=project.manager_id,
        created_by_id=project.created_by_id,
        manager=_format_user_summary(project.manager),
        created_by=_format_user_summary(project.created_by),
        members=members_formatted,
        tasks_count=tasks_count,
        tasks_completed_count=tasks_completed,
        tickets_count=tickets_count,
        assets_count=assets_count,
        members_count=members_count,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Exclui um projeto. Chamados vinculados terão o project_id desvinculado (SET NULL)."""
    _check_project_permission(current_user, action="delete")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")

    # Desvincular chamados para não apagá-los
    db.query(Ticket).filter(Ticket.project_id == project_id).update({"project_id": None})

    db.delete(project)
    db.commit()
    return None


# ====================================================
# TAREFAS / KANBAN DO PROJETO
# ====================================================

@router.post("/{project_id}/tasks", response_model=ProjectTaskResponse, status_code=status.HTTP_201_CREATED)
def create_project_task(
    project_id: int,
    data: ProjectTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cria uma tarefa/pendência no projeto, com opção de gerar chamado automático para o técnico."""
    _check_project_permission(current_user, action="create")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")

    created_ticket_id = None

    # Se selecionado "Criar Chamado", cria chamado Helpdesk correspondente
    if data.create_ticket:
        prio_map = {
            "Baixa": TicketPriority.LOW,
            "Média": TicketPriority.MEDIUM,
            "Alta": TicketPriority.HIGH,
            "Urgente": TicketPriority.CRITICAL,
            "Crítica": TicketPriority.CRITICAL,
        }
        tk_prio = prio_map.get(data.priority, TicketPriority.MEDIUM)

        ticket = Ticket(
            title=f"[{project.code}] {data.title}",
            description=data.description or f"Demanda originada do projeto {project.code} — {project.title}",
            status=TicketStatus.NEW,
            priority=tk_prio,
            support_level=SupportLevel.N1,
            requester_id=current_user.id,
            technician_id=data.assigned_to_id,
            category_id=data.ticket_category_id,
            project_id=project.id,
        )
        db.add(ticket)
        db.flush()
        created_ticket_id = ticket.id

        if data.assigned_to_id:
            try:
                from app.services.email_service import notify_technician_assigned
                tech = db.query(User).filter(User.id == data.assigned_to_id).first()
                if tech and tech.email:
                    notify_technician_assigned(ticket, tech)
            except Exception as e:
                print(f"[Email Project Ticket Error] {e}")

    task = ProjectTask(
        project_id=project.id,
        title=data.title,
        description=data.description,
        status=data.status or TaskStatus.A_FAZER.value,
        priority=data.priority or "Média",
        is_blocked=data.is_blocked,
        blocked_reason=data.blocked_reason,
        assigned_to_id=data.assigned_to_id,
        ticket_id=created_ticket_id,
        asset_id=data.asset_id,
        checklist=data.checklist or [],
        due_date=data.due_date,
        order=data.order or len(project.tasks),
    )

    db.add(task)
    db.commit()
    db.refresh(task)

    # Recalcula progresso
    _recalc_project_progress(project)

    # Timeline event
    _add_timeline_event(
        db, project.id,
        f"Nova atividade adicionada: '{task.title}' ({task.status}).",
        event_type="task",
        author_id=current_user.id
    )
    db.commit()

    return _format_task_response(task)


@router.put("/{project_id}/tasks/{task_id}", response_model=ProjectTaskResponse)
def update_project_task(
    project_id: int,
    task_id: int,
    data: ProjectTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza status, responsável, prioridade, bloqueio ou ordem da tarefa (Kanban)."""
    _check_project_permission(current_user, action="edit")

    task = db.query(ProjectTask).filter(
        ProjectTask.id == task_id,
        ProjectTask.project_id == project_id,
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada.")

    update_dict = data.dict(exclude_unset=True)
    old_status = task.status
    old_blocked = task.is_blocked

    # Conclusão
    if "status" in update_dict and update_dict["status"] == TaskStatus.CONCLUIDO.value:
        task.completed_at = datetime.now(timezone.utc)
    elif "status" in update_dict and update_dict["status"] != TaskStatus.CONCLUIDO.value:
        task.completed_at = None

    for field, val in update_dict.items():
        setattr(task, field, val)

    # Eventos de timeline para a tarefa
    if "status" in update_dict and update_dict["status"] != old_status:
        _add_timeline_event(
            db, project_id,
            f"Tarefa '{task.title}' movida para status '{task.status}'.",
            event_type="task",
            author_id=current_user.id
        )

    if "is_blocked" in update_dict and update_dict["is_blocked"] != old_blocked:
        if task.is_blocked:
            reason_str = f" Motivo: {task.blocked_reason}" if task.blocked_reason else ""
            _add_timeline_event(
                db, project_id,
                f"Tarefa '{task.title}' marcada como BLOQUEADA.{reason_str}",
                event_type="task",
                author_id=current_user.id
            )
        else:
            _add_timeline_event(
                db, project_id,
                f"Tarefa '{task.title}' foi DESBLOQUEADA.",
                event_type="task",
                author_id=current_user.id
            )

    db.commit()
    db.refresh(task)

    # Atualiza % do projeto
    project = db.query(Project).filter(Project.id == project_id).first()
    if project:
        _recalc_project_progress(project)
        db.commit()

    return _format_task_response(task)


@router.delete("/{project_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_task(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Exclui uma tarefa do projeto."""
    _check_project_permission(current_user, action="edit")

    task = db.query(ProjectTask).filter(
        ProjectTask.id == task_id,
        ProjectTask.project_id == project_id,
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada.")

    task_title = task.title
    db.delete(task)
    db.commit()

    _add_timeline_event(
        db, project_id,
        f"Tarefa '{task_title}' excluída do projeto.",
        event_type="task",
        author_id=current_user.id
    )

    project = db.query(Project).filter(Project.id == project_id).first()
    if project:
        _recalc_project_progress(project)
        db.commit()

    return None


# ====================================================
# EQUIPE / MEMBROS DO PROJETO
# ====================================================

@router.post("/{project_id}/members", response_model=List[UserMiniSummary])
def add_project_member(
    project_id: int,
    data: ProjectMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Adiciona um técnico participante à equipe do projeto."""
    _check_project_permission(current_user, action="edit")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")

    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    if user not in project.members:
        project.members.append(user)
        _add_timeline_event(
            db, project.id,
            f"Técnico {user.display_name} associado à equipe do projeto.",
            event_type="system",
            author_id=current_user.id
        )
        db.commit()

    return [_format_user_summary(m) for m in project.members]


@router.delete("/{project_id}/members/{user_id}", response_model=List[UserMiniSummary])
def remove_project_member(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove um técnico da equipe do projeto."""
    _check_project_permission(current_user, action="edit")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    if user in project.members:
        project.members.remove(user)
        _add_timeline_event(
            db, project.id,
            f"Técnico {user.display_name} desvinculado da equipe do projeto.",
            event_type="system",
            author_id=current_user.id
        )
        db.commit()

    return [_format_user_summary(m) for m in project.members]


# ====================================================
# ATIVOS / EQUIPAMENTOS CMDB DO PROJETO
# ====================================================

@router.post("/{project_id}/assets", response_model=List[AssetMiniSummary])
def link_asset_to_project(
    project_id: int,
    data: ProjectAssetRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Associa um ativo/equipamento do CMDB a este projeto."""
    _check_project_permission(current_user, action="edit")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")

    asset = db.query(Asset).filter(Asset.id == data.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Ativo não encontrado.")

    if asset not in project.assets:
        project.assets.append(asset)
        tag_str = f" [Patrimônio: {asset.asset_tag}]" if asset.asset_tag else ""
        _add_timeline_event(
            db, project.id,
            f"Equipamento '{asset.name}'{tag_str} associado ao projeto.",
            event_type="asset",
            author_id=current_user.id
        )
        db.commit()

    return [_format_asset_summary(a) for a in project.assets]


@router.delete("/{project_id}/assets/{asset_id}", response_model=List[AssetMiniSummary])
def unlink_asset_from_project(
    project_id: int,
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Desvincula um equipamento do CMDB deste projeto."""
    _check_project_permission(current_user, action="edit")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")

    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Ativo não encontrado.")

    if asset in project.assets:
        project.assets.remove(asset)
        tag_str = f" [Patrimônio: {asset.asset_tag}]" if asset.asset_tag else ""
        _add_timeline_event(
            db, project.id,
            f"Equipamento '{asset.name}'{tag_str} desvinculado do projeto.",
            event_type="asset",
            author_id=current_user.id
        )
        db.commit()

    return [_format_asset_summary(a) for a in project.assets]


# ====================================================
# LINHA DO TEMPO / HISTÓRICO & COMENTÁRIOS
# ====================================================

@router.get("/{project_id}/timeline", response_model=List[ProjectTimelineResponse])
def get_project_timeline(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista eventos e comentários cronológicos da linha do tempo do projeto."""
    _check_project_permission(current_user, action="view")

    events = (
        db.query(ProjectTimeline)
        .filter(ProjectTimeline.project_id == project_id)
        .order_by(desc(ProjectTimeline.created_at))
        .all()
    )

    return [_format_timeline_response(e) for e in events]


@router.post("/{project_id}/timeline", response_model=ProjectTimelineResponse, status_code=status.HTTP_201_CREATED)
def add_project_timeline_comment(
    project_id: int,
    data: ProjectTimelineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Publica um comentário técnico ou registro de evolução na linha do tempo do projeto."""
    _check_project_permission(current_user, action="view")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")

    event = ProjectTimeline(
        project_id=project.id,
        author_id=current_user.id,
        event_type=data.event_type or "comment",
        content=data.content.strip(),
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    return _format_timeline_response(event)


# ====================================================
# INTEGRAÇÃO DE CHAMADOS DO HELPDESK
# ====================================================

@router.post("/{project_id}/create-ticket", response_model=ProjectTicketSummary, status_code=status.HTTP_201_CREATED)
def create_ticket_for_project(
    project_id: int,
    data: ProjectCreateTicketRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cria um chamado no Helpdesk vinculado ao projeto e opcionalmente gera um cartão no Kanban."""
    _check_project_permission(current_user, action="create")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")

    prio_map = {
        "Baixa": TicketPriority.LOW,
        "Média": TicketPriority.MEDIUM,
        "Alta": TicketPriority.HIGH,
        "Urgente": TicketPriority.CRITICAL,
        "Crítica": TicketPriority.CRITICAL,
    }
    tk_prio = prio_map.get(data.priority, TicketPriority.MEDIUM)

    level_map = {
        "N1": SupportLevel.N1,
        "N2": SupportLevel.N2,
        "N3": SupportLevel.N3,
    }
    tk_level = level_map.get(data.support_level, SupportLevel.N1)

    ticket = Ticket(
        title=f"[{project.code}] {data.title}",
        description=data.description or f"Demanda solicitada no projeto {project.code} — {project.title}",
        status=TicketStatus.NEW,
        priority=tk_prio,
        support_level=tk_level,
        requester_id=current_user.id,
        technician_id=data.technician_id,
        category_id=data.category_id,
        project_id=project.id,
    )

    db.add(ticket)
    db.flush()

    # Se create_task estiver ativo, cria o cartão correspondente no Kanban do projeto
    if data.create_task:
        task = ProjectTask(
            project_id=project.id,
            title=data.title,
            description=data.description,
            status=TaskStatus.A_FAZER.value,
            priority=data.priority,
            assigned_to_id=data.technician_id,
            ticket_id=ticket.id,
            order=len(project.tasks),
        )
        db.add(task)

    _add_timeline_event(
        db, project.id,
        f"Chamado #{ticket.id} ('{ticket.title}') aberto e vinculado ao projeto.",
        event_type="ticket",
        author_id=current_user.id
    )

    db.commit()
    db.refresh(ticket)

    # Dispara e-mail para o técnico
    if data.technician_id:
        try:
            from app.services.email_service import notify_technician_assigned
            tech = db.query(User).filter(User.id == data.technician_id).first()
            if tech and tech.email:
                notify_technician_assigned(ticket, tech)
        except Exception as e:
            print(f"[Email Tech Assignment Error] {e}")

    return _format_ticket_summary(ticket)


@router.post("/{project_id}/link-ticket", response_model=ProjectTicketSummary)
def link_existing_ticket_to_project(
    project_id: int,
    data: ProjectLinkTicketRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Vincula um chamado já existente no Helpdesk a este projeto."""
    _check_project_permission(current_user, action="edit")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")

    ticket = db.query(Ticket).filter(Ticket.id == data.ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Chamado não encontrado.")

    ticket.project_id = project.id

    # Verifica se já existe tarefa vinculada a este chamado
    existing_task = db.query(ProjectTask).filter(
        ProjectTask.project_id == project.id,
        ProjectTask.ticket_id == ticket.id,
    ).first()

    if not existing_task:
        status_kanban = TaskStatus.CONCLUIDO.value if ticket.status == TicketStatus.CLOSED else TaskStatus.EM_ANDAMENTO.value
        task = ProjectTask(
            project_id=project.id,
            title=ticket.title,
            description=ticket.description,
            status=status_kanban,
            priority=ticket.priority.value if hasattr(ticket.priority, "value") else str(ticket.priority),
            assigned_to_id=ticket.technician_id,
            ticket_id=ticket.id,
            order=len(project.tasks),
        )
        db.add(task)

    _add_timeline_event(
        db, project.id,
        f"Chamado #{ticket.id} ('{ticket.title}') vinculado ao projeto.",
        event_type="ticket",
        author_id=current_user.id
    )

    db.commit()
    db.refresh(ticket)

    return _format_ticket_summary(ticket)


@router.delete("/{project_id}/unlink-ticket/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
def unlink_ticket_from_project(
    project_id: int,
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Desvincula um chamado do projeto sem excluí-lo do Helpdesk."""
    _check_project_permission(current_user, action="edit")

    ticket = db.query(Ticket).filter(
        Ticket.id == ticket_id,
        Ticket.project_id == project_id,
    ).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Chamado não vinculado a este projeto.")

    ticket.project_id = None

    # Se houver tarefa associada a este chamado no projeto, desvincula o ticket_id
    db.query(ProjectTask).filter(
        ProjectTask.project_id == project_id,
        ProjectTask.ticket_id == ticket_id,
    ).update({"ticket_id": None})

    _add_timeline_event(
        db, project_id,
        f"Chamado #{ticket_id} desvinculado do projeto.",
        event_type="ticket",
        author_id=current_user.id
    )

    db.commit()
    return None
