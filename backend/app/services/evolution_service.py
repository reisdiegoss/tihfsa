import httpx
from urllib.parse import urlparse, urlunparse
from app.database import SessionLocal
from app.models.integration_config import EvolutionConfig

KNOWN_HOST_IP_FALLBACKS = {
    "evo2.fassa26.fasanobr.local": "192.168.168.26"
}


def safe_evolution_request(method: str, url: str, headers: dict = None, json: dict = None, timeout: float = 15.0) -> httpx.Response:
    """
    Executa requisição HTTP para a Evolution API com resiliência contra falhas de DNS interno (.local).
    Caso a máquina Linux/servidor falhe ao resolver 'evo2.fassa26.fasanobr.local' via DNS corporativo,
    realiza o fallback transparente para o IP direto mantendo o cabeçalho Host.
    """
    req_headers = dict(headers or {})
    parsed = urlparse(url)
    hostname = parsed.hostname or ""

    # Se a URL já aponta para o IP conhecido, assegurar o header Host para o virtual host do proxy
    if hostname == "192.168.168.26" and "Host" not in req_headers:
        req_headers["Host"] = "evo2.fassa26.fasanobr.local"

    try:
        return httpx.request(method, url, headers=req_headers, json=json, timeout=timeout, verify=False)
    except (httpx.ConnectError, httpx.RequestError) as e:
        err_str = str(e).lower()
        is_dns_error = any(kw in err_str for kw in ["name resolution", "getaddrinfo", "errno -3", "nodename nor servname", "nameresolutionerror"])
        
        # Se for falha de resolução e temos IP de fallback conhecido
        if is_dns_error and hostname in KNOWN_HOST_IP_FALLBACKS:
            fallback_ip = KNOWN_HOST_IP_FALLBACKS[hostname]
            port_suffix = f":{parsed.port}" if parsed.port else ""
            fallback_netloc = f"{fallback_ip}{port_suffix}"
            fallback_url = urlunparse(parsed._replace(netloc=fallback_netloc))
            
            fallback_headers = dict(req_headers)
            fallback_headers["Host"] = hostname
            
            print(f"[Evolution API] Fallback DNS acionado com sucesso: {hostname} -> {fallback_ip}")
            return httpx.request(method, fallback_url, headers=fallback_headers, json=json, timeout=timeout, verify=False)
        raise


class EvolutionService:
    @classmethod
    def send_whatsapp_message_with_status(
        cls,
        text: str,
        recipient: str | None = None,
        ticket_id: int | None = None,
        recipient_name: str | None = None,
    ) -> tuple[bool, str]:
        """
        Envia mensagem via Evolution API para o Grupo de TI ou para um destinatário específico (ex: telefone do solicitante).
        Retorna tupla (sucesso: bool, mensagem_diagnostico: str).
        """
        try:
            with SessionLocal() as db:
                config = db.query(EvolutionConfig).first()
                if not config or not config.is_active:
                    return False, "Integração do WhatsApp desativada nas configurações."

                if not config.api_url or not config.instance_name or not config.api_key:
                    return False, "Configurações incompletas (URL, Instância ou API Key)."

                url = f"{config.api_url.rstrip('/')}/send/text"
                api_key = config.api_key
                ti_group_jid = config.ti_group_jid

            headers = {
                "apikey": api_key,
                "Content-Type": "application/json"
            }

            if recipient:
                import re
                clean_num = re.sub(r"\D", "", str(recipient))
                if clean_num.startswith("0"):
                    clean_num = clean_num[1:]
                if len(clean_num) in (10, 11) and not clean_num.startswith("55"):
                    clean_num = f"55{clean_num}"
                if len(clean_num) < 10:
                    return False, f"Número de telefone '{recipient}' inválido para WhatsApp."
                jids = [clean_num]
            else:
                if not ti_group_jid:
                    return False, "Nenhum grupo de TI configurado."
                jids = [j.strip() for j in ti_group_jid.split(",") if j.strip()]

            if not jids:
                return False, "Nenhum destinatário definido para envio."

            sent_any = False
            last_err_msg = ""

            for base_jid in jids:
                jid = base_jid
                if not jid.endswith("@g.us") and not jid.endswith("@s.whatsapp.net"):
                    if "-" in jid or len(jid) > 15:
                        jid = f"{jid}@g.us"
                    else:
                        jid = f"{jid}@s.whatsapp.net"

                payload = {
                    "number": jid,
                    "text": text
                }

                response = safe_evolution_request("POST", url, headers=headers, json=payload, timeout=12.0)
                
                if response.status_code in [200, 201]:
                    print(f"[Evolution API] Mensagem enviada com sucesso para {jid}.")
                    sent_any = True
                    try:
                        from app.services.email_service import log_notification
                        log_notification(
                            channel="WHATSAPP",
                            notification_type="WHATSAPP_MSG",
                            recipient=jid,
                            recipient_name=recipient_name or ("Grupo TI" if not recipient else "Solicitante"),
                            subject=text[:60] + "..." if len(text) > 60 else text,
                            body=text,
                            ticket_id=ticket_id,
                            status="SENT",
                        )
                    except Exception:
                        pass
                else:
                    resp_text = response.text or ""
                    print(f"[Evolution API] Falha ao enviar para {jid}: {response.status_code} - {resp_text}")
                    if "the store doesn't contain a device JID" in resp_text or "device JID" in resp_text:
                        last_err_msg = "O WhatsApp está desconectado na Evolution API. É necessário reconectar o WhatsApp lendo o QR Code no painel da Evolution."
                    else:
                        last_err_msg = f"Erro {response.status_code} da Evolution API: {resp_text[:120]}"

                    try:
                        from app.services.email_service import log_notification
                        log_notification(
                            channel="WHATSAPP",
                            notification_type="WHATSAPP_MSG",
                            recipient=jid,
                            recipient_name=recipient_name or ("Grupo TI" if not recipient else "Solicitante"),
                            subject=text[:60] + "..." if len(text) > 60 else text,
                            body=text,
                            ticket_id=ticket_id,
                            status="FAILED",
                            error_message=last_err_msg,
                        )
                    except Exception:
                        pass

            if sent_any:
                return True, "Mensagem enviada com sucesso para o WhatsApp!"
            return False, last_err_msg or "Falha ao enviar mensagem no WhatsApp."

        except Exception as e:
            err_detail = f"Erro de conexão com a Evolution API: {str(e)}"
            print(f"[Evolution API] {err_detail}")
            return False, err_detail

    @classmethod
    def send_whatsapp_message(
        cls,
        text: str,
        recipient: str | None = None,
        ticket_id: int | None = None,
        recipient_name: str | None = None,
    ) -> bool:
        """
        Envia uma mensagem no WhatsApp para o Grupo de TI ou para um destinatário usando a Evolution API.
        """
        success, _ = cls.send_whatsapp_message_with_status(
            text=text,
            recipient=recipient,
            ticket_id=ticket_id,
            recipient_name=recipient_name,
        )
        return success

