"""
Migração e criação de tabelas para Configurações do Sistema e Pesquisa CSAT.
Hotel Fasano Salvador — TI Corporativa
"""
import sys
import os

# Adiciona o diretório backend ao path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from sqlalchemy import inspect, text
from app.database import engine, Base, SessionLocal
from app.models.system_setting import SystemSetting
from app.models.satisfaction_survey import TicketSatisfactionSurvey
from app.models.ticket import Ticket


def migrate():
    print("[1/3] Verificando e criando novas tabelas...")
    Base.metadata.create_all(bind=engine)
    print(" [+] Tabelas verificadas/criadas com sucesso.")

    print("[2/3] Verificando colunas adicionais na tabela 'tickets'...")
    inspector = inspect(engine)
    columns = [col["name"] for col in inspector.get_columns("tickets")]

    with engine.connect() as conn:
        if "reopened_at" not in columns:
            print(" [+] Adicionando coluna 'reopened_at' à tabela tickets...")
            conn.execute(text("ALTER TABLE tickets ADD COLUMN reopened_at TIMESTAMP WITH TIME ZONE;"))
            conn.commit()

        if "reopen_count" not in columns:
            print(" [+] Adicionando coluna 'reopen_count' à tabela tickets...")
            conn.execute(text("ALTER TABLE tickets ADD COLUMN reopen_count INTEGER NOT NULL DEFAULT 0;"))
            conn.commit()

        sys_cols = [col["name"] for col in inspector.get_columns("system_settings")]
        if "email_header_title" not in sys_cols:
            print(" [+] Adicionando coluna 'email_header_title' à tabela system_settings...")
            conn.execute(text("ALTER TABLE system_settings ADD COLUMN email_header_title VARCHAR(255) DEFAULT 'TIHFSA — Hotel Fasano Salvador' NOT NULL;"))
            conn.commit()

        if "email_header_subtitle" not in sys_cols:
            print(" [+] Adicionando coluna 'email_header_subtitle' à tabela system_settings...")
            conn.execute(text("ALTER TABLE system_settings ADD COLUMN email_header_subtitle VARCHAR(255) DEFAULT 'Central de Serviços & Suporte de TI' NOT NULL;"))
            conn.commit()

        if "email_body_title" not in sys_cols:
            print(" [+] Adicionando coluna 'email_body_title' à tabela system_settings...")
            conn.execute(text("ALTER TABLE system_settings ADD COLUMN email_body_title VARCHAR(255) DEFAULT 'Notificação de Atendimento' NOT NULL;"))
            conn.commit()

    print("[3/3] Garantindo registro padrão de SystemSetting...")
    db = SessionLocal()
    try:
        setting = db.query(SystemSetting).first()
        if not setting:
            setting = SystemSetting(
                support_notification_email="ti-hfsa@fasano.com.br",
                ticket_warranty_days=7,
                csat_enabled=True,
                notify_requester_on_create=True,
                notify_requester_on_assign=True,
                notify_requester_on_solve=True,
                notify_technician_on_assign=True,
            )
            db.add(setting)
            db.commit()
            print(" [+] Registro inicial de SystemSetting criado com suporte a 7 dias de garantia.")
        else:
            print(f" [+] Configurações já existentes (E-mail: {setting.support_notification_email}, Garantia: {setting.ticket_warranty_days} dias).")
    finally:
        db.close()

    print("\n[SUCESSO] Banco de dados atualizado com suporte a CSAT e Garantia de Chamados!")


if __name__ == "__main__":
    migrate()
