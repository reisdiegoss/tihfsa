"""
Router Assets — CRUD de equipamentos (CMDB).
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import get_current_user, get_optional_user, require_technician, require_admin
from app.models.user import User
from app.models.asset import Asset, AssetZabbixItem
from app.schemas.asset import AssetCreate, AssetUpdate, AssetResponse, AssetZabbixItemCreate, AssetZabbixItemResponse

router = APIRouter(prefix="/api/v1/assets", tags=["Ativos (CMDB)"])


def _format_asset_response(asset: Asset) -> dict:
    type_str = asset.type.value if hasattr(asset.type, "value") else str(asset.type)
    return {
        "id": asset.id,
        "name": asset.name,
        "type": type_str,
        "brand": asset.brand,
        "model": asset.model,
        "serial_number": asset.serial_number,
        "mac_address": asset.mac_address,
        "ip_address": asset.ip_address,
        "asset_tag": asset.asset_tag,
        "description": asset.description,
        "specs": asset.specs,
        "sound_alert_offline": getattr(asset, "sound_alert_offline", False),
        "is_active": asset.is_active,
        "assigned_user_id": asset.assigned_user_id,
        "assigned_user_name": asset.assigned_user.display_name if asset.assigned_user else None,
        "subcategory_id": asset.subcategory_id,
        "category_id": asset.category_id,
        "category_name": asset.category.name if asset.category else None,
        "location_id": asset.location_id,
        "location_name": asset.location.name if asset.location else None,
        "created_at": asset.created_at,
        "zabbix_items": [
            {
                "id": zi.id,
                "asset_id": zi.asset_id,
                "zabbix_item_id": zi.zabbix_item_id,
                "name": zi.name,
                "interface_name": zi.interface_name,
                "monitor_type": zi.monitor_type,
                "is_active": zi.is_active
            }
            for zi in asset.zabbix_items
        ] if getattr(asset, "zabbix_items", None) else []
    }


def _auto_create_ticket_if_offline(asset_data: dict, db: Session):
    """Cria automaticamente um chamado de suporte quando um equipamento fica OFFLINE."""
    try:
        from app.models.ticket import Ticket, TicketStatus, TicketPriority
        from app.models.user import User, UserRole

        asset_id = asset_data.get("id")
        if not asset_id:
            return

        # Verificar se já existe um chamado em aberto/em andamento para este ativo
        existing_ticket = (
            db.query(Ticket)
            .filter(
                Ticket.asset_id == asset_id,
                Ticket.status.in_([TicketStatus.NEW, TicketStatus.IN_PROGRESS, TicketStatus.PENDING_VALIDATION])
            )
            .first()
        )
        if existing_ticket:
            return

        # Buscar um usuário admin para figurar como solicitante do auto-alerta
        admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()
        requester_id = admin_user.id if admin_user else 1

        asset_name = asset_data.get("name", "Equipamento")
        asset_ip = asset_data.get("ip_address") or "Sem IP"
        asset_loc = asset_data.get("location_name") or "Localização Geral"

        auto_ticket = Ticket(
            title=f"[NOC Auto-Alerta] Equipamento Indisponível (Offline) - {asset_name}",
            description=(
                f"Alerta Automático NOC Zabbix: O equipamento '{asset_name}' (IP: {asset_ip}, Local: {asset_loc}) "
                f"ficou OFFLINE e parou de responder a requisições de conectividade ICMP (Ping).\n\n"
                f"Este chamado foi aberto automaticamente pelo monitoramento para verificação imediata da equipe de TI."
            ),
            status=TicketStatus.NEW,
            priority=TicketPriority.HIGH,
            requester_id=requester_id,
            asset_id=asset_id,
            category_id=asset_data.get("category_id")
        )
        db.add(auto_ticket)
        db.commit()
        print(f"[NOC Auto-Ticket] Chamado criado automaticamente para ativo offline: {asset_name}")
    except Exception as e:
        print(f"[NOC Auto-Ticket Error] {e}")
        db.rollback()


def _enrich_assets_with_zabbix_status(formatted_assets: list[dict], db: Session | None = None) -> list[dict]:
    """Consulta o Zabbix em tempo real e enriquece os ativos com Conectividade ICMP e Alertas Zabbix NOC."""
    try:
        from app.services.zabbix_service import ZabbixService

        zabbix_triggers = ZabbixService.get_active_triggers_with_hosts()
        zabbix_hosts = ZabbixService.get_hosts()

        zabbix_by_ip = {}
        zabbix_by_name = {}
        for h in zabbix_hosts:
            name = (h.get("name") or h.get("host") or "").strip().lower()
            if name:
                zabbix_by_name[name] = h
            for iface in h.get("interfaces", []):
                ip = iface.get("ip", "").strip()
                if ip:
                    zabbix_by_ip[ip] = h

        problems_by_ip = {}
        problems_by_name = {}
        for trig in zabbix_triggers:
            for h in trig.get("hosts", []):
                h_name = (h.get("name") or h.get("host") or "").strip().lower()
                h_ip = (h.get("ip") or "").strip()
                if h_ip:
                    if h_ip not in problems_by_ip:
                        problems_by_ip[h_ip] = []
                    problems_by_ip[h_ip].append(trig)
                if h_name:
                    if h_name not in problems_by_name:
                        problems_by_name[h_name] = []
                    problems_by_name[h_name].append(trig)

        for a in formatted_assets:
            ip = (a.get("ip_address") or "").strip()
            name = (a.get("name") or "").strip().lower()

            # Se não tem IP, desativa alertas e ping
            if not ip:
                a["icmp_status"] = "no_ip"
                a["zabbix_status"] = "no_ip"
                a["zabbix_alert_title"] = None
                a["zabbix_severity"] = None
                a["monitoring_protocol"] = "icmp"
                a["snmp_status"] = "not_configured"
                continue

            probs = problems_by_ip.get(ip) or problems_by_name.get(name) or []
            host_match = zabbix_by_ip.get(ip) or zabbix_by_name.get(name)

            # 1. Determinar Status de Conectividade ICMP (Ping)
            if host_match:
                is_down = False
                # Zabbix host availability == "2" indica indisponível
                if str(host_match.get("available")) == "2":
                    is_down = True
                elif probs:
                    for prob in probs:
                        p_title = (prob.get("description") or prob.get("name") or "").lower()
                        if any(w in p_title for w in ["unavailable", "ping", "down", "unreachable", "sem resposta", "indisponivel", "offline"]):
                            is_down = True
                            break

                a["icmp_status"] = "offline" if is_down else "online"
            elif ip:
                a["icmp_status"] = "unmonitored"
            else:
                a["icmp_status"] = "no_ip"

            # 2. Determinar Alertas e Problemas do Zabbix NOC
            if probs:
                # Pega o primeiro problema ou o de maior severidade/o que causou a queda
                main_prob = probs[0]
                for prob in probs:
                    p_title = (prob.get("description") or prob.get("name") or "").lower()
                    if any(w in p_title for w in ["unavailable", "ping", "down", "unreachable", "sem resposta", "indisponivel", "offline"]):
                        main_prob = prob
                        break
                        
                a["zabbix_status"] = "problem"
                a["zabbix_alert_title"] = main_prob.get("description") or main_prob.get("name") or "Alerta Ativo no Zabbix"
                a["zabbix_severity"] = str(main_prob.get("priority") or main_prob.get("severity") or "High")
            elif host_match:
                a["zabbix_status"] = "ok"
                a["zabbix_alert_title"] = None
                a["zabbix_severity"] = None
            elif ip:
                a["zabbix_status"] = "unmonitored"
                a["zabbix_alert_title"] = None
                a["zabbix_severity"] = None
            else:
                a["zabbix_status"] = "no_ip"
                a["zabbix_alert_title"] = None
                a["zabbix_severity"] = None

            # 3. Determinar Protocolo de Monitoramento (SNMP, ICMP, Agent) & Status SNMP
            monitoring_protocol = "icmp"
            snmp_status = "not_configured"

            if host_match:
                ifaces = host_match.get("interfaces", [])
                snmp_iface = next((i for i in ifaces if str(i.get("type")) == "2"), None)
                agent_iface = next((i for i in ifaces if str(i.get("type")) == "1"), None)

                if snmp_iface:
                    monitoring_protocol = "snmp"
                    snmp_avail = str(snmp_iface.get("available", "1"))
                    snmp_status = "online" if snmp_avail == "1" else ("offline" if snmp_avail == "2" else "online")
                elif agent_iface:
                    monitoring_protocol = "agent"
                    snmp_status = "not_configured"
                else:
                    monitoring_protocol = "icmp"
                    snmp_status = "not_configured"

            if prob:
                p_title = (prob.get("description") or prob.get("name") or "").lower()
                if any(w in p_title for w in ["snmp", "ubiquiti", "airos", "oid", "switch", "interface wifi"]):
                    monitoring_protocol = "snmp"
                    if snmp_status == "not_configured":
                        snmp_status = "online"

            a["monitoring_protocol"] = monitoring_protocol
            a["snmp_status"] = snmp_status

            # 4. Criar chamado automático se o equipamento estiver OFFLINE
            if db and a.get("icmp_status") == "offline":
                _auto_create_ticket_if_offline(a, db)

    except Exception as e:
        print(f"[Zabbix Status Enrich Error] {e}")
        for a in formatted_assets:
            a["icmp_status"] = "no_ip" if not a.get("ip_address") else "unmonitored"
            a["zabbix_status"] = "no_ip" if not a.get("ip_address") else "unmonitored"
            a["zabbix_alert_title"] = None
            a["zabbix_severity"] = None
            a["monitoring_protocol"] = "icmp"
            a["snmp_status"] = "not_configured"

    return formatted_assets


@router.get("/", response_model=list[AssetResponse])
def list_assets(
    type: str | None = None,
    subcategory_id: int | None = None,
    category_id: int | None = None,
    location_id: int | None = None,
    is_active: bool = True,
    search: str | None = None,
    db: Session = Depends(get_db),
    _: User | None = Depends(get_optional_user),
):
    """Lista todos os ativos com filtros e status do Zabbix em tempo real."""
    query = db.query(Asset).filter(Asset.is_active == is_active)
    if type:
        query = query.filter(Asset.type == type)
    if subcategory_id:
        query = query.filter(Asset.subcategory_id == subcategory_id)
    if category_id:
        query = query.filter(Asset.category_id == category_id)
    if location_id:
        query = query.filter(Asset.location_id == location_id)
    if search:
        query = query.filter(Asset.name.ilike(f"%{search}%"))
    
    assets = query.order_by(Asset.name).all()
    formatted = [_format_asset_response(a) for a in assets]
    return _enrich_assets_with_zabbix_status(formatted, db=db)


@router.get("/user/{user_id}", response_model=list[AssetResponse])
def list_user_assets(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lista ativos de um usuário ou apartamento específico."""
    assets = (
        db.query(Asset)
        .filter(Asset.assigned_user_id == user_id, Asset.is_active == True)  # noqa: E712
        .order_by(Asset.type)
        .all()
    )
    return [_format_asset_response(a) for a in assets]


@router.get("/{asset_id}", response_model=AssetResponse)
def get_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Detalhe de um ativo."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")
    return _format_asset_response(asset)


@router.post("/{asset_id}/zabbix-items", response_model=list[AssetZabbixItemResponse])
def configure_asset_zabbix_items(
    asset_id: int,
    items: list[AssetZabbixItemCreate],
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Substitui os itens do Zabbix monitorados para um ativo específico."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")

    # Deleta os atuais
    db.query(AssetZabbixItem).filter(AssetZabbixItem.asset_id == asset_id).delete()
    
    # Adiciona os novos
    new_items = []
    for item in items:
        db_item = AssetZabbixItem(
            asset_id=asset_id,
            zabbix_item_id=item.zabbix_item_id,
            name=item.name,
            interface_name=item.interface_name,
            monitor_type=item.monitor_type,
            is_active=item.is_active
        )
        db.add(db_item)
        new_items.append(db_item)
        
    db.commit()
    
    # Reload e return
    return db.query(AssetZabbixItem).filter(AssetZabbixItem.asset_id == asset_id).all()


@router.delete("/{asset_id}/zabbix-items/{item_id}")
def delete_asset_zabbix_item(
    asset_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Remove um item Zabbix monitorado do ativo."""
    item = db.query(AssetZabbixItem).filter(
        AssetZabbixItem.id == item_id, 
        AssetZabbixItem.asset_id == asset_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
        
    db.delete(item)
    db.commit()
    return {"status": "success"}


def _sanitize_asset_data(data_dict: dict) -> dict:
    """Sanitiza os campos do ativo convertendo strings vazias para None."""
    string_fields = ["asset_tag", "ip_address", "brand", "model", "serial_number", "mac_address", "description"]
    for field in string_fields:
        if field in data_dict:
            val = data_dict[field]
            if isinstance(val, str):
                val_clean = val.strip()
                data_dict[field] = val_clean if val_clean else None
    return data_dict


@router.post("/", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
def create_asset(
    data: AssetCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Cadastra um novo equipamento com higienização e validação de duplicidade."""
    payload = _sanitize_asset_data(data.model_dump())

    if payload.get("asset_tag"):
        existing_tag = db.query(Asset).filter(
            Asset.asset_tag == payload["asset_tag"],
            Asset.is_active == True
        ).first()
        if existing_tag:
            raise HTTPException(
                status_code=400,
                detail=f"O código de patrimônio/tag '{payload['asset_tag']}' já está cadastrado no equipamento '{existing_tag.name}'."
            )

    try:
        asset = Asset(**payload)
        db.add(asset)
        db.commit()
        db.refresh(asset)
        return _format_asset_response(asset)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Erro ao cadastrar ativo: {e}")


@router.patch("/{asset_id}", response_model=AssetResponse)
def update_asset(
    asset_id: int,
    data: AssetUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Atualiza dados de um ativo com higienização e validação de duplicidade."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")

    payload = _sanitize_asset_data(data.model_dump(exclude_unset=True))

    if payload.get("asset_tag"):
        existing_tag = db.query(Asset).filter(
            Asset.asset_tag == payload["asset_tag"],
            Asset.id != asset_id,
            Asset.is_active == True
        ).first()
        if existing_tag:
            raise HTTPException(
                status_code=400,
                detail=f"O código de patrimônio/tag '{payload['asset_tag']}' já está em uso pelo equipamento '{existing_tag.name}'."
            )

    try:
        for field, value in payload.items():
            setattr(asset, field, value)

        db.commit()
        db.refresh(asset)
        return _format_asset_response(asset)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Erro ao salvar alterações do ativo: {e}")


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Soft delete: desativa o ativo."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")
    asset.is_active = False
    db.commit()


@router.get("/{asset_id}/zabbix-status")
def get_asset_zabbix_status(
    asset_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Integração com Zabbix: Consulta o status em tempo real do host associado a este ativo via IP."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")

    if not asset.ip_address:
        return {"status": "Sem IP", "message": "Ativo não possui IP configurado", "host_name": None, "problems": []}

    # Realizar o lookup no ZabbixService usando o IP
    from app.services.zabbix_service import ZabbixService
    return ZabbixService.get_host_status_by_ip(asset.ip_address)
@router.get("/zabbix/discover")
def discover_zabbix_hosts(
    db: Session = Depends(get_db),
    _: User = Depends(require_technician)
):
    """Busca todos os hosts no Zabbix e filtra removendo aqueles cujos IPs já estão no TIHFSA."""
    from app.services.zabbix_service import ZabbixService
    
    # 1. Obter IPs já cadastrados no CMDB
    existing_assets = db.query(Asset.ip_address).filter(
        Asset.ip_address.isnot(None),
        Asset.is_active == True # noqa: E712
    ).all()
    existing_ips = {asset[0] for asset in existing_assets if asset[0]}
    
    # 2. Obter categorias existentes para auto-mapeamento
    from app.models.category import Category
    db_categories = db.query(Category).filter(Category.is_active == True).all()  # noqa: E712
    cat_by_group_id = {c.zabbix_group_id: c for c in db_categories if c.zabbix_group_id}
    cat_by_name = {c.name.lower(): c for c in db_categories}

    # 3. Obter todos os hosts do Zabbix
    zabbix_hosts = ZabbixService.get_hosts()
    
    # 4. Filtrar hosts "Órfãos" (IPs não existentes no CMDB)
    orphan_hosts = []
    
    for host in zabbix_hosts:
        interfaces = host.get("interfaces", [])
        host_ip = None
        for interface in interfaces:
            if interface.get("ip") and interface.get("ip") != "127.0.0.1":
                host_ip = interface.get("ip")
                break
                
        if host_ip and host_ip not in existing_ips:
            # Extrair Grupos do Zabbix
            host_groups = host.get("hostgroups") or host.get("groups") or []
            group_name = host_groups[0].get("name") if host_groups else None
            group_id = str(host_groups[0].get("groupid")) if host_groups else None

            # Tentar achar a categoria equivalente no TIHFSA
            matched_cat = None
            if group_id and group_id in cat_by_group_id:
                matched_cat = cat_by_group_id[group_id]
            elif group_name and group_name.lower() in cat_by_name:
                matched_cat = cat_by_name[group_name.lower()]

            # Inferir o tipo pelo nome ou grupo
            inferred_type = "Outro"
            name_and_grp = f"{host['name']} {group_name or ''}".lower()
            if "switch" in name_and_grp or "sw" in name_and_grp:
                inferred_type = "Switch"
            elif "ap" in name_and_grp or "unifi" in name_and_grp or "wifi" in name_and_grp or "access point" in name_and_grp:
                inferred_type = "Access Point"
            elif "router" in name_and_grp or "roteador" in name_and_grp or "mikrotik" in name_and_grp:
                inferred_type = "Roteador"
            elif "pc" in name_and_grp or "desktop" in name_and_grp or "workstation" in name_and_grp:
                inferred_type = "Desktop"
            elif "tv" in name_and_grp:
                inferred_type = "TV"
            elif "cam" in name_and_grp or "cftv" in name_and_grp:
                inferred_type = "Outro"
                
            orphan_hosts.append({
                "zabbix_host_id": host["hostid"],
                "name": host["name"],
                "ip_address": host_ip,
                "inferred_type": inferred_type,
                "zabbix_group_name": group_name or "Desconhecido",
                "category_id": matched_cat.id if matched_cat else None,
                "category_name": matched_cat.name if matched_cat else (group_name or "Geral"),
                "status": "Monitored" if str(host.get("status")) == "0" else "Unmonitored"
            })
            
    return {"total_orphans": len(orphan_hosts), "hosts": orphan_hosts}


@router.get("/zabbix/group-import-tree")
@router.get("/zabbix/groups-and-hosts")
def get_zabbix_group_import_tree(
    db: Session = Depends(get_db),
    _: User = Depends(require_technician)
):
    """Retorna os Grupos de Hosts do Zabbix com seus respectivos hosts para a tela de importação em 2 passos."""
    from app.services.zabbix_service import ZabbixService
    from app.models.category import Category
    
    # 1. Buscar Grupos do Zabbix
    zabbix_groups = ZabbixService.get_host_groups()
    
    # 2. Buscar Categorias do TIHFSA para mapeamento
    db_categories = db.query(Category).filter(Category.is_active == True).all()  # noqa: E712
    cat_by_group_id = {c.zabbix_group_id: c for c in db_categories if c.zabbix_group_id}
    cat_by_name = {c.name.lower(): c for c in db_categories}

    # 3. Buscar todos os hosts do Zabbix
    zabbix_hosts = ZabbixService.get_hosts()

    # 4. Agrupar os hosts por groupid
    groups_tree = []
    
    for grp in zabbix_groups:
        grp_id = str(grp.get("groupid"))
        grp_name = grp.get("name")
        
        # Encontrar categoria correspondente
        matched_cat = None
        if grp_id and grp_id in cat_by_group_id:
            matched_cat = cat_by_group_id[grp_id]
        elif grp_name and grp_name.lower() in cat_by_name:
            matched_cat = cat_by_name[grp_name.lower()]

        # Filtrar hosts deste grupo
        grp_hosts = []
        for h in zabbix_hosts:
            h_groups = h.get("hostgroups") or h.get("groups") or []
            h_group_ids = [str(g.get("groupid")) for g in h_groups]
            h_group_names = [g.get("name", "").lower() for g in h_groups]

            if grp_id in h_group_ids or (grp_name and grp_name.lower() in h_group_names):
                # Extrair IP
                interfaces = h.get("interfaces", [])
                host_ip = None
                for interface in interfaces:
                    if interface.get("ip") and interface.get("ip") != "127.0.0.1":
                        host_ip = interface.get("ip")
                        break

                # Tipo inferido
                inferred_type = "Outro"
                name_and_grp = f"{h['name']} {grp_name or ''}".lower()
                if "switch" in name_and_grp or "sw" in name_and_grp:
                    inferred_type = "Switch"
                elif "ap" in name_and_grp or "unifi" in name_and_grp or "wifi" in name_and_grp or "access point" in name_and_grp:
                    inferred_type = "Access Point"
                elif "router" in name_and_grp or "roteador" in name_and_grp or "mikrotik" in name_and_grp:
                    inferred_type = "Roteador"
                elif "pc" in name_and_grp or "desktop" in name_and_grp or "workstation" in name_and_grp:
                    inferred_type = "Desktop"
                elif "tv" in name_and_grp:
                    inferred_type = "TV"

                # Checar se já existe no CMDB
                already_exists = False
                if host_ip:
                    exists = db.query(Asset).filter(Asset.ip_address == host_ip, Asset.is_active == True).first()  # noqa: E712
                    already_exists = exists is not None

                grp_hosts.append({
                    "zabbix_host_id": h["hostid"],
                    "name": h["name"],
                    "ip_address": host_ip,
                    "inferred_type": inferred_type,
                    "already_exists": already_exists,
                    "status": "Monitored" if str(h.get("status")) == "0" else "Unmonitored"
                })

        groups_tree.append({
            "zabbix_group_id": grp_id,
            "zabbix_group_name": grp_name,
            "suggested_category_id": matched_cat.id if matched_cat else None,
            "suggested_category_name": matched_cat.name if matched_cat else None,
            "host_count": len(grp_hosts),
            "hosts": grp_hosts
        })

    return groups_tree


from pydantic import BaseModel


class ZabbixHostImportItem(BaseModel):
    name: str | None = None
    host_name: str | None = None
    type: str | None = None
    inferred_type: str | None = None
    ip_address: str | None = None
    category_id: int | None = None
    zabbix_group_id: str | None = None

    @property
    def final_name(self) -> str:
        return self.name or self.host_name or "Equipamento Sem Nome"

    @property
    def final_type(self) -> str:
        return self.type or self.inferred_type or "Outro"


class ZabbixBatchImportPayload(BaseModel):
    hosts: list[ZabbixHostImportItem]


@router.post("/zabbix/import-groups-and-hosts")
def import_zabbix_groups_and_hosts(
    payload: ZabbixBatchImportPayload,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician)
):
    """Importa massivamente os equipamentos com suas categorias associadas aos Host Groups."""
    imported_count = 0
    updated_count = 0

    for item in payload.hosts:
        asset_name = item.final_name
        asset_type = item.final_type

        # Se já existe por IP ou Nome, atualiza a Categoria e Tipo
        existing = None
        if item.ip_address:
            existing = db.query(Asset).filter(Asset.ip_address == item.ip_address).first()
        if not existing and asset_name:
            existing = db.query(Asset).filter(Asset.name == asset_name).first()

        if existing:
            existing.category_id = item.category_id or existing.category_id
            existing.type = asset_type or existing.type
            existing.is_active = True
            updated_count += 1
        else:
            new_asset = Asset(
                name=asset_name,
                type=asset_type,
                ip_address=item.ip_address,
                category_id=item.category_id,
                description="Importado via Zabbix Group Import Wizard",
                is_active=True
            )
            db.add(new_asset)
            imported_count += 1

    db.commit()
    return {
        "status": "success",
        "imported_count": imported_count,
        "updated_count": updated_count,
        "message": f"Importação concluída: {imported_count} novos ativos criados, {updated_count} atualizados!"
    }


@router.post("/zabbix/import")
def import_zabbix_hosts(
    hosts_to_import: list[AssetCreate],
    db: Session = Depends(get_db),
    _: User = Depends(require_technician)
):
    """Importa massivamente hosts do Zabbix como novos ativos."""
    imported_assets = []
    for host_data in hosts_to_import:
        if host_data.ip_address:
            exists = db.query(Asset).filter(Asset.ip_address == host_data.ip_address).first()
            if exists:
                continue
                
        asset = Asset(**host_data.model_dump())
        asset.description = "Importado via Zabbix Auto-Discovery"
        db.add(asset)
        imported_assets.append(asset)
        
    if imported_assets:
        db.commit()
        
    return {"status": "success", "imported_count": len(imported_assets)}


@router.post("/unifi/import")
def import_unifi_devices(
    devices_to_import: list[AssetCreate],
    db: Session = Depends(get_db),
    _: User = Depends(require_technician)
):
    """Importa massivamente dispositivos UniFi como novos ativos ou atualiza e reativa existentes."""
    imported_assets = []
    for device_data in devices_to_import:
        existing = None
        if device_data.ip_address:
            existing = db.query(Asset).filter(Asset.ip_address == device_data.ip_address).first()
        if not existing and device_data.mac_address:
            existing = db.query(Asset).filter(Asset.mac_address == device_data.mac_address).first()

        if existing:
            # Reativa e atualiza os dados do ativo existente
            existing.is_active = True
            if device_data.name:
                existing.name = device_data.name
            if device_data.type:
                existing.type = device_data.type
            if device_data.mac_address:
                existing.mac_address = device_data.mac_address
            if device_data.category_id:
                existing.category_id = device_data.category_id
            existing.description = "Sincronizado via UniFi Bulk Sync"
            imported_assets.append(existing)
        else:
            asset = Asset(**device_data.model_dump())
            asset.description = "Importado via UniFi Bulk Sync"
            asset.is_active = True
            db.add(asset)
            imported_assets.append(asset)
        
    if imported_assets:
        db.commit()
        
    return {"status": "success", "imported_count": len(imported_assets)}
