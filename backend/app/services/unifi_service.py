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

    @classmethod
    def get_critical_logs(cls, retry=True):
        """Busca logs críticos e eventos não resolvidos da controladora (Next-AI / Critical Logs)."""
        if not cls._is_authenticated:
            if not cls.authenticate():
                return []

        site = cls.get_active_site()
        url = urljoin(cls._config["api_url"], f"/v2/api/site/{site}/next-ai/logs")
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                res = cls._session.get(url, timeout=10.0)

            if res.status_code == 200:
                data = res.json()
                if isinstance(data, list):
                    return data
                return data.get("data", [])
            elif res.status_code == 401 and retry:
                cls._is_authenticated = False
                if cls.authenticate():
                    return cls.get_critical_logs(retry=False)
            return []
        except Exception as e:
            print(f"[UnifiService] get_critical_logs Error: {e}")
            return []

    @classmethod
    def get_unresolved_alarms(cls, retry=True):
        """Busca alarmes não arquivados da controladora (ex: loops STP, PoE, conflitos)."""
        if not cls._is_authenticated:
            if not cls.authenticate():
                return []

        site = cls.get_active_site()
        url = urljoin(cls._config["api_url"], f"/api/s/{site}/stat/alarm?archived=false")
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                res = cls._session.get(url, timeout=10.0)

            if res.status_code == 200:
                data = res.json()
                items = data.get("data", [])
                filtered = [
                    a for a in items
                    if a.get("key") not in ["EVT_AP_Lost_Contact", "EVT_SW_Lost_Contact"]
                ]
                return filtered
            elif res.status_code == 401 and retry:
                cls._is_authenticated = False
                if cls.authenticate():
                    return cls.get_unresolved_alarms(retry=False)
            return []
        except Exception as e:
            print(f"[UnifiService] get_unresolved_alarms Error: {e}")
            return []

    @classmethod
    def get_all_users_history(cls, within_hours=24, retry=True):
        """Busca histórico recente de clientes conhecidos na controladora (para cruzamento de IP e MAC)."""
        if not cls._is_authenticated:
            if not cls.authenticate():
                return []

        site = cls.get_active_site()
        url = urljoin(cls._config["api_url"], f"/api/s/{site}/stat/alluser?within={within_hours}")
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                res = cls._session.get(url, timeout=15.0)

            if res.status_code == 200:
                data = res.json()
                return data.get("data", [])
            elif res.status_code == 401 and retry:
                cls._is_authenticated = False
                if cls.authenticate():
                    return cls.get_all_users_history(within_hours=within_hours, retry=False)
            return []
        except Exception as e:
            print(f"[UnifiService] get_all_users_history Error: {e}")
            return []

    @classmethod
    def get_detected_ip_conflicts(cls):
        """
        Detecta conflitos de IP ativos e recentes na rede:
        1. Múltiplos dispositivos conectados com o mesmo IP.
        2. Dispositivo conectado cujo IP bate com histórico recente de outro cliente com MAC diferente.
        Retorna dicionário {ip: [lista de dispositivos]}.
        """
        from collections import defaultdict
        clients = cls.get_clients()
        if not clients:
            return {}

        devices = cls.get_devices()
        sw_map = {d.get("mac"): d.get("name") or d.get("model") or "Switch" for d in devices if d.get("mac")}
        ap_map = {d.get("mac"): d.get("name") or d.get("model") or "AP" for d in devices if d.get("mac")}

        active_ip_map = defaultdict(list)
        for c in clients:
            ip = (c.get("ip") or "").strip()
            mac = (c.get("mac") or "").strip()
            if ip and ip not in ["0.0.0.0", "127.0.0.1"]:
                sw_mac = c.get("sw_mac")
                ap_mac = c.get("ap_mac")
                c_data = {
                    "mac": mac,
                    "name": c.get("name") or c.get("hostname") or c.get("oui") or "Dispositivo",
                    "hostname": c.get("hostname"),
                    "ip": ip,
                    "is_wired": c.get("is_wired", False),
                    "network": c.get("network") or "Padrão",
                    "switch_name": sw_map.get(sw_mac, sw_mac or "N/A"),
                    "switch_port": c.get("sw_port"),
                    "ap_name": ap_map.get(ap_mac, ap_mac or "N/A"),
                    "is_active": True,
                }
                active_ip_map[ip].append(c_data)

        conflicts = {}
        # Conflito 1: Mais de um MAC ativo simultaneamente no mesmo IP
        for ip, dev_list in active_ip_map.items():
            unique_macs = {d["mac"].lower() for d in dev_list if d.get("mac")}
            if len(unique_macs) > 1:
                conflicts[ip] = dev_list

        # Conflito 2: Cruzar cliente ativo com histórico recente de 24h
        allusers = cls.get_all_users_history(within_hours=24)
        if allusers:
            for c in clients:
                ip = (c.get("ip") or "").strip()
                mac = (c.get("mac") or "").strip().lower()
                if not ip or ip in ["0.0.0.0", "127.0.0.1"]:
                    continue

                other_users = [
                    u for u in allusers
                    if (u.get("ip") == ip or u.get("last_ip") == ip)
                    and (u.get("mac") or "").strip().lower() != mac
                ]
                if other_users:
                    if ip not in conflicts:
                        sw_mac = c.get("sw_mac")
                        ap_mac = c.get("ap_mac")
                        conflicts[ip] = [{
                            "mac": c.get("mac"),
                            "name": c.get("name") or c.get("hostname") or c.get("oui") or "Dispositivo",
                            "hostname": c.get("hostname"),
                            "ip": ip,
                            "is_wired": c.get("is_wired", False),
                            "network": c.get("network") or "Padrão",
                            "switch_name": sw_map.get(sw_mac, sw_mac or "N/A"),
                            "switch_port": c.get("sw_port"),
                            "ap_name": ap_map.get(ap_mac, ap_mac or "N/A"),
                            "is_active": True,
                        }]
                    for ou in other_users:
                        ou_mac = (ou.get("mac") or "").strip().lower()
                        if not any(d["mac"].lower() == ou_mac for d in conflicts[ip]):
                            ou_sw = ou.get("sw_mac")
                            ou_ap = ou.get("ap_mac")
                            conflicts[ip].append({
                                "mac": ou.get("mac"),
                                "name": ou.get("name") or ou.get("hostname") or ou.get("oui") or "Dispositivo",
                                "hostname": ou.get("hostname"),
                                "ip": ip,
                                "is_wired": ou.get("is_wired", False),
                                "network": ou.get("network") or "Padrão",
                                "switch_name": sw_map.get(ou_sw, ou_sw or "N/A"),
                                "switch_port": ou.get("sw_port"),
                                "ap_name": ap_map.get(ou_ap, ou_ap or "N/A"),
                                "is_active": False,
                                "is_historical": True,
                            })

        return conflicts


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

            # 5. Cálculo do Início do Dia no Fuso Horário de Brasília/Salvador (UTC-3)
            from datetime import datetime, timezone, timedelta
            from app.models.ticket_interaction import TicketInteraction
            from app.services.email_service import send_noc_dual_notification

            tz_br = timezone(timedelta(hours=-3))
            now_br = datetime.now(tz_br)
            today_start_br = datetime(now_br.year, now_br.month, now_br.day, 0, 0, 0, tzinfo=tz_br)
            today_start_utc = today_start_br.astimezone(timezone.utc)
            hora_formatada = now_br.strftime("%d/%m/%Y às %H:%M:%S")

            ticket_tag = f"[NOC UniFi] Dispositivo Offline - {name}"

            # 6. Buscar o chamado mais recente deste dispositivo criado no DIA DE HOJE
            today_ticket = db.query(Ticket).filter(
                or_(
                    Ticket.title == ticket_tag,
                    Ticket.title.like(f"[NOC UniFi] Dispositivo Offline - {name}%"),
                    (Ticket.asset_id == matched_asset.id) if matched_asset else False,
                ),
                Ticket.title.like("[NOC UniFi] %"),
                Ticket.created_at >= today_start_utc,
            ).order_by(Ticket.created_at.desc()).first()

            if not noc_user:
                noc_user = _get_or_create_unifi_system_user(db)

            asset_id = matched_asset.id if matched_asset else None
            category_id = matched_asset.category_id if matched_asset else None
            subcategory_id = matched_asset.subcategory_id if matched_asset else None
            location_name = matched_asset.location.name if (matched_asset and getattr(matched_asset, "location", None)) else "Infraestrutura de Rede"

            # ── CASO A: DISPOSITIVO OFFLINE (state == 0) ──────────────────────────
            if state == 0:
                if today_ticket:
                    # Se o chamado do dia estava Fechado ou Aguardando Validação, REABRE!
                    if today_ticket.status in [TicketStatus.CLOSED, TicketStatus.REJECTED, TicketStatus.PENDING_VALIDATION]:
                        today_ticket.status = TicketStatus.IN_PROGRESS
                        today_ticket.closed_at = None
                        today_ticket.solved_at = None
                        today_ticket.updated_at = datetime.now(timezone.utc)

                        reopen_note = (
                            f"🚨 [NOC UniFi] Dispositivo caiu novamente às {hora_formatada}!\n"
                            f"Equipamento desconectou na controladora UniFi. Chamado #{today_ticket.id} reaberto automaticamente pelo monitoramento para atendimento da equipe de TI."
                        )
                        interaction = TicketInteraction(
                            ticket_id=today_ticket.id,
                            user_id=noc_user.id,
                            message=reopen_note,
                            is_solution=False,
                        )
                        db.add(interaction)
                        today_ticket.description = str(today_ticket.description) + f"\n\n---\n⚠️ **Nova Queda Detectada ({hora_formatada})**: Equipamento offline novamente na controladora UniFi."
                        db.commit()
                        print(f"[UniFi Poller] Chamado #{today_ticket.id} REABERTO para {name} (Caiu novamente)")

                        # Disparo Dual: WhatsApp + E-mail Corporativo
                        wa_msg = (
                            f"⚠️ *ALERTA UNIFI: DISPOSITIVO CAIU NOVAMENTE!* ⚠️\n\n"
                            f"O equipamento *{name}* ({tipo_legivel}) perdeu a conexão com a controladora e caiu novamente.\n"
                            f"🌐 *IP:* {ip or 'Sem IP'} | *MAC:* {mac or 'N/A'}\n"
                            f"🕒 *Horário:* {hora_formatada}\n\n"
                            f"🎫 *Chamado #{today_ticket.id} REABERTO!*\n"
                            f"👉 Atenção equipe de TI: favor verificar e intervir imediatamente!"
                        )
                        mail_html = (
                            f"<p>O equipamento <strong>{name}</strong> ({tipo_legivel} - {model}) perdeu a conexão com a controladora e <strong>caiu novamente</strong>.</p>"
                            f"<p><strong>IP:</strong> {ip or 'N/A'} | <strong>MAC:</strong> {mac or 'N/A'}</p>"
                            f"<p><strong>Horário da Queda:</strong> {hora_formatada}</p>"
                            f"<p><strong>Localização:</strong> {location_name}</p>"
                            f"<p style='color: #b45309; font-weight: bold;'>O chamado #{today_ticket.id} do dia de hoje foi REABERTO automaticamente e requer atenção imediata do time de TI.</p>"
                        )
                        send_noc_dual_notification(
                            whatsapp_text=wa_msg,
                            email_subject=f"⚠️ [NOC REABERTO] {name} Caiu Novamente — Chamado #{today_ticket.id}",
                            email_title=f"Dispositivo Caiu Novamente: {name}",
                            email_details_html=mail_html,
                            status_type="warning",
                            ticket_id=today_ticket.id,
                        )

                else:
                    # Sem chamado no dia de hoje: Criar novo chamado do dia
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
                            f"- Horário da Queda: {hora_formatada}\n\n"
                            f"Este chamado foi aberto automaticamente pelo monitoramento para intervenção imediata da equipe de TI."
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

                    # Registrar interação inicial
                    first_interaction = TicketInteraction(
                        ticket_id=new_ticket.id,
                        user_id=noc_user.id,
                        message=f"🚨 [NOC UniFi] Chamado aberto automaticamente por queda do equipamento às {hora_formatada}.",
                        is_solution=False,
                    )
                    db.add(first_interaction)
                    db.commit()

                    # Disparo Dual: WhatsApp + E-mail Corporativo
                    wa_msg = (
                        f"🚨 *ALERTA UNIFI: DISPOSITIVO OFFLINE* 🚨\n\n"
                        f"⚠️ *Equipamento:* {name}\n"
                        f"🏷️ *Tipo:* {tipo_legivel} ({model})\n"
                        f"🌐 *IP:* {ip or 'Sem IP'} | *MAC:* {mac or 'N/A'}\n"
                        f"🔴 *Status:* Desconectado na Controladora UniFi\n"
                        f"🕒 *Horário:* {hora_formatada}\n\n"
                        f"🎫 *Chamado automático aberto:* #{new_ticket.id}"
                    )
                    mail_html = (
                        f"<p>O equipamento <strong>{name}</strong> ({tipo_legivel} - {model}) perdeu a conexão com a controladora UniFi e está <strong>OFFLINE</strong>.</p>"
                        f"<p><strong>IP:</strong> {ip or 'N/A'} | <strong>MAC:</strong> {mac or 'N/A'}</p>"
                        f"<p><strong>Localização:</strong> {location_name}</p>"
                        f"<p><strong>Horário da Queda:</strong> {hora_formatada}</p>"
                        f"<p style='color: #b91c1c; font-weight: bold;'>Chamado automático aberto: #{new_ticket.id}. Requer intervenção da equipe de TI.</p>"
                    )
                    send_noc_dual_notification(
                        whatsapp_text=wa_msg,
                        email_subject=f"🚨 [ALERTA NOC UniFi] {name} Offline — Chamado #{new_ticket.id}",
                        email_title=f"Dispositivo Offline: {name}",
                        email_details_html=mail_html,
                        status_type="danger",
                        ticket_id=new_ticket.id,
                    )

            # ── CASO B: DISPOSITIVO ONLINE / RESTABELECIDO (state == 1) ───────────
            elif state == 1 and today_ticket:
                # Se o chamado estava aberto (NEW ou IN_PROGRESS), avança para PENDING_VALIDATION
                if today_ticket.status in [TicketStatus.NEW, TicketStatus.IN_PROGRESS]:
                    today_ticket.status = TicketStatus.PENDING_VALIDATION
                    today_ticket.description = str(today_ticket.description) + (
                        f"\n\n✅ **Restabelecimento Detectado ({hora_formatada})**: Dispositivo Online! Conexão restabelecida com sucesso na controladora UniFi. "
                        f"Aguardando validação manual da equipe de TI para encerramento."
                    )
                    normal_note = (
                        f"✅ [NOC UniFi] Conexão restabelecida com a controladora às {hora_formatada}. Equipamento ONLINE!\n"
                        f"Chamado movido para Aguardando Validação. Favor validar o funcionamento e finalizar o chamado."
                    )
                    interaction = TicketInteraction(
                        ticket_id=today_ticket.id,
                        user_id=noc_user.id,
                        message=normal_note,
                        is_solution=True,
                    )
                    db.add(interaction)
                    db.commit()
                    resolved_tickets_count += 1
                    print(f"[UniFi Poller] Chamado #{today_ticket.id} para {name} atualizado para PENDING_VALIDATION")

                    # Disparo Dual: WhatsApp + E-mail Corporativo
                    wa_msg = (
                        f"✅ *UNIFI: DISPOSITIVO ONLINE!* ✅\n\n"
                        f"O equipamento *{name}* ({model}) restabeleceu a comunicação com a controladora UniFi.\n"
                        f"🕒 *Horário:* {hora_formatada}\n\n"
                        f"🎫 O chamado *#{today_ticket.id}* está aguardando validação para encerramento.\n"
                        f"👉 *Atenção equipe de TI: favor validar e finalizar o chamado no painel!*"
                    )
                    mail_html = (
                        f"<p>O equipamento <strong>{name}</strong> ({tipo_legivel} - {model}) restabeleceu a comunicação com a controladora UniFi e está <strong>ONLINE</strong>.</p>"
                        f"<p><strong>IP:</strong> {ip or 'N/A'} | <strong>MAC:</strong> {mac or 'N/A'}</p>"
                        f"<p><strong>Horário de Restabelecimento:</strong> {hora_formatada}</p>"
                        f"<p style='color: #15803d; font-weight: bold;'>O chamado #{today_ticket.id} foi movido para AGUARDANDO VALIDAÇÃO. Favor validar o equipamento e encerrar o chamado no painel.</p>"
                    )
                    send_noc_dual_notification(
                        whatsapp_text=wa_msg,
                        email_subject=f"✅ [NOC UniFi Online] {name} Normalizado — Chamado #{today_ticket.id}",
                        email_title=f"Dispositivo Online: {name}",
                        email_details_html=mail_html,
                        status_type="success",
                        ticket_id=today_ticket.id,
                    )

        # Executa verificação de alertas críticos e conflitos de IP na controladora
        critical_res = sync_active_unifi_critical_alarms(db)
        if isinstance(critical_res, dict):
            new_tickets_count += critical_res.get("new_tickets", 0)
            resolved_tickets_count += critical_res.get("resolved_tickets", 0)

        return {
            "status": "success",
            "total_devices": len(devices),
            "new_tickets": new_tickets_count,
            "resolved_tickets": resolved_tickets_count,
            "critical_events": critical_res.get("total_events", 0) if isinstance(critical_res, dict) else 0,
        }

    except Exception as e:
        print(f"[UniFi Sync Error] {e}")
        return {"status": "error", "message": str(e)}


def sync_active_unifi_critical_alarms(db) -> dict:
    """
    Monitora periodicamente QUALQUER alerta crítico registrado na controladora UniFi:
    1. Conflitos de IP (múltiplos dispositivos disputando o mesmo endereço IP).
    2. Logs Críticos e Unresolved Events (/v2/api/site/{site}/next-ai/logs):
       - Servidor DHCP fraudulento (Rogue DHCP) e esgotamento de DHCP
       - Loops de rede detectados por STP ou keepalive
       - Falha de energia ou alimentação em switch / RPS
       - Falhas de internet WAN / Failover LTE
       - Queda de túneis VPN Site-to-Site
       - Problemas de servidor RADIUS corporativo ou certificados
    3. Alarmes de infraestrutura não arquivados (/api/s/{site}/stat/alarm?archived=false):
       - Portas bloqueadas por STP (Spanning Tree), sobrecarga PoE, anomalias de gateway.
    """
    try:
        from datetime import datetime, timezone, timedelta
        from sqlalchemy import or_
        from app.models.integration_config import UnifiConfig
        from app.models.asset import Asset
        from app.models.ticket import Ticket, TicketStatus, TicketPriority
        from app.models.ticket_interaction import TicketInteraction
        from app.services.email_service import send_noc_dual_notification

        # 1. Verificar configuração ativa
        config = db.query(UnifiConfig).first()
        if not config or not config.is_active or not config.api_url:
            return {"status": "inactive", "message": "Integração UniFi inativa."}

        tz_br = timezone(timedelta(hours=-3))
        now_br = datetime.now(tz_br)
        today_start_br = datetime(now_br.year, now_br.month, now_br.day, 0, 0, 0, tzinfo=tz_br)
        today_start_utc = today_start_br.astimezone(timezone.utc)
        hora_formatada = now_br.strftime("%d/%m/%Y às %H:%M:%S")

        noc_user = _get_or_create_unifi_system_user(db)
        imported_assets = db.query(Asset).filter(Asset.is_active == True).all()
        asset_by_mac = {_normalize_mac(a.mac_address): a for a in imported_assets if a.mac_address}
        asset_by_ip = {a.ip_address.strip(): a for a in imported_assets if a.ip_address}

        new_tickets_count = 0
        resolved_tickets_count = 0
        total_events_count = 0

        # ── 1. CONFLITOS DE IP IDENTIFICADOS NA REDE ──────────────────────────
        conflicts = UnifiService.get_detected_ip_conflicts()
        for ip, devs in conflicts.items():
            total_events_count += 1
            ticket_tag = f"[NOC UniFi] Conflito de IP: {ip}"

            # Identificar se algum dos dispositivos em conflito está no CMDB
            matched_asset = None
            for d in devs:
                mac_norm = _normalize_mac(d.get("mac"))
                if mac_norm and mac_norm in asset_by_mac:
                    matched_asset = asset_by_mac[mac_norm]
                    break
            if not matched_asset and ip in asset_by_ip:
                matched_asset = asset_by_ip[ip]

            # Buscar chamado do dia de hoje para este conflito de IP
            today_ticket = db.query(Ticket).filter(
                or_(
                    Ticket.title == ticket_tag,
                    Ticket.title.like(f"%[NOC UniFi] Conflito de IP% {ip}%"),
                ),
                Ticket.created_at >= today_start_utc,
            ).order_by(Ticket.created_at.desc()).first()

            # Montar detalhes legíveis dos dispositivos envolvidos
            dev_lines_md = []
            dev_lines_wa = []
            dev_rows_html = []
            for idx, d in enumerate(devs, 1):
                name = d.get("name") or d.get("hostname") or "Dispositivo"
                mac = d.get("mac") or "N/A"
                sw = d.get("switch_name") or "N/A"
                port = d.get("switch_port") or "N/A"
                net = d.get("network") or "Padrão"
                is_wired = "Cabeado" if d.get("is_wired") else "Wi-Fi"
                status_disp = "Ativo no momento" if d.get("is_active") else "Histórico Recente"

                dev_lines_md.append(
                    f"- **Dispositivo {idx}**: {name} | MAC: `{mac}` | Conexão: {is_wired} | "
                    f"Switch: {sw} (Porta: {port}) | VLAN/Rede: {net} | Situação: {status_disp}"
                )
                dev_lines_wa.append(f"• *{name}* (MAC: `{mac}`) no switch *{sw}* (Porta {port}) [{status_disp}]")
                dev_rows_html.append(
                    f"<tr><td><strong>{name}</strong></td><td><code>{mac}</code></td>"
                    f"<td>{sw} (Porta {port})</td><td>{net}</td><td>{status_disp}</td></tr>"
                )

            devs_summary_md = "\n".join(dev_lines_md)
            devs_summary_wa = "\n".join(dev_lines_wa)
            devs_summary_html = "".join(dev_rows_html)

            # Caso A: Chamado já existe no dia
            if today_ticket:
                # Se estava fechado ou aguardando validação e o conflito continua, REABRE
                if today_ticket.status in [TicketStatus.CLOSED, TicketStatus.REJECTED, TicketStatus.PENDING_VALIDATION]:
                    today_ticket.status = TicketStatus.IN_PROGRESS
                    today_ticket.closed_at = None
                    today_ticket.solved_at = None
                    today_ticket.updated_at = datetime.now(timezone.utc)

                    reopen_note = (
                        f"🚨 [NOC UniFi] Conflito no IP {ip} detectado novamente às {hora_formatada}!\n"
                        f"Chamado #{today_ticket.id} reaberto automaticamente pelo monitoramento para intervenção da equipe de TI."
                    )
                    interaction = TicketInteraction(
                        ticket_id=today_ticket.id,
                        user_id=noc_user.id,
                        message=reopen_note,
                        is_solution=False,
                    )
                    db.add(interaction)
                    today_ticket.description = (
                        str(today_ticket.description)
                        + f"\n\n---\n⚠️ **Conflito Reincidente ({hora_formatada})**:\n{devs_summary_md}"
                    )
                    db.commit()
                    print(f"[UniFi Poller] Chamado #{today_ticket.id} REABERTO para Conflito de IP {ip}")

                    # Disparo Dual: WhatsApp + E-mail
                    wa_msg = (
                        f"⚠️ *ALERTA UNIFI: CONFLITO DE IP REINCIDENTE!* ⚠️\n\n"
                        f"Vários dispositivos voltaram a disputar o mesmo endereço IP: *{ip}*\n\n"
                        f"👥 *Dispositivos Envolvidos:*\n{devs_summary_wa}\n\n"
                        f"🕒 *Horário:* {hora_formatada}\n"
                        f"🎫 *Chamado #{today_ticket.id} REABERTO!*\n"
                        f"👉 Atenção equipe de TI: favor intervir para evitar paradas na rede."
                    )
                    mail_html = (
                        f"<p>Vários dispositivos voltaram a disputar o mesmo endereço IP: <strong style='color:#b91c1c;'>{ip}</strong>.</p>"
                        f"<table border='1' cellpadding='6' cellspacing='0' style='border-collapse:collapse;width:100%;margin:12px 0;'>"
                        f"<thead><tr style='background:#f3f4f6;'><th>Nome</th><th>MAC</th><th>Switch/Porta</th><th>Rede</th><th>Status</th></tr></thead>"
                        f"<tbody>{devs_summary_html}</tbody></table>"
                        f"<p style='color:#b45309;font-weight:bold;'>Chamado #{today_ticket.id} REABERTO automaticamente pelo monitoramento UniFi.</p>"
                    )
                    send_noc_dual_notification(
                        whatsapp_text=wa_msg,
                        email_subject=f"⚠️ [NOC REABERTO] Conflito de IP: {ip} — Chamado #{today_ticket.id}",
                        email_title=f"Conflito de IP Reincidente: {ip}",
                        email_details_html=mail_html,
                        status_type="warning",
                        ticket_id=today_ticket.id,
                    )

            else:
                # Caso B: Sem chamado no dia -> Abrir novo chamado automático
                new_ticket = Ticket(
                    title=ticket_tag,
                    description=(
                        f"🚨 **Alerta Automático NOC UniFi: Conflito de Endereço IP detectado na rede!**\n\n"
                        f"Vários dispositivos estão usando o mesmo endereço IP: **{ip}**.\n\n"
                        f"**Dispositivos Envolvidos no Conflito:**\n{devs_summary_md}\n\n"
                        f"**Orientações e Ações Recomendadas para a Equipe de TI:**\n"
                        f"1. Verifique a configuração de rede de cada equipamento para certificar-se de que nenhum está com IP estático incorreto configurado manualmente em duplicidade.\n"
                        f"2. Verifique se nenhum dispositivo está se comunicando com um servidor DHCP fraudulento (Rogue DHCP) na rede.\n"
                        f"3. Caso necessário, utilize a porta do switch indicada acima para isolamento temporário da máquina ou verificação do cabeamento físico.\n\n"
                        f"🕒 Horário da Detecção: {hora_formatada}\n"
                        f"Este chamado foi aberto automaticamente pelo monitoramento UniFi para atuação imediata da equipe de TI."
                    ),
                    status=TicketStatus.NEW,
                    priority=TicketPriority.CRITICAL,
                    requester_id=noc_user.id,
                    asset_id=matched_asset.id if matched_asset else None,
                    category_id=matched_asset.category_id if matched_asset else None,
                    subcategory_id=matched_asset.subcategory_id if matched_asset else None,
                )
                db.add(new_ticket)
                db.commit()
                db.refresh(new_ticket)
                new_tickets_count += 1
                print(f"[UniFi Poller] Chamado #{new_ticket.id} aberto para Conflito de IP: {ip}")

                first_interaction = TicketInteraction(
                    ticket_id=new_ticket.id,
                    user_id=noc_user.id,
                    message=f"🚨 [NOC UniFi] Chamado aberto automaticamente por detecção de conflito no IP {ip} às {hora_formatada}.",
                    is_solution=False,
                )
                db.add(first_interaction)
                db.commit()

                # Disparo Dual: WhatsApp + E-mail Corporativo
                wa_msg = (
                    f"🚨 *ALERTA NOC: CONFLITO DE IP DETECTADO* 🚨\n\n"
                    f"⚠️ *Descrição:* Vários dispositivos estão usando o mesmo endereço IP: *{ip}*\n"
                    f"🌐 *IP Conflitante:* {ip}\n\n"
                    f"👥 *Dispositivos em Conflito:*\n{devs_summary_wa}\n\n"
                    f"📌 *Recomendação:* Verifique se há IP estático duplicado ou servidor DHCP fraudulento na rede.\n"
                    f"🕒 *Horário:* {hora_formatada}\n\n"
                    f"🎫 *Chamado automático aberto:* #{new_ticket.id}"
                )
                mail_html = (
                    f"<p>Alerta Automático NOC UniFi: <strong>Conflito de IP</strong> detectado na rede.</p>"
                    f"<p>Vários dispositivos estão usando o mesmo endereço IP: <strong style='color:#b91c1c;font-size:16px;'>{ip}</strong>.</p>"
                    f"<table border='1' cellpadding='6' cellspacing='0' style='border-collapse:collapse;width:100%;margin:12px 0;'>"
                    f"<thead><tr style='background:#f3f4f6;'><th>Nome</th><th>MAC</th><th>Switch/Porta</th><th>Rede</th><th>Status</th></tr></thead>"
                    f"<tbody>{devs_summary_html}</tbody></table>"
                    f"<p><strong>Ação Recomendada:</strong> Verifique as máquinas listadas para garantir que não haja IP estático duplicado ou servidor DHCP fraudulento (Rogue DHCP).</p>"
                    f"<p style='color:#b91c1c;font-weight:bold;'>Chamado automático aberto: #{new_ticket.id}. Requer intervenção da equipe de TI.</p>"
                )
                send_noc_dual_notification(
                    whatsapp_text=wa_msg,
                    email_subject=f"🚨 [ALERTA NOC UniFi] Conflito de IP: {ip} — Chamado #{new_ticket.id}",
                    email_title=f"Conflito de IP na Rede: {ip}",
                    email_details_html=mail_html,
                    status_type="danger",
                    ticket_id=new_ticket.id,
                )

        # ── 2. LOGS CRÍTICOS DA CONTROLADORA (Next-AI / Critical Logs) ─────────
        critical_logs = UnifiService.get_critical_logs()
        for log in critical_logs:
            total_events_count += 1
            log_id = str(log.get("id") or log.get("_id") or "")
            msg = log.get("message") or log.get("event") or log.get("description") or "Alerta Crítico UniFi"
            category = log.get("category") or "SISTEMA"
            key = log.get("key") or "CRITICAL_EVENT"

            ticket_tag = f"[NOC UniFi] Evento Crítico: {key}"

            today_ticket = db.query(Ticket).filter(
                or_(
                    Ticket.title == ticket_tag,
                    Ticket.title.like(f"%[NOC UniFi] Evento Crítico% {key}%"),
                ),
                Ticket.created_at >= today_start_utc,
            ).order_by(Ticket.created_at.desc()).first()

            if not today_ticket:
                new_ticket = Ticket(
                    title=ticket_tag,
                    description=(
                        f"🚨 **Alerta Automático NOC UniFi: Evento Crítico Registrado na Controladora!**\n\n"
                        f"**Mensagem do Evento:**\n{msg}\n\n"
                        f"- Categoria: {category}\n"
                        f"- Chave: {key}\n"
                        f"- Identificador do Log: {log_id}\n"
                        f"- Horário: {hora_formatada}\n\n"
                        f"Este chamado foi aberto automaticamente pelo monitoramento UniFi para atuação imediata da equipe de TI."
                    ),
                    status=TicketStatus.NEW,
                    priority=TicketPriority.CRITICAL,
                    requester_id=noc_user.id,
                )
                db.add(new_ticket)
                db.commit()
                db.refresh(new_ticket)
                new_tickets_count += 1

                first_interaction = TicketInteraction(
                    ticket_id=new_ticket.id,
                    user_id=noc_user.id,
                    message=f"🚨 [NOC UniFi] Chamado aberto automaticamente para o alerta crítico {key} às {hora_formatada}.",
                    is_solution=False,
                )
                db.add(first_interaction)
                db.commit()

                wa_msg = (
                    f"🚨 *ALERTA NOC: EVENTO CRÍTICO UNIFI* 🚨\n\n"
                    f"⚠️ *Alerta:* {key}\n"
                    f"📝 *Detalhes:* {msg}\n"
                    f"🕒 *Horário:* {hora_formatada}\n\n"
                    f"🎫 *Chamado automático aberto:* #{new_ticket.id}"
                )
                mail_html = (
                    f"<p>Alerta Automático NOC UniFi: <strong>Evento Crítico na Controladora</strong>.</p>"
                    f"<p><strong>Chave:</strong> {key}</p>"
                    f"<p><strong>Descrição:</strong> {msg}</p>"
                    f"<p style='color:#b91c1c;font-weight:bold;'>Chamado automático aberto: #{new_ticket.id}. Requer atenção imediata da equipe de TI.</p>"
                )
                send_noc_dual_notification(
                    whatsapp_text=wa_msg,
                    email_subject=f"🚨 [ALERTA NOC UniFi] {key} — Chamado #{new_ticket.id}",
                    email_title=f"Alerta Crítico UniFi: {key}",
                    email_details_html=mail_html,
                    status_type="danger",
                    ticket_id=new_ticket.id,
                )

        # ── 3. ALARMES NÃO ARQUIVADOS DA CONTROLADORA (stat/alarm) ─────────────
        unresolved_alarms = UnifiService.get_unresolved_alarms()
        for alarm in unresolved_alarms:
            total_events_count += 1
            alarm_id = str(alarm.get("_id") or "")
            key = alarm.get("key") or "ALARM_UNIFI"
            msg = alarm.get("msg") or f"Alarme {key} gerado pela controladora UniFi"
            subsystem = alarm.get("subsystem") or "Geral"

            ticket_tag = f"[NOC UniFi] Alarme: {key}"

            today_ticket = db.query(Ticket).filter(
                or_(
                    Ticket.title == ticket_tag,
                    Ticket.title.like(f"%[NOC UniFi] Alarme% {key}%"),
                ),
                Ticket.created_at >= today_start_utc,
            ).order_by(Ticket.created_at.desc()).first()

            if not today_ticket:
                prio = TicketPriority.CRITICAL if ("stp" in key.lower() or "conflict" in key.lower() or "rogue" in key.lower()) else TicketPriority.HIGH
                new_ticket = Ticket(
                    title=ticket_tag,
                    description=(
                        f"🚨 **Alerta Automático NOC UniFi: Alarme Ativo na Controladora!**\n\n"
                        f"**Mensagem do Alarme:**\n{msg}\n\n"
                        f"- Subsistema: {subsystem}\n"
                        f"- Chave: {key}\n"
                        f"- Identificador: {alarm_id}\n"
                        f"- Horário: {hora_formatada}\n\n"
                        f"Este chamado foi aberto automaticamente pelo monitoramento UniFi para investigação e atendimento da equipe de TI."
                    ),
                    status=TicketStatus.NEW,
                    priority=prio,
                    requester_id=noc_user.id,
                )
                db.add(new_ticket)
                db.commit()
                db.refresh(new_ticket)
                new_tickets_count += 1

                first_interaction = TicketInteraction(
                    ticket_id=new_ticket.id,
                    user_id=noc_user.id,
                    message=f"🚨 [NOC UniFi] Chamado aberto automaticamente para o alarme {key} às {hora_formatada}.",
                    is_solution=False,
                )
                db.add(first_interaction)
                db.commit()

                wa_msg = (
                    f"🚨 *ALERTA NOC: ALARME ATIVO UNIFI* 🚨\n\n"
                    f"⚠️ *Alarme:* {key} ({subsystem})\n"
                    f"📝 *Detalhes:* {msg}\n"
                    f"🕒 *Horário:* {hora_formatada}\n\n"
                    f"🎫 *Chamado automático aberto:* #{new_ticket.id}"
                )
                mail_html = (
                    f"<p>Alerta Automático NOC UniFi: <strong>Alarme Ativo na Controladora</strong>.</p>"
                    f"<p><strong>Chave:</strong> {key} ({subsystem})</p>"
                    f"<p><strong>Detalhes:</strong> {msg}</p>"
                    f"<p style='color:#b91c1c;font-weight:bold;'>Chamado automático aberto: #{new_ticket.id}. Requer intervenção da equipe de TI.</p>"
                )
                send_noc_dual_notification(
                    whatsapp_text=wa_msg,
                    email_subject=f"🚨 [ALERTA NOC UniFi] {key} — Chamado #{new_ticket.id}",
                    email_title=f"Alarme UniFi: {key}",
                    email_details_html=mail_html,
                    status_type="danger" if prio == TicketPriority.CRITICAL else "warning",
                    ticket_id=new_ticket.id,
                )

        return {
            "status": "success",
            "total_events": total_events_count,
            "new_tickets": new_tickets_count,
            "resolved_tickets": resolved_tickets_count,
        }

    except Exception as e:
        print(f"[UniFi Critical Alarms Error] {e}")
        return {"status": "error", "message": str(e)}

