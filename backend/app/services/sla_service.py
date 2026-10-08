"""
Service SLA — Cálculo de prazos, conformidade e métricas de Helpdesk para TV e Gestão.
"""
from datetime import datetime, timezone, timedelta, time
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, not_

from app.models.ticket import Ticket, TicketStatus, TicketPriority
from app.models.ticket_interaction import TicketInteraction
from app.models.sla import SLAConfig, SLACategoryRule
from app.models.user import User, UserRole
from app.models.department import Department
from app.models.category import Category
from app.models.satisfaction_survey import TicketSatisfactionSurvey



DAY_NAME_MAP = {
    0: "mon",
    1: "tue",
    2: "wed",
    3: "thu",
    4: "fri",
    5: "sat",
    6: "sun"
}


def get_or_create_sla_config(db: Session) -> SLAConfig:
    """Retorna a configuração global de SLA ou cria uma padrão."""
    config = db.query(SLAConfig).first()
    if not config:
        config = SLAConfig(
            calc_business_hours=False,
            business_start_time="08:00",
            business_end_time="18:00",
            business_days="mon,tue,wed,thu,fri",
            enable_category_sla=False,
            critical_response_min=15,
            critical_resolution_min=120,
            high_response_min=60,
            high_resolution_min=240,
            medium_response_min=120,
            medium_resolution_min=480,
            low_response_min=240,
            low_resolution_min=1440,
            warning_threshold_percent=75,
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def get_sla_target_minutes(
    priority: TicketPriority,
    category_id: Optional[int],
    config: SLAConfig,
    category_rules_map: Dict[int, SLACategoryRule]
) -> Tuple[int, int]:
    """
    Retorna (response_minutes, resolution_minutes) para o chamado.
    Se houver regra para a categoria e a opção estiver ativada, prevalece a regra da categoria.
    Caso contrário, aplica os minutos configurados para a prioridade.
    """
    if config.enable_category_sla and category_id and category_id in category_rules_map:
        rule = category_rules_map[category_id]
        resp_min = rule.response_min if rule.response_min is not None else 60
        res_min = rule.resolution_min
        return (resp_min, res_min)

    # Baseado na prioridade padrão ITIL
    prio = priority.value if hasattr(priority, "value") else str(priority)
    if prio == TicketPriority.CRITICAL.value:
        return (config.critical_response_min, config.critical_resolution_min)
    elif prio == TicketPriority.HIGH.value:
        return (config.high_response_min, config.high_resolution_min)
    elif prio == TicketPriority.LOW.value:
        return (config.low_response_min, config.low_resolution_min)
    else:  # MEDIUM
        return (config.medium_response_min, config.medium_resolution_min)


def add_business_minutes(
    start_dt: datetime,
    minutes_to_add: int,
    start_time_str: str,
    end_time_str: str,
    business_days_str: str
) -> datetime:
    """
    Calcula a data final adicionando minutos úteis conforme expediente e dias de trabalho configurados.
    """
    try:
        sh, sm = [int(p) for p in start_time_str.split(":")]
        eh, em = [int(p) for p in end_time_str.split(":")]
    except Exception:
        sh, sm, eh, em = 8, 0, 18, 0

    valid_days = [d.strip().lower() for d in business_days_str.split(",") if d.strip()]
    if not valid_days:
        valid_days = ["mon", "tue", "wed", "thu", "fri"]

    work_start_time = time(sh, sm)
    work_end_time = time(eh, em)

    if work_start_time >= work_end_time:
        return start_dt + timedelta(minutes=minutes_to_add)

    curr = start_dt
    remaining = minutes_to_add

    # Avança minuto a minuto de expediente (para máxima precisão em SLAs curtos)
    step = timedelta(minutes=1)
    max_steps = 60 * 24 * 60  # Limite de segurança de 60 dias para evitar loops
    steps_count = 0

    while remaining > 0 and steps_count < max_steps:
        steps_count += 1
        day_code = DAY_NAME_MAP.get(curr.weekday(), "")
        is_work_day = day_code in valid_days
        curr_time = curr.time()
        is_work_time = work_start_time <= curr_time < work_end_time

        if is_work_day and is_work_time:
            remaining -= 1

        curr += step

    return curr


def evaluate_ticket_sla(
    ticket: Ticket,
    config: SLAConfig,
    category_rules_map: Dict[int, SLACategoryRule],
    now_dt: Optional[datetime] = None
) -> dict:
    """
    Avalia a situação do SLA para um ticket específico.
    Retorna métricas detalhadas de tempo limite, tempo restante e status (OK, WARNING, BREACHED, MET).
    """
    if now_dt is None:
        now_dt = datetime.now(timezone.utc)

    created_at = ticket.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    resp_min, res_min = get_sla_target_minutes(
        ticket.priority,
        ticket.category_id,
        config,
        category_rules_map
    )

    # Cálculo da data fatal de resolução
    if config.calc_business_hours:
        due_resolution_at = add_business_minutes(
            created_at,
            res_min,
            config.business_start_time,
            config.business_end_time,
            config.business_days
        )
    else:
        due_resolution_at = created_at + timedelta(minutes=res_min)

    # Determinar tempo decorrido e se já foi resolvido
    is_closed = ticket.status in [TicketStatus.CLOSED, TicketStatus.REJECTED]
    end_point = ticket.solved_at or ticket.closed_at or (now_dt if not is_closed else (ticket.updated_at or now_dt))
    if end_point.tzinfo is None:
        end_point = end_point.replace(tzinfo=timezone.utc)

    elapsed_minutes = max(0, int((end_point - created_at).total_seconds() / 60))
    remaining_seconds = (due_resolution_at - now_dt).total_seconds()
    remaining_minutes = int(remaining_seconds / 60)

    # Determinar Status do SLA
    if is_closed:
        if end_point <= due_resolution_at:
            sla_status = "MET"       # Cumprido dentro do prazo
        else:
            sla_status = "BREACHED"   # Resolvido após o prazo
    else:
        if remaining_minutes < 0:
            sla_status = "BREACHED"   # Estourado / Vencido
        else:
            consumed_pct = (elapsed_minutes / max(1, res_min)) * 100
            if remaining_minutes <= 30 or consumed_pct >= config.warning_threshold_percent:
                sla_status = "WARNING"  # Risco iminente de quebra
            else:
                sla_status = "OK"       # Dentro da meta

    return {
        "target_minutes": res_min,
        "elapsed_minutes": elapsed_minutes,
        "remaining_minutes": remaining_minutes,
        "due_at": due_resolution_at.isoformat(),
        "status": sla_status,
        "is_breached": sla_status == "BREACHED",
        "is_warning": sla_status == "WARNING",
    }


def get_helpdesk_monitoring_summary(db: Session, period_days: int = 7) -> dict:
    """
    Retorna o resumo completo de indicadores do Helpdesk para exibição na TV e no painel tático:
    - KPIs em tempo real (abertos, novos, em andamento, sem técnico, críticos)
    - Indicadores de SLA (% conformidade, dentro do prazo, em risco, estourados)
    - Fila de chamados prioritários com timers
    - Carga de técnicos ativos
    - Ranking dos setores mais demandantes
    """
    now_dt = datetime.now(timezone.utc)
    config = get_or_create_sla_config(db)
    
    rules = db.query(SLACategoryRule).all()
    rules_map = {r.category_id: r for r in rules}

    # 1. Chamados Ativos (Não finalizados)
    active_statuses = [TicketStatus.NEW, TicketStatus.IN_PROGRESS, TicketStatus.PENDING_VALIDATION]
    active_tickets = db.query(Ticket).filter(Ticket.status.in_(active_statuses)).all()

    total_open = len(active_tickets)
    new_count = sum(1 for t in active_tickets if t.status == TicketStatus.NEW)
    in_progress_count = sum(1 for t in active_tickets if t.status == TicketStatus.IN_PROGRESS)
    pending_validation_count = sum(1 for t in active_tickets if t.status == TicketStatus.PENDING_VALIDATION)
    unassigned_count = sum(1 for t in active_tickets if t.technician_id is None)
    critical_count = sum(1 for t in active_tickets if t.priority == TicketPriority.CRITICAL)

    sla_ok_count = 0
    sla_warning_count = 0
    sla_breached_count = 0

    evaluated_active = []
    for t in active_tickets:
        sla_data = evaluate_ticket_sla(t, config, rules_map, now_dt)
        if sla_data["status"] == "BREACHED":
            sla_breached_count += 1
        elif sla_data["status"] == "WARNING":
            sla_warning_count += 1
        else:
            sla_ok_count += 1

        req_name = getattr(t.requester, "display_name", None) or getattr(t.requester, "name", None) or "Não informado"
        tech_name = getattr(t.technician, "display_name", None) or getattr(t.technician, "name", None)
        dep_name = "Geral"
        if t.requester and t.requester.department:
            dep_name = getattr(t.requester.department, "name", "Geral")
        cat_name = getattr(t.category, "name", "Sem Categoria") if t.category else "Sem Categoria"

        evaluated_active.append({
            "id": t.id,
            "title": t.title,
            "priority": t.priority.value if hasattr(t.priority, "value") else str(t.priority),
            "status": t.status.value if hasattr(t.status, "value") else str(t.status),
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "requester_name": req_name,
            "department_name": dep_name,
            "technician_name": tech_name,
            "assigned_name": tech_name,
            "category_name": cat_name,
            "sla": sla_data,
            "sla_status": sla_data["status"],
            "sla_remaining_minutes": sla_data["remaining_minutes"],
            "sla_breached": sla_data["is_breached"],
            "sla_warning": sla_data["is_warning"],
        })

    # Ordenar fila prioritária para a TV:
    # 1. Críticos primeiro
    # 2. SLA estourado / menor tempo restante
    def sort_key(item):
        prio_order = {TicketPriority.CRITICAL.value: 0, TicketPriority.HIGH.value: 1, TicketPriority.MEDIUM.value: 2, TicketPriority.LOW.value: 3}
        p_val = prio_order.get(item["priority"], 9)
        rem_min = item["sla"]["remaining_minutes"]
        return (p_val, rem_min)

    urgent_queue = sorted(evaluated_active, key=sort_key)[:15]

    # 2. Histórico de SLA dos últimos X dias para calcular % de Conformidade
    period_start = now_dt - timedelta(days=period_days)
    recent_tickets = db.query(Ticket).filter(Ticket.created_at >= period_start).all()
    
    total_evaluated_period = len(recent_tickets)
    period_breached_count = 0
    period_met_count = 0
    total_resolution_minutes = 0
    resolved_count = 0

    for t in recent_tickets:
        sla_info = evaluate_ticket_sla(t, config, rules_map, now_dt)
        if sla_info["status"] == "BREACHED":
            period_breached_count += 1
        else:
            period_met_count += 1

        if t.solved_at or t.closed_at:
            end_t = t.solved_at or t.closed_at
            if end_t.tzinfo is None:
                end_t = end_t.replace(tzinfo=timezone.utc)
            start_t = t.created_at
            if start_t.tzinfo is None:
                start_t = start_t.replace(tzinfo=timezone.utc)
            diff_min = max(0, (end_t - start_t).total_seconds() / 60)
            total_resolution_minutes += diff_min
            resolved_count += 1

    compliance_rate = 100.0
    if total_evaluated_period > 0:
        compliance_rate = round((period_met_count / total_evaluated_period) * 100, 1)

    mttr_minutes = round(total_resolution_minutes / resolved_count) if resolved_count > 0 else 0

    # 2.1 Avaliações de Satisfação CSAT (Rate de Atendimento)
    answered_surveys = db.query(TicketSatisfactionSurvey).filter(TicketSatisfactionSurvey.answered_at != None).all()
    csat_answered_count = len(answered_surveys)
    if csat_answered_count > 0:
        csat_ratings = [s.rating for s in answered_surveys if s.rating is not None]
        csat_average_rating = round(sum(csat_ratings) / len(csat_ratings), 1) if csat_ratings else 5.0
        csat_satisfied_count = sum(1 for r in csat_ratings if r >= 4)
        csat_satisfaction_pct = round((csat_satisfied_count / len(csat_ratings)) * 100, 1) if csat_ratings else 100.0
    else:
        csat_average_rating = 5.0
        csat_satisfaction_pct = 100.0

    # 3. Carga por Técnico
    technicians = db.query(User).filter(
        (User.role.in_([UserRole.TECHNICIAN, UserRole.ADMIN])) |
        (User.role.in_(["technician", "admin"]))
    ).all()
    tech_stats = []
    for tech in technicians:
        active_for_tech = [t for t in active_tickets if t.technician_id == tech.id]
        in_progress_tech = [t for t in active_for_tech if t.status == TicketStatus.IN_PROGRESS]
        tech_d_name = getattr(tech, "display_name", None) or getattr(tech, "name", tech.email)
        tech_r_val = tech.role.value if hasattr(tech.role, "value") else str(tech.role)
        tech_stats.append({
            "id": tech.id,
            "name": tech_d_name,
            "email": tech.email,
            "role": tech_r_val,
            "active_tickets_count": len(active_for_tech),
            "active_tickets": len(active_for_tech),
            "in_progress_count": len(in_progress_tech),
            "in_progress": len(in_progress_tech),
            "pending": len(active_for_tech) - len(in_progress_tech),
        })
    tech_stats.sort(key=lambda x: x["active_tickets_count"], reverse=True)

    # 4. Ranking de Setores mais demandantes nos chamados ativos
    dept_counts: Dict[str, int] = {}
    for t in active_tickets:
        dept_name = "Outros"
        if t.requester and t.requester.department:
            dept_name = getattr(t.requester.department, "name", "Outros")
        dept_counts[dept_name] = dept_counts.get(dept_name, 0) + 1

    top_sectors = [
        {
            "department": dept, 
            "department_name": dept, 
            "count": cnt, 
            "ticket_count": cnt
        }
        for dept, cnt in sorted(dept_counts.items(), key=lambda item: item[1], reverse=True)[:6]
    ]

    from sqlalchemy import or_, not_

    latest_ticket_id = db.query(func.max(Ticket.id)).scalar() or 0
    latest_critical_ticket_id = db.query(func.max(Ticket.id)).filter(
        (Ticket.priority == TicketPriority.CRITICAL) | 
        (Ticket.priority == "Crítica") | 
        (Ticket.priority == "CRITICAL")
    ).scalar() or 0

    latest_ticket_obj = db.query(Ticket).order_by(Ticket.id.desc()).first()
    latest_ticket_info = None
    if latest_ticket_obj:
        req_d_name = getattr(latest_ticket_obj.requester, "display_name", None) or "Colaborador"
        latest_ticket_info = {
            "id": latest_ticket_obj.id,
            "title": latest_ticket_obj.title,
            "priority": latest_ticket_obj.priority.value if hasattr(latest_ticket_obj.priority, "value") else str(latest_ticket_obj.priority),
            "requester_name": req_d_name,
            "created_at": latest_ticket_obj.created_at.isoformat() if latest_ticket_obj.created_at else None,
        }

    # Última interação feita por solicitante/gestor/humano (não técnicos nem bots)
    latest_requester_inter = (
        db.query(TicketInteraction)
        .join(Ticket, TicketInteraction.ticket_id == Ticket.id)
        .join(User, TicketInteraction.user_id == User.id)
        .filter(
            not_(User.display_name.ilike('%NOC%')),
            not_(User.display_name.ilike('%Sistema%')),
            not_(TicketInteraction.message.ilike('%[Atualização%')),
            not_(TicketInteraction.message.ilike('%[Sistema%')),
            TicketInteraction.is_solution == False,
            or_(
                ~User.role.in_([UserRole.TECHNICIAN, UserRole.ADMIN]),
                and_(
                    TicketInteraction.user_id == Ticket.requester_id,
                    or_(Ticket.technician_id == None, TicketInteraction.user_id != Ticket.technician_id)
                )
            )
        )
        .order_by(TicketInteraction.id.desc())
        .first()
    )

    latest_requester_activity = None
    latest_client_interaction_id = 0
    if latest_requester_inter:
        latest_client_interaction_id = latest_requester_inter.id
        u_display = getattr(latest_requester_inter.user, "display_name", None) or "Solicitante"
        t_title = latest_requester_inter.ticket.title if latest_requester_inter.ticket else f"Chamado #{latest_requester_inter.ticket_id}"
        latest_requester_activity = {
            "id": latest_requester_inter.id,
            "ticket_id": latest_requester_inter.ticket_id,
            "ticket_title": t_title,
            "author_name": u_display,
            "message": (latest_requester_inter.message[:150] + "...") if len(latest_requester_inter.message) > 150 else latest_requester_inter.message,
            "created_at": latest_requester_inter.created_at.isoformat() if latest_requester_inter.created_at else None,
        }

    return {
        "latest_ticket_id": latest_ticket_id,
        "latest_critical_ticket_id": latest_critical_ticket_id,
        "latest_ticket_info": latest_ticket_info,
        "latest_client_interaction_id": latest_client_interaction_id,
        "latest_requester_activity": latest_requester_activity,
        "kpis": {
            "latest_ticket_id": latest_ticket_id,
            "latest_critical_ticket_id": latest_critical_ticket_id,
            "latest_client_interaction_id": latest_client_interaction_id,
            "total_open": total_open,
            "total_abertos": total_open,
            "new_count": new_count,
            "novos": new_count,
            "in_progress_count": in_progress_count,
            "em_andamento": in_progress_count,
            "pending_validation_count": pending_validation_count,
            "aguardando_validacao": pending_validation_count,
            "unassigned_count": unassigned_count,
            "sem_tecnico": unassigned_count,
            "critical_count": critical_count,
            "criticos": critical_count,
            "sla_ok_count": sla_ok_count,
            "sla_warning_count": sla_warning_count,
            "sla_alerta_count": sla_warning_count,
            "sla_breached_count": sla_breached_count,
            "sla_estourado_count": sla_breached_count,
            "compliance_rate": compliance_rate,
            "sla_cumprido_pct": compliance_rate,
            "mttr_minutes": mttr_minutes,
            "tempo_medio_resolucao_horas": round(mttr_minutes / 60, 1),
            "period_days": period_days,
            "csat_average_rating": csat_average_rating,
            "csat_satisfaction_pct": csat_satisfaction_pct,
            "csat_answered_count": csat_answered_count,
            "taxa_satisfacao_pct": csat_satisfaction_pct,
            "media_estrelas_csat": csat_average_rating,
        },
        "csat": {
            "average_rating": csat_average_rating,
            "satisfaction_pct": csat_satisfaction_pct,
            "answered_count": csat_answered_count,
        },
        "urgent_queue": urgent_queue,
        "technicians_load": tech_stats,
        "technician_workload": tech_stats,
        "top_sectors": top_sectors,
        "department_stats": top_sectors,
        "sla_config": {
            "calc_business_hours": config.calc_business_hours,
            "business_start_time": config.business_start_time,
            "business_end_time": config.business_end_time,
            "business_days": config.business_days,
            "enable_category_sla": config.enable_category_sla,
            "critical_resolution_min": config.critical_resolution_min,
            "high_resolution_min": config.high_resolution_min,
            "medium_resolution_min": config.medium_resolution_min,
            "low_resolution_min": config.low_resolution_min,
        },
        "updated_at": now_dt.isoformat(),
    }
