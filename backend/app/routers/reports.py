"""
Router Reports — Central de Relatórios Analíticos e Executivos do TIHFSA.
Consolida métricas e relatórios gerenciais de:
1. Chamados & SLA (Helpdesk / Service Desk)
2. Ativos & CMDB (Inventário Patrimonial)
3. Desempenho de Máquinas (Telemetria do Agente TIHFSA)
4. Quedas & Flapping de Rede (Zabbix & UniFi)
"""
from datetime import datetime, timezone, timedelta, date
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_, and_

from app.database import get_db
from app.auth.dependencies import get_current_user, require_module
from app.models.user import User
from app.models.ticket import Ticket, TicketStatus, TicketPriority
from app.models.ticket_interaction import TicketInteraction
from app.models.satisfaction_survey import TicketSatisfactionSurvey
from app.models.asset import Asset
from app.models.asset_type import AssetTypeModel
from app.models.department import Department
from app.models.location import Location
from app.models.problem_type import ProblemType
from app.models.category import Category
from app.models.monitoring import AgentCheckin, AgentMetricsHistory, NetworkOutageEvent
from app.models.system_setting import SystemSetting
from app.services.zabbix_service import ZabbixService

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])


def _parse_date_range(start_date: Optional[str], end_date: Optional[str]):
    """Auxiliar para converter strings ISO para datetime UTC com início e fim do dia."""
    tz_br = timezone(timedelta(hours=-3))
    now = datetime.now(tz_br)

    if not start_date or not isinstance(start_date, str):
        # Padrão: 1º dia do mês corrente até hoje
        start_dt = datetime(now.year, now.month, 1, 0, 0, 0, tzinfo=tz_br).astimezone(timezone.utc)
    else:
        try:
            d = datetime.strptime(start_date, "%Y-%m-%d")
            start_dt = datetime(d.year, d.month, d.day, 0, 0, 0, tzinfo=tz_br).astimezone(timezone.utc)
        except (ValueError, TypeError):
            start_dt = datetime(now.year, now.month, 1, 0, 0, 0, tzinfo=tz_br).astimezone(timezone.utc)

    if not end_date or not isinstance(end_date, str):
        end_dt = datetime(now.year, now.month, now.day, 23, 59, 59, 999999, tzinfo=tz_br).astimezone(timezone.utc)
    else:
        try:
            d = datetime.strptime(end_date, "%Y-%m-%d")
            end_dt = datetime(d.year, d.month, d.day, 23, 59, 59, 999999, tzinfo=tz_br).astimezone(timezone.utc)
        except (ValueError, TypeError):
            end_dt = datetime(now.year, now.month, now.day, 23, 59, 59, 999999, tzinfo=tz_br).astimezone(timezone.utc)

    return start_dt, end_dt


# ─────────────────────────────────────────────────────────────────────────────
# 1. RELATÓRIO DE CHAMADOS & SLA
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/tickets")
def get_tickets_report(
    start_date: Optional[str] = Query(None, description="Data inicial YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Data final YYYY-MM-DD"),
    department_id: Optional[int] = None,
    technician_id: Optional[int] = None,
    problem_type_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_module("reports")),
):
    """
    Relatório analítico e consolidado de chamados:
    Volumes, TMA, TMPR, taxa de resolução, cumprimento de SLA, CSAT e produtividade técnica.
    """
    from app.services.sla_service import get_or_create_sla_config, get_sla_target_minutes

    start_dt, end_dt = _parse_date_range(start_date, end_date)
    sla_config = get_or_create_sla_config(db)

    query = db.query(Ticket).filter(
        Ticket.created_at >= start_dt,
        Ticket.created_at <= end_dt,
    )

    if technician_id:
        query = query.filter(Ticket.technician_id == technician_id)
    if problem_type_id:
        query = query.filter(Ticket.problem_type_id == problem_type_id)
    if status_filter:
        query = query.filter(Ticket.status == status_filter)
    if department_id:
        query = query.filter(
            or_(
                Ticket.requester.has(User.department_id == department_id),
                Ticket.asset.has(Asset.department_id == department_id),
            )
        )

    tickets = query.order_by(Ticket.created_at.desc()).all()

    total_tickets = len(tickets)
    solved_count = 0
    closed_count = 0
    in_progress_count = 0
    pending_validation_count = 0
    new_count = 0
    cancelled_count = 0

    tma_durations = []  # Tempo de atendimento em minutos
    sla_on_time_count = 0
    sla_breached_count = 0

    # Dicionários de agrupamento
    by_department = {}
    by_problem_type = {}
    by_technician = {}
    by_priority = {
        "Baixa": 0,
        "Média": 0,
        "Alta": 0,
        "Crítica": 0,
    }
    by_day_map = {}

    analytic_rows = []

    for t in tickets:
        # Status counts
        st = t.status.value if hasattr(t.status, "value") else str(t.status)
        prio = t.priority.value if hasattr(t.priority, "value") else str(t.priority)

        if prio in by_priority:
            by_priority[prio] += 1
        elif "baixa" in prio.lower():
            by_priority["Baixa"] += 1
        elif "méd" in prio.lower() or "med" in prio.lower():
            by_priority["Média"] += 1
        elif "alta" in prio.lower():
            by_priority["Alta"] += 1
        elif "crít" in prio.lower() or "crit" in prio.lower():
            by_priority["Crítica"] += 1

        if st in [TicketStatus.CLOSED.value, "Fechado", "Resolvido", "SOLVED"]:
            closed_count += 1
        elif st in [TicketStatus.PENDING_VALIDATION.value, "Aguardando Validação"]:
            pending_validation_count += 1
        elif st in [TicketStatus.IN_PROGRESS.value, "Em Andamento"]:
            in_progress_count += 1
        elif st in [TicketStatus.NEW.value, "Novo", "OPEN"]:
            new_count += 1
        elif st in [TicketStatus.REJECTED.value, "Rejeitado", "Cancelado"]:
            cancelled_count += 1

        # Cálculo de TMA para chamados resolvidos/fechados
        resolution_time = t.solved_at or t.closed_at
        duration_minutes = None
        if resolution_time and t.created_at:
            duration_minutes = max(0, int((resolution_time - t.created_at).total_seconds() / 60))
            tma_durations.append(duration_minutes)

        # Cálculo de SLA
        target_resp, target_res = get_sla_target_minutes(t.priority, t.category_id, sla_config, {})
        is_breached = False
        if duration_minutes is not None and target_res:
            is_breached = duration_minutes > target_res
        elif not resolution_time and t.created_at and target_res:
            elapsed_now = max(0, int((datetime.now(timezone.utc) - t.created_at).total_seconds() / 60))
            is_breached = elapsed_now > target_res

        if is_breached:
            sla_breached_count += 1
        else:
            sla_on_time_count += 1

        # Agrupamento por dia de criação para linha do tempo
        day_key = t.created_at.strftime("%Y-%m-%d")
        if day_key not in by_day_map:
            by_day_map[day_key] = {"date": day_key, "opened": 0, "solved": 0}
        by_day_map[day_key]["opened"] += 1
        if resolution_time:
            by_day_map[day_key]["solved"] += 1

        # Agrupamento por Departamento
        dept_name = "Não Definido"
        if t.requester and getattr(t.requester, "department", None):
            dept_name = t.requester.department.name
        elif t.asset and getattr(t.asset, "department", None):
            dept_name = t.asset.department.name
        by_department[dept_name] = by_department.get(dept_name, 0) + 1

        # Agrupamento por Tipo de Problema
        prob_name = t.problem_type.name if t.problem_type else "Outros / Geral"
        by_problem_type[prob_name] = by_problem_type.get(prob_name, 0) + 1

        # Agrupamento por Técnico
        tech_name = t.technician.display_name if t.technician else "Não Atribuído"
        tech_id = t.technician_id or 0
        if tech_name not in by_technician:
            by_technician[tech_name] = {
                "technician_id": tech_id,
                "name": tech_name,
                "total_assigned": 0,
                "solved": 0,
                "total_minutes": 0,
            }
        by_technician[tech_name]["total_assigned"] += 1
        if st in [TicketStatus.CLOSED.value, "Fechado", "Resolvido", "Aguardando Validação"]:
            by_technician[tech_name]["solved"] += 1
            if duration_minutes:
                by_technician[tech_name]["total_minutes"] += duration_minutes

        loc_name = None
        if t.asset and getattr(t.asset, "location", None):
            loc_name = t.asset.location.name
        elif t.requester and getattr(t.requester, "location", None):
            loc_name = t.requester.location.name

        analytic_rows.append({
            "id": t.id,
            "title": t.title,
            "status": st,
            "priority": prio,
            "department": dept_name,
            "location": loc_name,
            "requester": t.requester.display_name if t.requester else "Anônimo",
            "technician": tech_name,
            "problem_type": prob_name,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "solved_at": resolution_time.isoformat() if resolution_time else None,
            "duration_minutes": duration_minutes,
            "sla_breached": is_breached,
        })

    # Resumo de CSAT no período
    surveys = db.query(TicketSatisfactionSurvey).join(Ticket).filter(
        Ticket.created_at >= start_dt,
        Ticket.created_at <= end_dt,
    ).all()

    valid_ratings = [s.rating for s in surveys if s.rating is not None]
    csat_total = len(valid_ratings)
    csat_avg = round(sum(valid_ratings) / csat_total, 2) if csat_total > 0 else 5.0

    # Indicadores consolidados
    avg_tma_minutes = int(sum(tma_durations) / len(tma_durations)) if tma_durations else 0
    completed_total = solved_count + closed_count
    resolution_rate_pct = round((completed_total / total_tickets * 100), 1) if total_tickets > 0 else 0.0
    sla_compliance_pct = round((sla_on_time_count / total_tickets * 100), 1) if total_tickets > 0 else 100.0

    # Formatar técnicos com TMA individual
    technicians_list = []
    for tech_name, data in by_technician.items():
        tech_tma = int(data["total_minutes"] / data["solved"]) if data["solved"] > 0 else 0
        technicians_list.append({
            "name": tech_name,
            "total_assigned": data["total_assigned"],
            "solved": data["solved"],
            "avg_tma_minutes": tech_tma,
        })
    technicians_list.sort(key=lambda x: x["solved"], reverse=True)

    # Ordenar departamentos e problemas por volume
    departments_ranked = [{"name": k, "count": v} for k, v in sorted(by_department.items(), key=lambda i: i[1], reverse=True)]
    problems_ranked = [{"name": k, "count": v} for k, v in sorted(by_problem_type.items(), key=lambda i: i[1], reverse=True)]
    timeline_data = [by_day_map[k] for k in sorted(by_day_map.keys())]

    return {
        "period": {
            "start_date": start_dt.strftime("%Y-%m-%d"),
            "end_date": end_dt.strftime("%Y-%m-%d"),
        },
        "summary": {
            "total_tickets": total_tickets,
            "solved_count": solved_count,
            "closed_count": closed_count,
            "completed_total": completed_total,
            "in_progress_count": in_progress_count,
            "pending_validation_count": pending_validation_count,
            "new_count": new_count,
            "cancelled_count": cancelled_count,
            "resolution_rate_pct": resolution_rate_pct,
            "avg_tma_minutes": avg_tma_minutes,
            "sla_compliance_pct": sla_compliance_pct,
            "sla_on_time_count": sla_on_time_count,
            "sla_breached_count": sla_breached_count,
            "csat_average": csat_avg,
            "csat_total_surveys": csat_total,
        },
        "by_priority": by_priority,
        "timeline": timeline_data,
        "ranking_departments": departments_ranked,
        "ranking_problem_types": problems_ranked,
        "ranking_technicians": technicians_list,
        "analytic_data": analytic_rows,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. RELATÓRIO DE ATIVOS & CMDB
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/assets")
def get_assets_report(
    department_id: Optional[int] = None,
    category_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_module("reports")),
):
    """
    Relatório analítico e consolidado do inventário patrimonial (CMDB):
    Distribuição por tipo de equipamento, departamentos, saúde das garantias e ativos problemáticos.
    """
    query = db.query(Asset)

    if department_id:
        query = query.filter(Asset.assigned_user.has(User.department_id == department_id))
    if category_id:
        query = query.filter(Asset.category_id == category_id)

    assets = query.all()
    today = date.today()

    total_assets = len(assets)
    total_purchase_value = 0.0
    active_count = 0
    inactive_count = 0
    by_type = {}
    by_department = {}
    by_location = {}

    warranty_expired = 0
    warranty_expiring_30 = 0
    warranty_expiring_90 = 0
    warranty_active = 0
    warranty_unknown = 0

    analytic_rows = []

    # Mapear chamados por ativo para achar os ativos mais problemáticos
    asset_ticket_counts = dict(
        db.query(Ticket.asset_id, func.count(Ticket.id))
        .filter(Ticket.asset_id.isnot(None))
        .group_by(Ticket.asset_id)
        .all()
    )

    for a in assets:
        st = "Ativo" if a.is_active else "Inativo"
        if a.is_active:
            active_count += 1
        else:
            inactive_count += 1

        # Extrair specs adicionais (garantia, valor de compra)
        specs = a.specs if isinstance(a.specs, dict) else {}
        price = 0.0
        try:
            if "purchase_price" in specs:
                price = float(specs["purchase_price"])
            elif "valor" in specs:
                price = float(specs["valor"])
        except (ValueError, TypeError):
            price = 0.0
        total_purchase_value += price

        # Tipo / Categoria
        type_name = a.type or (a.category.name if a.category else "Geral")
        by_type[type_name] = by_type.get(type_name, 0) + 1

        # Departamento
        dept_name = "Não Atribuído"
        if a.assigned_user and getattr(a.assigned_user, "department", None):
            dept_name = a.assigned_user.department.name
        by_department[dept_name] = by_department.get(dept_name, 0) + 1

        # Localização Física
        loc_name = a.location.name if a.location else "Sem Local"
        by_location[loc_name] = by_location.get(loc_name, 0) + 1

        # Garantia (extraída de specs se existir)
        w_status = "Sem Garantia"
        w_date_str = specs.get("warranty_expires_at") or specs.get("garantia")
        if w_date_str and isinstance(w_date_str, str):
            try:
                w_date = datetime.strptime(w_date_str.split("T")[0], "%Y-%m-%d").date()
                days_left = (w_date - today).days

                if days_left < 0:
                    warranty_expired += 1
                    w_status = "Expirada"
                elif days_left <= 30:
                    warranty_expiring_30 += 1
                    w_status = "Vence em 30 dias"
                elif days_left <= 90:
                    warranty_expiring_90 += 1
                    w_status = "Vence em 90 dias"
                else:
                    warranty_active += 1
                    w_status = "Válida"
            except (ValueError, TypeError):
                warranty_unknown += 1
        else:
            warranty_unknown += 1

        ticket_count = asset_ticket_counts.get(a.id, 0)

        analytic_rows.append({
            "id": a.id,
            "name": a.name,
            "tag": a.asset_tag,
            "serial_number": a.serial_number,
            "category": type_name,
            "brand": a.brand,
            "model": a.model,
            "department": dept_name,
            "location": loc_name,
            "status": st,
            "ip_address": a.ip_address,
            "mac_address": a.mac_address,
            "warranty_status": w_status,
            "warranty_expires_at": w_date_str,
            "purchase_price": price,
            "ticket_count": ticket_count,
        })

    # Top Ativos Problemáticos (ordenados por chamados)
    problematic_assets = sorted(
        [r for r in analytic_rows if r["ticket_count"] > 0],
        key=lambda x: x["ticket_count"],
        reverse=True,
    )[:10]

    ranking_types = [{"name": k, "count": v} for k, v in sorted(by_type.items(), key=lambda i: i[1], reverse=True)]
    ranking_depts = [{"name": k, "count": v} for k, v in sorted(by_department.items(), key=lambda i: i[1], reverse=True)]

    return {
        "summary": {
            "total_assets": total_assets,
            "in_use_count": active_count,
            "maintenance_count": 0,
            "available_count": inactive_count,
            "discarded_count": 0,
            "total_purchase_value": round(total_purchase_value, 2),
            "warranty_expired": warranty_expired,
            "warranty_expiring_30": warranty_expiring_30,
            "warranty_expiring_90": warranty_expiring_90,
            "warranty_active": warranty_active,
            "warranty_unknown": warranty_unknown,
        },
        "by_category": ranking_types,
        "by_department": ranking_depts,
        "problematic_assets": problematic_assets,
        "analytic_data": analytic_rows,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. RELATÓRIO DE DESEMPENHO DE MÁQUINAS (TELEMETRIA DO AGENTE)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/hardware-performance")
def get_hardware_performance_report(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_module("reports")),
):
    """
    Relatório consolidado de telemetria e integridade das máquinas:
    Detecção de gargalos crônicos de CPU/RAM, falta de espaço em C:, recomendações de upgrade e uptime contínuo.
    """
    checkins = db.query(AgentCheckin).all()
    now_utc = datetime.now(timezone.utc)

    total_machines = len(checkins)
    online_count = 0
    warning_count = 0
    offline_count = 0

    cpu_critical_count = 0  # > 80%
    ram_critical_count = 0  # > 85%
    disk_critical_count = 0  # C: com < 15GB livres ou > 90% usado

    upgrade_recommendations = []
    analytic_rows = []

    for c in checkins:
        is_online = c.is_online
        if is_online:
            online_count += 1
        else:
            offline_count += 1

        cpu = c.cpu_usage_pct or 0
        ram_pct = c.ram_usage_pct or 0.0
        ram_total_gb = round((c.ram_total_mb or 0) / 1024, 1)
        ram_used_gb = round((c.ram_used_mb or 0) / 1024, 1)

        # Analisar disco principal C:
        primary_drive = None
        c_drive_free_gb = 999.0
        c_drive_used_pct = 0.0
        if c.disk_metrics and isinstance(c.disk_metrics, list):
            for d in c.disk_metrics:
                if d.get("drive", "").upper().startswith("C"):
                    primary_drive = d
                    c_drive_free_gb = float(d.get("free_gb", 999.0))
                    c_drive_used_pct = float(d.get("used_pct", 0.0))
                    break

        # Regras de Alerta
        alerts = []
        if cpu >= 80:
            cpu_critical_count += 1
            alerts.append(f"Uso de CPU elevado ({cpu}%)")
        if ram_pct >= 85:
            ram_critical_count += 1
            alerts.append(f"Memória RAM saturada ({ram_pct}% de {ram_total_gb}GB)")
        if c_drive_free_gb <= 15.0 or c_drive_used_pct >= 90.0:
            disk_critical_count += 1
            alerts.append(f"Disco C: crítico ({c_drive_free_gb:.1f}GB livres)")

        # Recomendações de Upgrade
        recommendations = []
        if ram_total_gb <= 8.0 and (ram_pct >= 80 or ram_total_gb < 8.0):
            recommendations.append("Upgrade de Memória RAM recomendado (mínimo 16GB para padrão corporativo)")
        if c_drive_free_gb < 15.0:
            recommendations.append("Limpeza de arquivos temporários ou expansão de SSD (C: abaixo de 15GB livres)")
        if (c.uptime_hours or 0) > 360:  # > 15 dias
            recommendations.append(f"Reinicialização preventiva necessária (Ligado há {int(c.uptime_hours / 24)} dias)")

        if recommendations:
            upgrade_recommendations.append({
                "hostname": c.hostname,
                "logged_user": c.logged_user or "N/A",
                "ip_address": c.ip_address,
                "ram_total_gb": ram_total_gb,
                "ram_used_pct": ram_pct,
                "disk_free_gb": c_drive_free_gb,
                "uptime_days": round((c.uptime_hours or 0) / 24, 1),
                "recommendations": recommendations,
            })

        analytic_rows.append({
            "id": c.id,
            "hostname": c.hostname,
            "logged_user": c.logged_user,
            "ip_address": c.ip_address,
            "os_name": c.os_name,
            "status": "online" if is_online else "offline",
            "cpu_usage_pct": cpu,
            "ram_total_gb": ram_total_gb,
            "ram_used_gb": ram_used_gb,
            "ram_usage_pct": ram_pct,
            "disk_c_free_gb": c_drive_free_gb if c_drive_free_gb != 999.0 else None,
            "disk_c_used_pct": c_drive_used_pct,
            "uptime_hours": c.uptime_hours,
            "uptime_days": round((c.uptime_hours or 0) / 24, 1) if c.uptime_hours else 0,
            "last_seen_at": c.last_seen_at.isoformat() if c.last_seen_at else None,
            "alerts": alerts,
        })

    # Top CPU e Top RAM
    top_cpu = sorted([r for r in analytic_rows if r["status"] == "online"], key=lambda x: x["cpu_usage_pct"], reverse=True)[:10]
    top_ram = sorted([r for r in analytic_rows if r["status"] == "online"], key=lambda x: x["ram_usage_pct"], reverse=True)[:10]

    return {
        "summary": {
            "total_machines": total_machines,
            "online_count": online_count,
            "offline_count": offline_count,
            "cpu_critical_count": cpu_critical_count,
            "ram_critical_count": ram_critical_count,
            "disk_critical_count": disk_critical_count,
            "upgrade_needed_count": len(upgrade_recommendations),
        },
        "top_cpu": top_cpu,
        "top_ram": top_ram,
        "upgrade_recommendations": upgrade_recommendations,
        "analytic_data": analytic_rows,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. RELATÓRIO DE QUEDAS & FLAPPING (ZABBIX & UNIFI)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/outages")
def get_outages_report(
    start_date: Optional[str] = Query(None, description="Data inicial YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Data final YYYY-MM-DD"),
    source: Optional[str] = Query(None, description="'unifi', 'zabbix' ou None para todos"),
    min_duration_seconds: Optional[int] = Query(0, description="Tolerância mínima em segundos para descartar micro-oscilações (ex: 120s)"),
    status_filter: Optional[str] = Query(None, description="'ongoing', 'resolved' ou None para todos"),
    db: Session = Depends(get_db),
    _: User = Depends(require_module("reports")),
):
    """
    Relatório detalhado de indisponibilidades de rede (Zabbix e UniFi):
    Tempo total offline, ranking de dispositivos que mais caem (Top Flapping),
    frequência de oscilações e cálculo de disponibilidade (SLA de Uptime %).
    """
    # Acionar sincronizador do Zabbix para atualizar qualquer trigger aberta/fechada recente
    try:
        ZabbixService.sync_outages(db)
    except Exception as e:
        print(f"[Reports Outages] Aviso ao sincronizar Zabbix: {e}")

    start_dt, end_dt = _parse_date_range(start_date, end_date)

    base_query = db.query(NetworkOutageEvent).filter(
        NetworkOutageEvent.started_at >= start_dt,
        NetworkOutageEvent.started_at <= end_dt,
    )

    # Tolerância configurável: apenas eventos com duração >= min_duration_seconds (ou ongoing)
    if isinstance(min_duration_seconds, (int, float)) and min_duration_seconds > 0:
        base_query = base_query.filter(
            or_(
                NetworkOutageEvent.duration_seconds >= int(min_duration_seconds),
                NetworkOutageEvent.status == "ongoing",
            )
        )

    # 1. Pré-cálculo global de UniFi e Zabbix em todo o período (para alimentar contadores e comparativos)
    all_period_outages = base_query.all()
    period_total_seconds = max(1, int((end_dt - start_dt).total_seconds()))
    now_utc = datetime.now(timezone.utc)

    unifi_downtime_seconds = 0
    unifi_events = 0
    unifi_devices = set()

    zabbix_downtime_seconds = 0
    zabbix_events = 0
    zabbix_devices = set()

    for ev in all_period_outages:
        dur = max(1, int((now_utc - ev.started_at).total_seconds())) if ev.status == "ongoing" else (ev.duration_seconds or 0)
        ev_src = (ev.source or "").lower()
        if ev_src == "unifi":
            unifi_events += 1
            unifi_downtime_seconds += dur
            unifi_devices.add(ev.device_identifier)
        elif ev_src == "zabbix":
            zabbix_events += 1
            zabbix_downtime_seconds += dur
            zabbix_devices.add(ev.device_identifier)

    unifi_dev_count = max(1, len(unifi_devices))
    unifi_expected = period_total_seconds * unifi_dev_count
    unifi_sla_pct = max(0.0, round(((unifi_expected - unifi_downtime_seconds) / unifi_expected) * 100, 3)) if unifi_events > 0 else 100.0

    zabbix_dev_count = max(1, len(zabbix_devices))
    zabbix_expected = period_total_seconds * zabbix_dev_count
    zabbix_sla_pct = max(0.0, round(((zabbix_expected - zabbix_downtime_seconds) / zabbix_expected) * 100, 3)) if zabbix_events > 0 else 100.0

    # 2. Filtragem específica para tabela e ranking solicitados
    query = base_query
    if isinstance(source, str) and source.lower() != "all":
        query = query.filter(NetworkOutageEvent.source == source.lower())

    if isinstance(status_filter, str) and status_filter.lower() != "all":
        query = query.filter(NetworkOutageEvent.status == status_filter.lower())

    outages = query.order_by(NetworkOutageEvent.started_at.desc()).all()

    total_events = len(outages)
    total_downtime_seconds = 0
    resolved_count = 0
    ongoing_count = 0

    device_flapping_map = {}
    analytic_rows = []

    for ev in outages:
        is_ongoing = ev.status == "ongoing"
        if is_ongoing:
            ongoing_count += 1
            # Para eventos em andamento, calcula tempo decorrido até agora
            now_utc = datetime.now(timezone.utc)
            duration = max(1, int((now_utc - ev.started_at).total_seconds()))
        else:
            resolved_count += 1
            duration = ev.duration_seconds or 0

        total_downtime_seconds += duration

        # Agrupamento para ranking de Flapping (quem mais cai)
        dev_key = ev.device_identifier
        if dev_key not in device_flapping_map:
            device_flapping_map[dev_key] = {
                "device_identifier": dev_key,
                "device_name": ev.device_name,
                "source": ev.source,
                "ip_address": ev.ip_address,
                "mac_address": ev.mac_address,
                "device_type": ev.device_type,
                "outage_count": 0,
                "total_downtime_seconds": 0,
                "last_outage_at": ev.started_at.isoformat(),
            }
        device_flapping_map[dev_key]["outage_count"] += 1
        device_flapping_map[dev_key]["total_downtime_seconds"] += duration

        analytic_rows.append({
            "id": ev.id,
            "source": ev.source.upper(),
            "device_name": ev.device_name,
            "ip_address": ev.ip_address,
            "mac_address": ev.mac_address,
            "device_type": ev.device_type,
            "started_at": ev.started_at.isoformat() if ev.started_at else None,
            "ended_at": ev.ended_at.isoformat() if ev.ended_at else None,
            "duration_seconds": duration,
            "duration_formatted": _format_duration(duration),
            "status": ev.status,
            "trigger_reason": ev.trigger_reason,
        })

    # Ranking de Top Flapping Devices (ordenado por quantidade de quedas)
    top_flapping = sorted(
        device_flapping_map.values(),
        key=lambda x: (x["outage_count"], x["total_downtime_seconds"]),
        reverse=True,
    )
    for dev in top_flapping:
        dev["total_downtime_formatted"] = _format_duration(dev["total_downtime_seconds"])
        dev["avg_downtime_seconds"] = int(dev["total_downtime_seconds"] / dev["outage_count"]) if dev["outage_count"] > 0 else 0
        dev["avg_downtime_formatted"] = _format_duration(dev["avg_downtime_seconds"])

    # Cálculo do período total em segundos para estimar Uptime SLA (%)
    period_total_seconds = max(1, int((end_dt - start_dt).total_seconds()))
    unique_devices_count = max(1, len(device_flapping_map))
    total_expected_device_seconds = period_total_seconds * unique_devices_count
    uptime_sla_pct = max(0.0, round(((total_expected_device_seconds - total_downtime_seconds) / total_expected_device_seconds) * 100, 3))

    avg_outage_seconds = int(total_downtime_seconds / total_events) if total_events > 0 else 0

    return {
        "period": {
            "start_date": start_dt.strftime("%Y-%m-%d"),
            "end_date": end_dt.strftime("%Y-%m-%d"),
            "min_duration_seconds": min_duration_seconds,
            "source": source or "all",
        },
        "summary": {
            "total_outage_events": total_events,
            "unique_affected_devices": len(device_flapping_map),
            "ongoing_count": ongoing_count,
            "resolved_count": resolved_count,
            "total_downtime_seconds": total_downtime_seconds,
            "total_downtime_formatted": _format_duration(total_downtime_seconds),
            "avg_outage_seconds": avg_outage_seconds,
            "avg_outage_formatted": _format_duration(avg_outage_seconds),
            "estimated_uptime_sla_pct": uptime_sla_pct,
            "unifi": {
                "events_count": unifi_events,
                "affected_devices": len(unifi_devices),
                "downtime_seconds": unifi_downtime_seconds,
                "downtime_formatted": _format_duration(unifi_downtime_seconds),
                "sla_pct": unifi_sla_pct,
            },
            "zabbix": {
                "events_count": zabbix_events,
                "affected_devices": len(zabbix_devices),
                "downtime_seconds": zabbix_downtime_seconds,
                "downtime_formatted": _format_duration(zabbix_downtime_seconds),
                "sla_pct": zabbix_sla_pct,
            },
        },
        "top_flapping_devices": top_flapping[:20],
        "timeline_events": analytic_rows,
    }


def _format_duration(seconds: int) -> str:
    """Formata segundos em texto amigável (ex: '2h 15m 30s' ou '4m 12s')."""
    if seconds is None or seconds <= 0:
        return "0s"
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60

    parts = []
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0 or hours > 0:
        parts.append(f"{minutes}m")
    if secs > 0 or not parts:
        parts.append(f"{secs}s")
    return " ".join(parts)
