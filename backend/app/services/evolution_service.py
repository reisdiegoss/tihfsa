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
    @staticmethod
    def send_whatsapp_message(text: str):
        """
        Envia uma mensagem no WhatsApp para o Grupo de TI usando a Evolution API.
        Lê a configuração da tabela evolution_config com tolerância a falhas de DNS.
        """
        try:
            with SessionLocal() as db:
                config = db.query(EvolutionConfig).first()
                if not config or not config.is_active:
                    return

                if not config.api_url or not config.instance_name or not config.api_key or not config.ti_group_jid:
                    print("[Evolution API] Configuração incompleta. Notificação não enviada.")
                    return

                url = f"{config.api_url.rstrip('/')}/send/text"
                api_key = config.api_key
                ti_group_jid = config.ti_group_jid

            headers = {
                "apikey": api_key,
                "Content-Type": "application/json"
            }
            # Enviar para cada grupo selecionado
            jids = [j.strip() for j in ti_group_jid.split(",") if j.strip()]
            
            for base_jid in jids:
                jid = base_jid
                # O JID do grupo geralmente tem o sufixo @g.us
                if not jid.endswith("@g.us") and not jid.endswith("@s.whatsapp.net"):
                    # Fallback, tenta inferir se é grupo (geralmente hifens ou mais longo)
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
                else:
                    print(f"[Evolution API] Falha ao enviar para {jid}: {response.status_code} - {response.text}")
                
        except Exception as e:
            print(f"[Evolution API] Erro na requisição: {e}")

