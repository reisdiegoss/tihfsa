import httpx
import warnings
from urllib.parse import urljoin
from app.database import SessionLocal
from app.models.integration_config import UnifiConfig

class UnifiService:
    _session = None
    _config = None
    _is_authenticated = False

    @classmethod
    def get_config(cls):
        db = SessionLocal()
        try:
            config = db.query(UnifiConfig).first()
            if config and config.is_active and config.api_url:
                cls._config = {
                    "api_url": config.api_url.rstrip("/"),
                    "username": config.username,
                    "password": config.password,
                    "site_id": config.site_id or "default"
                }
                return True
            return False
        finally:
            db.close()

    @classmethod
    def authenticate(cls):
        if not cls.get_config():
            return False

        if not cls._session:
            # UniFi uses self-signed certs often, ignoring SSL warnings
            cls._session = httpx.Client(verify=False)

        login_url = urljoin(cls._config["api_url"], "/api/login")
        payload = {
            "username": cls._config["username"],
            "password": cls._config["password"]
        }
        
        try:
            # Suppress InsecureRequestWarning
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                res = cls._session.post(login_url, json=payload, timeout=10.0)
            
            if res.status_code == 200:
                cls._is_authenticated = True
                return True
            else:
                cls._is_authenticated = False
                return False
        except Exception as e:
            print(f"[UnifiService] Login Error: {e}")
            cls._is_authenticated = False
            return False


    @classmethod
    def get_active_site(cls):
        try:
            site = cls._config.get("site_id", "default")
            url = urljoin(cls._config["api_url"], f"/api/s/{site}/stat/device")
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                res = cls._session.get(url, timeout=10.0)
            
            # If NoSiteContext, auto-discover site
            if res.status_code == 401 and "NoSiteContext" in res.text:
                sites_url = urljoin(cls._config["api_url"], "/api/stat/sites")
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    s_res = cls._session.get(sites_url, timeout=10.0)
                if s_res.status_code == 200:
                    data = s_res.json()
                    sites = data.get("data", [])
                    if sites and len(sites) > 0:
                        return sites[0].get("name", "default")
            
            return site
        except:
            return "default"

    @classmethod
    def get_devices(cls, retry=True):
        """Busca switches e APs (Devices) da controladora."""
        if not cls._is_authenticated:
            if not cls.authenticate():
                return []

        site = cls.get_active_site()
        # Endpoint to get adopted devices
        url = urljoin(cls._config["api_url"], f"/api/s/{site}/stat/device")
        
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                res = cls._session.get(url, timeout=10.0)
            
            if res.status_code == 200:
                data = res.json()
                return data.get("data", [])
            elif res.status_code == 401 and retry:
                # Token expired, re-authenticate
                cls._is_authenticated = False
                if cls.authenticate():
                    return cls.get_devices(retry=False)
            return []
        except Exception as e:
            print(f"[UnifiService] get_devices Error: {e}")
            return []

    @classmethod
    def get_clients(cls, retry=True):
        """Busca clientes (dispositivos conectados) da controladora."""
        if not cls._is_authenticated:
            if not cls.authenticate():
                return []

        site = cls.get_active_site()
        url = urljoin(cls._config["api_url"], f"/api/s/{site}/stat/sta")
        
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                res = cls._session.get(url, timeout=10.0)
            
            if res.status_code == 200:
                data = res.json()
                return data.get("data", [])
            return []
        except Exception as e:
            print(f"[UnifiService] get_clients Error: {e}")
            return []


def _normalize_mac(mac: str) -> str:
    """Normaliza endereço MAC para comparação segura."""
    if not mac:
        return ""
    return mac.lower().replace("-", "").replace(":", "").replace(".", "").strip()


def _get_or_create_unifi_system_user(db) -> "User":
    """Busca ou cria o usuário de sistema 'Sistema UniFi NOC' como solicitante de chamados automáticos."""
    from app.models.user import User, UserRole

    system_user = db.query(User).filter(
        (User.ad_username == "unifi.system") | (User.email == "unifi.noc@tihfsa.local")
    ).first()

    if not system_user:
        system_user = User(
            ad_username="unifi.system",
            email="unifi.noc@tihfsa.local",
            display_name="Sistema UniFi NOC",
            password_hash="N/A",
            role=UserRole.ADMIN,
            roles=["admin"],
            is_active=True,
        )
        db.add(system_user)
        db.commit()
        db.refresh(system_user)

    return system_user


def sync_active_unifi_devices(db) -> dict:
    """
    Monitora periodicamente dispositivos da controladora UniFi.
    1. Se um Switch ou Access Point fica OFFLINE (state == 0):
       - Cria automaticamente um chamado no TIHFSA caso não exista um em aberto.
       - Dispara notificação imediata com alerta para o grupo de TI no WhatsApp (Evolution API).
    2. Se o dispositivo retorna para ONLINE (state == 1) e havia chamado aberto:
       - Atualiza o chamado para PENDING_VALIDATION.
       - Dispara notificação de restabelecimento no WhatsApp.
    """
    try:
        from app.models.integration_config import UnifiConfig
        from app.models.asset import Asset
        from app.models.ticket import Ticket, TicketStatus, TicketPriority
        from app.services.evolution_service import EvolutionService
        from sqlalchemy import or_

        # 1. Verificar se a integração UniFi está configurada e ativa
        config = db.query(UnifiConfig).first()
        if not config or not config.is_active or not config.api_url:
            return {"status": "inactive", "message": "Integração UniFi não configurada ou inativa."}

        # 2. Buscar lista de dispositivos da controladora UniFi
        devices = UnifiService.get_devices()
        if not devices:
            return {"status": "no_devices", "message": "Nenhum dispositivo retornado pela controladora."}

        # 3. Mapear ativos importados no CMDB por MAC, IP e Nome
        imported_assets = db.query(Asset).filter(Asset.is_active == True).all()
        asset_by_mac = {}
        asset_by_ip = {}
        asset_by_name = {}

        for a in imported_assets:
            if a.mac_address:
                asset_by_mac[_normalize_mac(a.mac_address)] = a
            if a.ip_address:
                asset_by_ip[a.ip_address.strip()] = a
            if a.name:
                asset_by_name[a.name.strip().lower()] = a

        noc_user = None
        new_tickets_count = 0
        resolved_tickets_count = 0

        # 4. Iterar sobre os dispositivos da UniFi
        for d in devices:
            mac = (d.get("mac") or "").strip()
            ip = (d.get("ip") or "").strip()
            name = (d.get("name") or "").strip() or d.get("model") or "Dispositivo UniFi"
            model = d.get("model") or "UniFi"
            dev_type = (d.get("type") or "").lower()
            state = d.get("state")  # 1 = Online, 0 = Offline

            # Identificar tipo amigável e prioridade
            if dev_type == "uap" or "ap" in model.lower() or "u6" in model.lower() or "wifi" in model.lower():
                tipo_legivel = "Access Point (Wi-Fi)"
                prio = TicketPriority.HIGH
            elif dev_type == "usw" or "switch" in model.lower() or "usw" in model.lower():
                tipo_legivel = "Switch de Rede"
                prio = TicketPriority.CRITICAL
            elif dev_type in ["ugw", "udm", "uxg"] or "gateway" in model.lower() or "router" in model.lower():
                tipo_legivel = "Gateway / Roteador"
                prio = TicketPriority.CRITICAL
            else:
                tipo_legivel = "Dispositivo UniFi"
                prio = TicketPriority.HIGH

            # Vincular com ativo do CMDB se houver
            norm_mac = _normalize_mac(mac)
            matched_asset = None
            if norm_mac and norm_mac in asset_by_mac:
                matched_asset = asset_by_mac[norm_mac]
            elif ip and ip in asset_by_ip:
                matched_asset = asset_by_ip[ip]
            elif name and name.lower() in asset_by_name:
                matched_asset = asset_by_name[name.lower()]

            ticket_tag = f"[NOC UniFi] Dispositivo Offline - {name}"

            # Verificar se já existe chamado aberto para este dispositivo UniFi
            ticket_filters = [
                Ticket.title == ticket_tag,
                Ticket.title.like(f"[NOC UniFi] Dispositivo Offline - {name}%"),
            ]
            if matched_asset:
                ticket_filters.append(Ticket.asset_id == matched_asset.id)

            existing_ticket = (
                db.query(Ticket)
                .filter(
                    or_(*ticket_filters),
                    Ticket.status.in_([
                        TicketStatus.NEW,
                        TicketStatus.IN_PROGRESS,
                        TicketStatus.PENDING_VALIDATION,
                    ])
                )
                .first()
            )

            # CASO A: DISPOSITIVO OFFLINE (state == 0)
            if state == 0:
                if not existing_ticket:
                    if not noc_user:
                        noc_user = _get_or_create_unifi_system_user(db)

                    asset_id = matched_asset.id if matched_asset else None
                    category_id = matched_asset.category_id if matched_asset else None
                    subcategory_id = matched_asset.subcategory_id if matched_asset else None
                    location_name = matched_asset.location.name if (matched_asset and getattr(matched_asset, "location", None)) else "Infraestrutura de Rede"

                    new_ticket = Ticket(
                        title=ticket_tag,
                        description=(
                            f"Alerta Automático NOC UniFi: O equipamento '{name}' perdeu a conexão com a controladora UniFi e está OFFLINE.\n\n"
                            f"**Detalhes do Equipamento:**\n"
                            f"- Tipo: {tipo_legivel}\n"
                            f"- Modelo: {model}\n"
                            f"- IP: {ip or 'Sem IP atribuído'}\n"
                            f"- MAC: {mac or 'N/A'}\n"
                            f"- Localização: {location_name}\n"
                            f"- Ativo CMDB Vinculado: #{asset_id} ({matched_asset.name})\n" if matched_asset else ""
                            f"\nEste chamado foi aberto automaticamente pelo monitoramento para intervenção imediata da equipe de TI."
                        ),
                        status=TicketStatus.NEW,
                        priority=prio,
                        requester_id=noc_user.id,
                        asset_id=asset_id,
                        category_id=category_id,
                        subcategory_id=subcategory_id,
                    )
                    db.add(new_ticket)
                    db.commit()
                    db.refresh(new_ticket)
                    new_tickets_count += 1
                    print(f"[UniFi Poller] Chamado #{new_ticket.id} aberto para {name} (Offline)")

                    # Disparo da Notificação de Alerta Imediato no WhatsApp
                    try:
                        msg_text = (
                            f"🚨 *ALERTA UNIFI: DISPOSITIVO OFFLINE* 🚨\n\n"
                            f"⚠️ *Equipamento:* {name}\n"
                            f"🏷️ *Tipo:* {tipo_legivel} ({model})\n"
                            f"🌐 *IP:* {ip or 'Sem IP'} | *MAC:* {mac or 'N/A'}\n"
                            f"🔴 *Status:* Desconectado na Controladora UniFi\n\n"
                            f"🎫 *Chamado automático aberto:* #{new_ticket.id}"
                        )
                        EvolutionService.send_whatsapp_message(msg_text)
                    except Exception as err:
                        print(f"[UniFi Poller WhatsApp Error] {err}")

            # CASO B: DISPOSITIVO RESTABELECIDO / ONLINE (state == 1)
            elif state == 1 and existing_ticket:
                # Se o chamado estava aberto e foi gerado pelo NOC UniFi, auto-resolver para PENDING_VALIDATION
                if existing_ticket.status in [TicketStatus.NEW, TicketStatus.IN_PROGRESS] and "[NOC UniFi]" in existing_ticket.title:
                    existing_ticket.status = TicketStatus.PENDING_VALIDATION
                    existing_ticket.description = str(existing_ticket.description) + (
                        f"\n\n✅ [SISTEMA] Dispositivo Online! Conexão restabelecida com sucesso na controladora UniFi. "
                        f"Aguardando validação manual da equipe de TI para encerramento."
                    )
                    db.commit()
                    resolved_tickets_count += 1
                    print(f"[UniFi Poller] Chamado #{existing_ticket.id} para {name} atualizado para PENDING_VALIDATION")

                    # Disparo de Notificação de Normalização no WhatsApp
                    try:
                        msg_text = (
                            f"✅ *UNIFI: DISPOSITIVO ONLINE!* ✅\n\n"
                            f"O equipamento *{name}* ({model}) restabeleceu a comunicação com a controladora UniFi.\n\n"
                            f"🎫 O chamado *#{existing_ticket.id}* está aguardando validação para encerramento."
                        )
                        EvolutionService.send_whatsapp_message(msg_text)
                    except Exception as err:
                        print(f"[UniFi Poller WhatsApp Auto-Resolve Error] {err}")

        return {
            "status": "success",
            "total_devices": len(devices),
            "new_tickets": new_tickets_count,
            "resolved_tickets": resolved_tickets_count,
        }

    except Exception as e:
        print(f"[UniFi Sync Error] {e}")
        return {"status": "error", "message": str(e)}
