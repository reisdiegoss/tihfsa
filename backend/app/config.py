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
    app_base_url: str = "http://localhost:5173"

    model_config = {
        "env_file": str(Path(__file__).resolve().parents[2] / ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
