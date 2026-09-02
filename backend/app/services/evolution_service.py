import httpx
from app.database import SessionLocal
from app.models.integration_config import EvolutionConfig

class EvolutionService:
    @staticmethod
    def send_whatsapp_message(text: str):
        """
        Envia uma mensagem no WhatsApp para o Grupo de TI usando a Evolution API.
        Lê a configuração da tabela evolution_config.
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
                jid = config.ti_group_jid

            headers = {
                "apikey": api_key,
                "Content-Type": "application/json"
            }
            # Enviar para cada grupo selecionado
            jids = [j.strip() for j in config.ti_group_jid.split(",") if j.strip()]
            
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

                response = httpx.post(url, json=payload, headers=headers, timeout=10.0, verify=False)
                
                if response.status_code in [200, 201]:
                    print(f"[Evolution API] Mensagem enviada com sucesso para {jid}.")
                else:
                    print(f"[Evolution API] Falha ao enviar para {jid}: {response.status_code} - {response.text}")
                
        except Exception as e:
            print(f"[Evolution API] Erro na requisição: {e}")
