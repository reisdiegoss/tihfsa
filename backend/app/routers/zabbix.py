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
from app.services.evolution_service import EvolutionService

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


def sync_active_zabbix_alerts(db: Session):
    """
    Função centralizada para buscar problemas ativos no Zabbix e criar chamados
    automaticamente. Retorna um dicionário com os alertas mapeados.
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

        # Agrupar problemas ativos por asset
        problems_by_asset_id = {}
        unmatched_problems = []

        for prob in raw_problems:
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

            if matched_asset:
                if matched_asset.id not in problems_by_asset_id:
                    problems_by_asset_id[matched_asset.id] = {
                        "asset": matched_asset,
                        "problems": []
                    }
                problems_by_asset_id[matched_asset.id]["problems"].append(prob)
            else:
                unmatched_problems.append(prob)

        # FASE 1: CRIAR OU ATUALIZAR CHAMADO POR EQUIPAMENTO
        for asset_id, data in problems_by_asset_id.items():
            asset = data["asset"]
            probs = data["problems"]
            
            # Ordena os problemas para pegar o de maior severidade como principal
            probs.sort(key=lambda x: int(x.get("priority") or x.get("severity") or "0"), reverse=True)
            main_prob = probs[0]
            
            main_trigger_id = main_prob.get("triggerid") or main_prob.get("trigger_id") or main_prob.get("eventid")
            main_event_title = main_prob.get("description") or main_prob.get("name") or "Alerta Zabbix"
            main_severity = main_prob.get("priority") or main_prob.get("severity") or "3"
            main_clock = main_prob.get("lastchange") or main_prob.get("clock") or "0"

            ticket_tag = f"[NOC Zabbix] Alertas - {asset.name}"

            # Verificar se já existe chamado em aberto para este equipamento gerado pelo Zabbix
            existing_ticket = (
                db.query(Ticket)
                .filter(
                    Ticket.asset_id == asset.id,
                    Ticket.title.like(ticket_tag + "%"),
                    Ticket.status.in_([
                        TicketStatus.NEW,
                        TicketStatus.IN_PROGRESS,
                        TicketStatus.PENDING_VALIDATION,
                    ])
                )
                .first()
            )

            # Extrair os trigger_ids atuais vinculados ao ativo
            current_trigger_ids = [str(p.get("triggerid") or p.get("trigger_id") or p.get("eventid")) for p in probs]
            all_alerts_text = "\n".join([f"- {p.get('description') or p.get('name')} (Sev: {p.get('priority') or p.get('severity')})" for p in probs])

            if not existing_ticket:
                # Criar um chamado agrupado para o ativo
                prio = _map_zabbix_severity_to_priority(main_severity)
                new_ticket = Ticket(
                    title=ticket_tag,
                    description=(
                        f"Chamado gerado automaticamente pelo NOC via Monitoramento Zabbix.\n\n"
                        f"Equipamento: {asset.name}\n"
                        f"IP: {asset.ip_address or 'N/A'}\n\n"
                        f"**Alertas Ativos:**\n{all_alerts_text}\n\n"
                        f"Ids: {','.join(current_trigger_ids)}"
                    ),
                    status=TicketStatus.NEW,
                    priority=prio,
                    requester_id=noc_system_user.id,
                    asset_id=asset.id,
                    category_id=asset.category_id,
                    subcategory_id=asset.subcategory_id,
                )
                db.add(new_ticket)
                db.commit()
                db.refresh(new_ticket)
                existing_ticket = new_ticket
                
                # Notificar no WhatsApp que o equipamento caiu e um chamado foi gerado
                try:
                    msg_text = (
                        f"🚨 *ALERTA ZABBIX: {asset.name}* 🚨\n\n"
                        f"⚠️ Múltiplos ou Novo Alerta Registrado\n"
                        f"🔴 Principal: {main_event_title}\n"
                        f"🌐 IP: {asset.ip_address or 'N/A'}\n"
                        f"🚨 Severidade Máxima: {main_severity}\n\n"
                        f"🎫 Chamado automático agrupado: *#{new_ticket.id}*"
                    )
                    EvolutionService.send_whatsapp_message(msg_text)
                except Exception as e:
                    print(f"[Zabbix WhatsApp Notification Error] {e}")
            else:
                # Atualizar chamado existente se surgiram novos alertas que não estão na descrição
                if existing_ticket.description:
                    for tid in current_trigger_ids:
                        if "Ids:" in str(existing_ticket.description) and tid not in str(existing_ticket.description):
                            for p in probs:
                                p_tid = str(p.get("triggerid") or p.get("trigger_id") or p.get("eventid"))
                                if p_tid == tid:
                                    new_alert_desc = p.get('description') or p.get('name')
                                    existing_ticket.description = str(existing_ticket.description) + f"\n\n⚠️ Novo alerta detectado: {new_alert_desc} (Sev: {p.get('priority') or p.get('severity')})"
                                    existing_ticket.description += f", {tid}"
                                    db.commit()
                                    break

            # Alimentar o filtered_alerts pro endpoint /alerts
            filtered_alerts.append({
                "eventid": main_trigger_id,
                "name": main_event_title,
                "severity": main_severity,
                "clock": main_clock,
                "host": asset.name,
                "host_ip": asset.ip_address,
                "asset_id": asset.id,
                "category_id": asset.category_id,
                "ticket_id": existing_ticket.id if existing_ticket else None,
                "ticket_status": existing_ticket.status.value if existing_ticket else None,
            })

        # FASE 2: AUTO-RESOLUÇÃO (Atualizar para PENDING_VALIDATION)
        # Buscar todos os chamados abertos que foram gerados pelo Zabbix de forma agrupada
        open_zabbix_tickets = db.query(Ticket).filter(
            Ticket.title.like("[NOC Zabbix] Alertas - %"),
            Ticket.status.in_([TicketStatus.NEW, TicketStatus.IN_PROGRESS])
        ).all()
        
        for ticket in open_zabbix_tickets:
            asset_probs = problems_by_asset_id.get(ticket.asset_id, {}).get("problems", [])
            
            has_critical_problems = False
            for p in asset_probs:
                p_sev = int(p.get("priority") or p.get("severity") or "0")
                if p_sev >= 3: # 3=Average, 4=High, 5=Disaster
                    has_critical_problems = True
                    break
                    
            if not has_critical_problems:
                ticket.status = TicketStatus.PENDING_VALIDATION
                ticket.description = str(ticket.description) + "\n\n✅ [SISTEMA] Equipamento Online! Alertas críticos normalizados no Zabbix. Aguardando validação manual para encerramento."
                db.commit()
                
                try:
                    asset_name = ticket.asset.name if ticket.asset else "Desconhecido"
                    msg_text = (
                        f"✅ *ZABBIX: EQUIPAMENTO ONLINE!* ✅\n\n"
                        f"O equipamento *{asset_name}* restabeleceu a conexão ou normalizou o alerta crítico.\n\n"
                        f"🎫 O chamado agrupado *#{ticket.id}* está aguardando validação."
                    )
                    EvolutionService.send_whatsapp_message(msg_text)
                except Exception as e:
                    print(f"[Zabbix WhatsApp Auto-Resolve Error] {e}")

        return {
            "alerts": filtered_alerts,
            "count": len(filtered_alerts),
            "total_zabbix_problems": total_zabbix_problems
        }
    except Exception as e:
        print(f"[Zabbix Router Erro] {e}")
        return {"alerts": [], "count": 0, "error": str(e)}

@router.get("/alerts")
def list_zabbix_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Endpoint para retornar alertas do Zabbix.
    Ele chama a função de sincronização que também gera chamados.
    """
    return sync_active_zabbix_alerts(db)


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


def _format_bps(bps_str: str) -> str:
    try:
        b = float(bps_str)
        if b >= 1000000000:
            return f"{b/1000000000:.2f} Gbps"
        if b >= 1000000:
            return f"{b/1000000:.2f} Mbps"
        if b >= 1000:
            return f"{b/1000:.2f} Kbps"
        return f"{b:.0f} bps"
    except (ValueError, TypeError):
        return bps_str


@router.get("/assets/{asset_id}/discover-items")
def discover_asset_zabbix_items(
    asset_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Retorna a lista completa de itens do Zabbix para este ativo (para importar)."""
    try:
        asset = db.query(Asset).filter(Asset.id == asset_id).first()
        if not asset or not asset.ip_address:
            return {"status": "error", "message": "Ativo não encontrado ou sem IP."}

        hosts = ZabbixService._call_api("host.get", {
            "output": ["hostid"],
            "filter": {"ip": [asset.ip_address]}
        })
        if not hosts or not hosts.get("result"):
            return {"status": "error", "message": "Host não encontrado no Zabbix"}

        host_id = hosts["result"][0]["hostid"]
        
        # Puxa todos os itens (limitando a 500 para evitar excesso, ordenando pelo nome)
        items_res = ZabbixService._call_api("item.get", {
            "output": ["itemid", "name", "units", "value_type", "key_"],
            "hostids": host_id,
            "selectTags": "extend",
            "sortfield": "name",
            "limit": 500
        })
        
        return {"status": "success", "items": items_res.get("result", [])}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/assets/{asset_id}/network-interfaces")
def get_asset_network_interfaces(
    asset_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Busca o detalhamento de interfaces (tráfego e links up/down) do equipamento lendo o mapeamento customizado."""
    try:
        asset = db.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            raise HTTPException(status_code=404, detail="Ativo não encontrado")

        if not asset.zabbix_items:
            # Fallback opcional ou retorna vazio
            return {"status": "success", "asset_name": asset.name, "interfaces": []}

        # Extrai os IDs para buscar do Zabbix
        mapped_items = [i for i in asset.zabbix_items if i.is_active]
        item_ids = [str(i.zabbix_item_id) for i in mapped_items]
        
        if not item_ids:
            return {"status": "success", "asset_name": asset.name, "interfaces": []}

        # Busca valores em tempo real apenas dos itens mapeados
        res = ZabbixService._call_api("item.get", {
            "output": ["itemid", "lastvalue"],
            "itemids": item_ids
        })
        
        live_data = {str(item["itemid"]): item.get("lastvalue", "") for item in res.get("result", [])}

        interfaces_map = {}

        # Constrói o mapa baseado nas configurações (AssetZabbixItem)
        for config in mapped_items:
            iface = config.interface_name or "Geral"
            val = live_data.get(str(config.zabbix_item_id), "")
            
            if iface not in interfaces_map:
                interfaces_map[iface] = {
                    "interface_name": iface,
                    "description": "",
                    "bits_received": "0 bps",
                    "bits_sent": "0 bps",
                    "status": "unknown",
                    "is_sdwan": False,
                    "raw_items": {}
                }

            # Preenche baseado no tipo de monitor configurado
            mtype = config.monitor_type
            if mtype == "TRAFFIC_IN":
                interfaces_map[iface]["bits_received"] = _format_bps(val)
                interfaces_map[iface]["description"] = config.name
            elif mtype == "TRAFFIC_OUT":
                interfaces_map[iface]["bits_sent"] = _format_bps(val)
            elif mtype in ["STATUS_UPDOWN", "SDWAN_STATUS"]:
                interfaces_map[iface]["is_sdwan"] = (mtype == "SDWAN_STATUS")
                # Interpret logic
                if val == "0" or "alive" in str(val).lower():
                    interfaces_map[iface]["status"] = "up" if mtype == "SDWAN_STATUS" else "unknown"
                elif val == "1" or "dead" in str(val).lower():
                    interfaces_map[iface]["status"] = "down" if mtype == "SDWAN_STATUS" else "up"
                elif val == "2" or "down" in str(val).lower():
                    interfaces_map[iface]["status"] = "down"
                else:
                     interfaces_map[iface]["status"] = "up" if "up" in str(val).lower() or val=="1" else "down"

            # Popula as métricas cruas formatadas para visualização dinâmica
            formatted_val = str(val)
            if mtype in ["TRAFFIC_IN", "TRAFFIC_OUT"]:
                formatted_val = _format_bps(val)
            elif mtype in ["STATUS_UPDOWN", "SDWAN_STATUS"]:
                formatted_val = interfaces_map[iface]["status"].upper()
                
            interfaces_map[iface]["raw_items"][config.name] = formatted_val

        return {
            "status": "success",
            "asset_name": asset.name,
            "interfaces": list(interfaces_map.values())
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


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

