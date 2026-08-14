"""
Router Zabbix — alertas de monitoramento, NOC e geração automática/manual de chamados.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import get_current_user, require_technician
from app.models.user import User, UserRole
from app.models.asset import Asset
from app.models.ticket import Ticket, TicketStatus, TicketPriority
from app.services.zabbix_service import ZabbixService

router = APIRouter(prefix="/api/v1/zabbix", tags=["Zabbix"])


def _map_zabbix_severity_to_priority(severity: str) -> TicketPriority:
    s = severity.lower()
    if s in ["disaster", "high"]:
        return TicketPriority.URGENT
    if s in ["average", "warning"]:
        return TicketPriority.HIGH
    return TicketPriority.MEDIUM


def _get_or_create_zabbix_system_user(db: Session) -> User:
    """Busca ou cria o usuário de sistema 'Sistema Zabbix NOC' para ser o solicitante de chamados automáticos."""
    system_user = db.query(User).filter(
        (User.ad_username == "zabbix.system") | (User.email == "noc@tihfsa.local")
    ).first()

    if not system_user:
        system_user = User(
            ad_username="zabbix.system",
            email="noc@tihfsa.local",
            display_name="Sistema Zabbix NOC",
            password_hash="N/A",
            role=UserRole.ADMIN,
            roles=["admin"],
            is_active=True,
        )
        db.add(system_user)
        db.commit()
        db.refresh(system_user)

    return system_user


@router.get("/alerts")
def list_zabbix_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna apenas alertas do Zabbix cujos hosts foram importados para o CMDB do TIHFSA.
    Gera um chamado automático associado ao usuário de sistema 'Sistema Zabbix NOC' caso não exista um em aberto.
    """
    try:
        raw_problems = ZabbixService.get_active_triggers_with_hosts()
        total_zabbix_problems = len(raw_problems)

        # Buscar todos os ativos importados no CMDB com IP ou Nome
        imported_assets = db.query(Asset).filter(Asset.is_active == True).all()

        # Mapeadores por IP e Nome (case-insensitive) - Apenas ativos COM IP podem gerar alertas de rede!
        asset_by_ip = {a.ip_address.strip(): a for a in imported_assets if a.ip_address and a.ip_address.strip()}
        asset_by_name = {a.name.strip().lower(): a for a in imported_assets if a.name and a.name.strip() and a.ip_address and a.ip_address.strip()}

        filtered_alerts = []
        noc_system_user = _get_or_create_zabbix_system_user(db)

        for prob in raw_problems:
            trigger_id = prob["trigger_id"]
            event_title = prob["name"]
            severity = prob["severity"]
            clock = prob["clock"]
            hosts = prob.get("hosts", [])

            matched_asset = None
            for h in hosts:
                h_name = (h.get("name") or h.get("host") or "").strip()
                h_ip = (h.get("ip") or "").strip()

                if h_ip and h_ip in asset_by_ip:
                    matched_asset = asset_by_ip[h_ip]
                    break
                if h_name and h_name.lower() in asset_by_name:
                    matched_asset = asset_by_name[h_name.lower()]
                    break

            # Se o alerta pertence a um ativo cadastrado no TIHFSA:
            if matched_asset:
                ticket_tag = f"[Zabbix #{trigger_id}]"

                # Verificar se já existe chamado em aberto para este evento/ativo
                existing_ticket = (
                    db.query(Ticket)
                    .filter(
                        Ticket.asset_id == matched_asset.id,
                        Ticket.title.contains(ticket_tag),
                        Ticket.status.in_([
                            TicketStatus.NEW,
                            TicketStatus.IN_PROGRESS,
                            TicketStatus.PENDING_VALIDATION,
                        ])
                    )
                    .first()
                )

                # Se NÃO existe chamado aberto para este alerta do ativo, CRIAR AUTOMATICAMENTE via Sistema Zabbix NOC!
                if not existing_ticket:
                    prio = _map_zabbix_severity_to_priority(severity)
                    new_ticket = Ticket(
                        title=f"{ticket_tag} {matched_asset.name} - {event_title}",
                        description=(
                            f"Chamado gerado automaticamente pelo NOC via Monitoramento Zabbix.\n\n"
                            f"Equipamento: {matched_asset.name}\n"
                            f"IP: {matched_asset.ip_address or 'N/A'}\n"
                            f"Alerta: {event_title}\n"
                            f"Severidade Zabbix: {severity}\n"
                            f"ID do Evento: {trigger_id}"
                        ),
                        status=TicketStatus.NEW,
                        priority=prio,
                        requester_id=noc_system_user.id,
                        asset_id=matched_asset.id,
                        category_id=matched_asset.category_id,
                        subcategory_id=matched_asset.subcategory_id,
                    )
                    db.add(new_ticket)
                    db.commit()
                    db.refresh(new_ticket)
                    existing_ticket = new_ticket

                filtered_alerts.append({
                    "eventid": trigger_id,
                    "name": event_title,
                    "severity": severity,
                    "clock": clock,
                    "host": matched_asset.name,
                    "host_ip": matched_asset.ip_address,
                    "asset_id": matched_asset.id,
                    "category_id": matched_asset.category_id,
                    "ticket_id": existing_ticket.id if existing_ticket else None,
                    "ticket_status": existing_ticket.status.value if existing_ticket else None,
                })

        return {
            "alerts": filtered_alerts,
            "count": len(filtered_alerts),
            "total_zabbix_problems": total_zabbix_problems
        }
    except Exception as e:
        print(f"[Zabbix Router Erro] {e}")
        return {"alerts": [], "count": 0, "error": str(e)}


@router.get("/hosts")
def get_hosts(
    _: User = Depends(get_current_user),
):
    """Retorna hosts monitorados pelo Zabbix."""
    try:
        hosts = ZabbixService.get_hosts()
        return {"hosts": hosts, "count": len(hosts)}
    except Exception as e:
        return {"hosts": [], "count": 0, "error": str(e)}


@router.post("/alerts/{event_id}/create-ticket")
def create_ticket_from_alert(
    event_id: str,
    title: str,
    description: str | None = None,
    asset_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
):
    """
    Cria ou recupera um chamado a partir de um alerta do Zabbix (Manual).
    Vincular o solicitante ao Sistema Zabbix NOC e atribuir o técnico atual.
    """
    ticket_tag = f"[Zabbix #{event_id}]"
    existing = db.query(Ticket).filter(Ticket.title.contains(ticket_tag)).first()
    if existing:
        return existing

    matched_asset = None
    if asset_id:
        matched_asset = db.query(Asset).filter(Asset.id == asset_id).first()

    noc_system_user = _get_or_create_zabbix_system_user(db)

    ticket = Ticket(
        title=f"{ticket_tag} {title}",
        description=description or f"Chamado gerado a partir do alerta Zabbix (Evento: {event_id})",
        status=TicketStatus.NEW,
        priority=TicketPriority.HIGH,
        requester_id=noc_system_user.id,
        technician_id=current_user.id,
        asset_id=matched_asset.id if matched_asset else None,
        category_id=matched_asset.category_id if matched_asset else None,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("/public-noc")
def get_public_noc_data(
    location_id: int | None = None,
    type: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    """Endpoint público para exibição do Painel NOC em TVs e Monitores (sem necessidade de login)."""
    try:
        from app.models.location import Location
        from app.models.asset_type import AssetTypeModel
        from app.routers.assets import _format_asset_response, _enrich_assets_with_zabbix_status

        query = db.query(Asset).filter(Asset.is_active == True)  # noqa: E712
        if location_id:
            query = query.filter(Asset.location_id == location_id)
        if type and type != "Todos":
            query = query.filter(Asset.type == type)

        assets = query.order_by(Asset.name).all()
        formatted = [_format_asset_response(a) for a in assets]
        enriched = _enrich_assets_with_zabbix_status(formatted, db=db)

        # Filtrar por status se especificado
        if status == "icmp_online":
            enriched = [a for a in enriched if a.get("icmp_status") == "online"]
        elif status == "icmp_offline":
            enriched = [a for a in enriched if a.get("icmp_status") == "offline"]
        elif status == "zabbix_problem":
            enriched = [a for a in enriched if a.get("zabbix_status") == "problem"]
        elif status == "zabbix_ok":
            enriched = [a for a in enriched if a.get("zabbix_status") == "ok"]

        # Obter filtros disponíveis
        locations = db.query(Location).filter(Location.is_active == True).order_by(Location.name).all()  # noqa: E712
        asset_types = db.query(AssetTypeModel).filter(AssetTypeModel.is_active == True).order_by(AssetTypeModel.name).all()  # noqa: E712

        online_count = sum(1 for a in enriched if a.get("icmp_status") == "online")
        offline_count = sum(1 for a in enriched if a.get("icmp_status") == "offline")
        problem_count = sum(1 for a in enriched if a.get("zabbix_status") == "problem")

        return {
            "assets": enriched,
            "total_count": len(enriched),
            "online_count": online_count,
            "offline_count": offline_count,
            "problem_count": problem_count,
            "locations": [{"id": l.id, "name": l.name} for l in locations],
            "asset_types": [{"id": t.id, "name": t.name} for t in asset_types],
        }
    except Exception as e:
        print(f"[Public NOC Error] {e}")
        return {"assets": [], "total_count": 0, "online_count": 0, "offline_count": 0, "problem_count": 0, "locations": [], "asset_types": []}


@router.get("/live-ping/{ip_or_asset_id}")
def live_ping_diagnostic(
    ip_or_asset_id: str,
    db: Session = Depends(get_db),
):
    """Executa um teste de Ping ICMP ao vivo para diagnóstico de conectividade em tempo real."""
    import subprocess
    import re

    ip = ip_or_asset_id.strip()

    # Se for um ID numérico, buscar o IP do ativo no CMDB
    if ip.isdigit():
        asset = db.query(Asset).filter(Asset.id == int(ip)).first()
        if asset and asset.ip_address and asset.ip_address.strip():
            ip = asset.ip_address.strip()
        else:
            return {
                "status": "error",
                "ip": ip_or_asset_id,
                "latency_ms": 0,
                "packet_loss": 100,
                "output": f"Ativo ID {ip_or_asset_id} não possui IP cadastrado."
            }

    if not ip or ip == "no_ip":
        return {
            "status": "error",
            "ip": "",
            "latency_ms": 0,
            "packet_loss": 100,
            "output": "IP não informado ou inválido."
        }

    try:
        output = subprocess.check_output(
            ["ping", "-n", "2", "-w", "1000", ip],
            text=True,
            stderr=subprocess.STDOUT,
            timeout=6,
        )
        time_match = re.search(r"tempo[=<](\d+)ms|time[=<](\d+)ms", output, re.IGNORECASE)
        loss_match = re.search(r"(\d+)% loss|(\d+)% de perda", output, re.IGNORECASE)

        latency = int(time_match.group(1) or time_match.group(2)) if time_match else 1
        loss = int(loss_match.group(1) or loss_match.group(2)) if loss_match else 0

        return {
            "status": "online",
            "ip": ip,
            "latency_ms": latency,
            "packet_loss": loss,
            "output": output,
        }
    except subprocess.TimeoutExpired:
        return {
            "status": "offline",
            "ip": ip,
            "latency_ms": 0,
            "packet_loss": 100,
            "output": f"Timeout: o host {ip} não respondeu dentro de 6 segundos.",
        }
    except subprocess.CalledProcessError as e:
        return {
            "status": "offline",
            "ip": ip,
            "latency_ms": 0,
            "packet_loss": 100,
            "output": e.output if e.output else f"Host {ip} inalcançável.",
        }
    except Exception as e:
        return {
            "status": "offline",
            "ip": ip,
            "latency_ms": 0,
            "packet_loss": 100,
            "output": str(e),
        }

