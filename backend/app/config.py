"""
Settings centralizados via Pydantic BaseSettings.
Lê automaticamente do .env na raiz do projeto.
"""
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str

    # LDAP / Active Directory
    ldap_host: str
    ldap_port: int = 389
    ldap_base_dn: str
    ldap_bind_user: str
    ldap_bind_password: str

    # JWT
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 480

    # SMTP
    smtp_host: str = "smtp-mail.outlook.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_name: str = "TIHFSA - Hotel Fasano Salvador"

    # Zabbix
    zabbix_api_url: str = ""
    zabbix_user: str = ""
    zabbix_password: str = ""

    # Admin Root (fora do LDAP)
    admin_username: str = "admin"
    admin_password: str = "Netfasano@sa1"
    admin_email: str = "ti@fasanosalvador.com.br"

    # App
    app_name: str = "TIHFSA"
    app_base_url: str = "https://fassa29"

    model_config = {
        "env_file": str(Path(__file__).resolve().parents[2] / ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()


def get_app_base_url() -> str:
    """
    Retorna a URL base canônica para links de e-mails, validações e portais do TIHFSA.
    Garante 'https://fassa29' como destino oficial, substituindo automaticamente
    qualquer resquício de localhost, 127.0.0.1 ou IPs locais antigos (192.168.168.29/26).
    """
    raw_url = (getattr(settings, "app_base_url", None) or "").strip().rstrip("/")
    if not raw_url:
        return "https://fassa29"

    bad_patterns = ["localhost", "127.0.0.1", "192.168.168.29", "192.168.168.26", ":5173", ":3000", ":8000"]
    if any(pat in raw_url.lower() for pat in bad_patterns):
        return "https://fassa29"

    return raw_url

