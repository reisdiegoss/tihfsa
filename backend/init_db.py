"""
Script de Inicialização e Migração Autônoma do Banco de Dados — TIHFSA.

Funções:
1. Lê o arquivo .env na raiz do projeto.
2. Verifica se o banco de dados especificado no DATABASE_URL existe no PostgreSQL.
3. Se não existir, cria o banco automaticamente com codificação UTF-8.
4. Executa Base.metadata.create_all para criar todas as tabelas.
5. Aplica todas as migrações incrementais de colunas e tabelas de forma segura e idempotente.
6. Cadastra os tipos de equipamento padrão (_seed_default_asset_types).
7. Cria o departamento 'TI' e o usuário Administrador Root caso o banco esteja vazio.

Uso:
    python backend/init_db.py
"""
import os
import sys
from pathlib import Path
from urllib.parse import urlparse, unquote

# Adicionar a pasta backend ao sys.path
BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

# Importar configurações e modelos da aplicação
from app.config import settings
import app.models  # noqa: F401
from app.database import Base, SessionLocal, engine
from app.models import User, Department, AssetTypeModel
from app.models.user import UserRole
from app.auth.jwt_handler import hash_password


def ensure_database_exists():
    """
    Verifica se o banco de dados alvo existe no servidor PostgreSQL.
    Se não existir, conecta na base padrão 'postgres' e executa CREATE DATABASE.
    """
    raw_url = settings.database_url
    if not (raw_url.startswith("postgresql://") or raw_url.startswith("postgresql+psycopg://")):
        print(f"[INIT_DB] Conexão não-PostgreSQL detectada ({raw_url.split('://')[0]}). Pulando checagem de criação de banco.")
        return

    # Parsear a URL
    parsed = urlparse(raw_url.replace("postgresql+psycopg://", "postgresql://", 1))
    target_dbname = parsed.path.lstrip("/")
    if not target_dbname:
        print("[INIT_DB] Aviso: Nome do banco de dados não identificado na URL.")
        return

    user = unquote(parsed.username or "postgres")
    password = unquote(parsed.password or "")
    host = parsed.hostname or "localhost"
    port = parsed.port or 5432

    # Conectar ao banco administrativo padrão 'postgres'
    admin_url = f"postgresql+psycopg://{user}:{password}@{host}:{port}/postgres"
    
    try:
        # isolation_level="AUTOCOMMIT" é obrigatório no PostgreSQL para comandos CREATE DATABASE
        admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
        with admin_engine.connect() as conn:
            result = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :dbname"),
                {"dbname": target_dbname}
            ).fetchone()

            if not result:
                print(f"[INIT_DB] O banco de dados '{target_dbname}' não existe no servidor PostgreSQL.")
                print(f"[INIT_DB] Criando banco de dados '{target_dbname}' com codificação UTF8...")
                # No Postgres, nomes de database devem ser identificadores protegidos
                safe_dbname = target_dbname.replace('"', '""')
                conn.execute(text(f'CREATE DATABASE "{safe_dbname}" ENCODING \'UTF8\';'))
                print(f"[INIT_DB] Banco de dados '{target_dbname}' criado com sucesso!")
            else:
                print(f"[INIT_DB] Banco de dados '{target_dbname}' já existe.")
        admin_engine.dispose()
    except Exception as e:
        print(f"[INIT_DB] Aviso ao verificar/criar banco no PostgreSQL (pode já existir ou requerer permissões): {e}")


def apply_migrations():
    """
    Executa migrações incrementais de tabelas e colunas para garantir total compatibilidade
    com versões anteriores do banco de dados sem quebrar dados existentes.
    """
    print("[INIT_DB] Aplicando migrações estruturais incrementais...")
    migration_statements = [
        # Ativos
        ("assets.category_id", "ALTER TABLE assets ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id);"),
        ("assets.subcategory_id", "ALTER TABLE assets ADD COLUMN IF NOT EXISTS subcategory_id INTEGER REFERENCES subcategories(id);"),
        ("assets.sound_alert_offline", "ALTER TABLE assets ADD COLUMN IF NOT EXISTS sound_alert_offline BOOLEAN DEFAULT FALSE NOT NULL;"),

        # Tipos de problema
        ("problem_types.category_id", "ALTER TABLE problem_types ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id);"),

        # Chamados
        ("tickets.problem_type_id", "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS problem_type_id INTEGER REFERENCES problem_types(id);"),
        ("tickets.closure_reason", "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closure_reason TEXT;"),

        # Departamentos
        ("departments.ad_ou_dn", "ALTER TABLE departments ADD COLUMN IF NOT EXISTS ad_ou_dn VARCHAR(300);"),
        ("departments.is_active", "ALTER TABLE departments ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;"),
        ("departments.manager_id", "ALTER TABLE departments ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id);"),

        # Tabela department_managers
        ("department_managers", """
            CREATE TABLE IF NOT EXISTS department_managers (
                department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                PRIMARY KEY (department_id, user_id)
            );
        """),

        # Categorias & Zabbix
        ("categories.zabbix_group_id", "ALTER TABLE categories ADD COLUMN IF NOT EXISTS zabbix_group_id VARCHAR(50);"),
        ("categories.zabbix_group_name", "ALTER TABLE categories ADD COLUMN IF NOT EXISTS zabbix_group_name VARCHAR(150);"),
        ("categories.is_public", "ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;"),
        ("locations.is_public", "ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;"),
        ("locations.order_index", "ALTER TABLE locations ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0 NOT NULL;"),
        ("users.floor", "ALTER TABLE users ADD COLUMN IF NOT EXISTS floor VARCHAR(100);"),
        ("users.allowed_modules", "ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_modules JSON;"),

        # Vínculo N:N Localizações Físicas x Setores
        ("location_departments", """
            CREATE TABLE IF NOT EXISTS location_departments (
                location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
                department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
                PRIMARY KEY (location_id, department_id)
            );
        """),

        # Log e Auditoria de Notificações
        ("notification_logs", """
            CREATE TABLE IF NOT EXISTS notification_logs (
                id SERIAL PRIMARY KEY,
                channel VARCHAR(20) NOT NULL DEFAULT 'EMAIL',
                notification_type VARCHAR(50) DEFAULT 'GENERAL',
                recipient VARCHAR(255) NOT NULL,
                recipient_name VARCHAR(255),
                subject VARCHAR(255),
                body TEXT NOT NULL,
                ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                error_message TEXT,
                resend_count INTEGER DEFAULT 0,
                last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_notif_logs_status ON notification_logs(status);
            CREATE INDEX IF NOT EXISTS idx_notif_logs_created_at ON notification_logs(created_at);
        """),

        # Andares e Pavimentos
        ("floors", """
            CREATE TABLE IF NOT EXISTS floors (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                number INTEGER,
                description TEXT,
                is_active BOOLEAN DEFAULT TRUE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            );
        """),

        # Mapas de Rede / Topologia
        ("network_maps.pan_x", "ALTER TABLE network_maps ADD COLUMN IF NOT EXISTS pan_x INTEGER DEFAULT 0;"),
        ("network_maps.pan_y", "ALTER TABLE network_maps ADD COLUMN IF NOT EXISTS pan_y INTEGER DEFAULT 0;"),
        ("network_maps.zoom_level", "ALTER TABLE network_maps ADD COLUMN IF NOT EXISTS zoom_level JSON DEFAULT '1.0'::json;"),
        ("network_maps.in_carousel", "ALTER TABLE network_maps ADD COLUMN IF NOT EXISTS in_carousel BOOLEAN DEFAULT TRUE NOT NULL;"),
        ("network_maps.carousel_order", "ALTER TABLE network_maps ADD COLUMN IF NOT EXISTS carousel_order INTEGER DEFAULT 0 NOT NULL;"),
        ("network_maps.carousel_seconds", "ALTER TABLE network_maps ADD COLUMN IF NOT EXISTS carousel_seconds INTEGER DEFAULT 20 NOT NULL;"),

        # TIHFSA Agent Telemetry (Substituição Zabbix)
        ("agent_checkins", """
            CREATE TABLE IF NOT EXISTS agent_checkins (
                id SERIAL PRIMARY KEY,
                hostname VARCHAR(150) UNIQUE NOT NULL,
                logged_user VARCHAR(150),
                ip_address VARCHAR(45) NOT NULL,
                cpu_usage_pct INTEGER,
                ram_used_mb INTEGER,
                ram_total_mb INTEGER,
                ram_usage_pct NUMERIC(5,2),
                disk_metrics JSONB,
                uptime_hours NUMERIC(8,1),
                os_name VARCHAR(150),
                status VARCHAR(20) DEFAULT 'online' NOT NULL,
                last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS idx_agent_checkins_hostname ON agent_checkins(hostname);
            CREATE INDEX IF NOT EXISTS idx_agent_checkins_ip ON agent_checkins(ip_address);
        """),

        # Histórico de Métricas de Agente (CPU, RAM, Disco para Relatórios e Gráficos)
        ("agent_metrics_history", """
            CREATE TABLE IF NOT EXISTS agent_metrics_history (
                id SERIAL PRIMARY KEY,
                hostname VARCHAR(150) NOT NULL,
                cpu_usage_pct INTEGER,
                ram_used_mb INTEGER,
                ram_total_mb INTEGER,
                ram_usage_pct NUMERIC(5,2),
                disk_metrics JSONB,
                uptime_hours NUMERIC(8,1),
                status VARCHAR(20) DEFAULT 'online' NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_agent_metrics_history_hostname ON agent_metrics_history(hostname);
            CREATE INDEX IF NOT EXISTS idx_agent_metrics_history_created_at ON agent_metrics_history(created_at);
        """),

        # Módulo de Contratos e Fornecedores
        ("suppliers", """
            CREATE TABLE IF NOT EXISTS suppliers (
                id SERIAL PRIMARY KEY,
                corporate_name VARCHAR(200) NOT NULL,
                trade_name VARCHAR(150) NOT NULL,
                cnpj VARCHAR(25),
                category VARCHAR(80) DEFAULT 'Geral',
                support_portal VARCHAR(300),
                address VARCHAR(300),
                notes TEXT,
                is_active BOOLEAN DEFAULT TRUE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_suppliers_trade_name ON suppliers(trade_name);
            CREATE INDEX IF NOT EXISTS idx_suppliers_category ON suppliers(category);
        """),

        ("supplier_contacts", """
            CREATE TABLE IF NOT EXISTS supplier_contacts (
                id SERIAL PRIMARY KEY,
                supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
                name VARCHAR(120) NOT NULL,
                role_title VARCHAR(100),
                contact_type VARCHAR(50) DEFAULT 'Comercial',
                email VARCHAR(150),
                phone VARCHAR(50),
                mobile_whatsapp VARCHAR(50),
                is_primary BOOLEAN DEFAULT FALSE NOT NULL,
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_supplier_contacts_supplier_id ON supplier_contacts(supplier_id);
        """),

        ("contracts", """
            CREATE TABLE IF NOT EXISTS contracts (
                id SERIAL PRIMARY KEY,
                contract_number VARCHAR(80),
                title VARCHAR(200) NOT NULL,
                supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
                manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
                start_date DATE NOT NULL DEFAULT CURRENT_DATE,
                end_date DATE NOT NULL,
                renewal_type VARCHAR(50) NOT NULL DEFAULT 'Automática',
                notice_period_days INTEGER NOT NULL DEFAULT 30,
                monthly_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
                total_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
                payment_terms VARCHAR(100) DEFAULT 'Boleto Bancário',
                status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
                notification_emails TEXT,
                attachment_path VARCHAR(400),
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts(end_date);
            CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
            CREATE INDEX IF NOT EXISTS idx_contracts_supplier_id ON contracts(supplier_id);
        """),

        ("contract_services", """
            CREATE TABLE IF NOT EXISTS contract_services (
                id SERIAL PRIMARY KEY,
                contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
                name VARCHAR(180) NOT NULL,
                service_type VARCHAR(80) DEFAULT 'Serviço Recorrente',
                description TEXT,
                quantity INTEGER NOT NULL DEFAULT 1,
                unit VARCHAR(40) NOT NULL DEFAULT 'un',
                unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_contract_services_contract_id ON contract_services(contract_id);
        """),

        ("contract_invoices", """
            CREATE TABLE IF NOT EXISTS contract_invoices (
                id SERIAL PRIMARY KEY,
                contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
                invoice_number VARCHAR(80),
                competence VARCHAR(30),
                due_date DATE NOT NULL,
                amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
                paid_at TIMESTAMP WITH TIME ZONE,
                payment_code VARCHAR(200),
                status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
                file_attachment VARCHAR(400),
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_contract_invoices_due_date ON contract_invoices(due_date);
            CREATE INDEX IF NOT EXISTS idx_contract_invoices_status ON contract_invoices(status);
            CREATE INDEX IF NOT EXISTS idx_contract_invoices_contract_id ON contract_invoices(contract_id);
        """),
    ]

    with engine.connect() as conn:
        for name, sql in migration_statements:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception as e:
                # Se der erro por sintaxe específica (ex: SQLite sem IF NOT EXISTS ou coluna já existente), apenas loga
                # print(f"       [Migração {name}]: {e}")
                pass
    print("[INIT_DB] Migrações estruturais concluídas.")


def seed_asset_types(db: Session):
    """Garante o cadastro dos tipos de equipamentos padrão do Fasano."""
    try:
        from app.main import _seed_default_asset_types
        _seed_default_asset_types()
        print("[INIT_DB] Tipos de equipamentos padrão verificados/inseridos.")
    except Exception as e:
        print(f"[INIT_DB] Aviso ao sincronizar tipos de ativos: {e}")


def seed_root_admin(db: Session):
    """Cria o departamento de TI e o usuário Admin root se a tabela de usuários estiver vazia."""
    try:
        user_count = db.query(User).count()
        if user_count > 0:
            return

        print("[INIT_DB] Base limpa detectada. Criando departamento TI e Administrador Root...")
        
        # Departamento TI
        dept_ti = db.query(Department).filter_by(name="TI").first()
        if not dept_ti:
            dept_ti = Department(name="TI")
            db.add(dept_ti)
            db.flush()

        # Usuário Admin
        admin_user = User(
            ad_username=settings.admin_username,
            display_name="Administrador do Sistema",
            email=settings.admin_email,
            password_hash=hash_password(settings.admin_password),
            role=UserRole.ADMIN,
            is_room=False,
            department_id=dept_ti.id,
        )
        db.add(admin_user)
        db.commit()

        print(f"[INIT_DB] Usuário root inicial criado com sucesso!")
        print(f"          Usuário: {settings.admin_username}")
        print(f"          E-mail:  {settings.admin_email}")
        print(f"          Perfil:  ADMIN")
    except Exception as e:
        db.rollback()
        print(f"[INIT_DB] Erro ao criar usuário root inicial: {e}")


def seed_floors_and_locations(db: Session):
    """Cadastra os andares e as localizações físicas reais do Hotel Fasano Salvador e garante que estejam ativos."""
    try:
        from app.models.floor import Floor
        from app.models.location import Location

        # 1. Andares padrão do hotel
        default_floors = [
            {"name": "Subsolo", "number": -1, "description": "Garagem, Manutenção, Estoques e Rouparia"},
            {"name": "Térreo", "number": 0, "description": "Lobby, Recepção, Restaurante Gero e Business Center"},
            {"name": "1º Andar", "number": 1, "description": "Apartamentos 101 a 110, Academia & Spa, Racks TI"},
            {"name": "2º Andar", "number": 2, "description": "Apartamentos 201 a 210"},
            {"name": "3º Andar", "number": 3, "description": "Apartamentos 301 a 310"},
            {"name": "4º Andar", "number": 4, "description": "Andar Administrativo e Backoffice"},
            {"name": "5º Andar", "number": 5, "description": "Andar de Serviços e Suítes Especiais"},
            {"name": "6º Andar", "number": 6, "description": "Suítes Presidenciais e Diretoria"},
            {"name": "7º Andar / Rooftop", "number": 7, "description": "Bar da Piscina, Rooftop e Terraço Panorâmico"},
        ]

        for f_data in default_floors:
            existing = db.query(Floor).filter(Floor.name == f_data["name"]).first()
            if not existing:
                db.add(Floor(
                    name=f_data["name"],
                    number=f_data["number"],
                    description=f_data["description"],
                    is_active=True,
                ))
            else:
                existing.is_active = True
                existing.number = f_data["number"]
        db.commit()

        # 2. Localizações Físicas padrão do Hotel (apenas se a tabela estiver completamente vazia)
        if db.query(Location).count() == 0:
            default_locations = [
                {"name": "Recepção / Lobby", "building": "Prédio Principal", "floor": "Térreo", "is_public": True, "description": "Balcão da recepção, concierges e hall principal", "order_index": 1},
                {"name": "Restaurante Fasano / Gero", "building": "Prédio Principal", "floor": "Térreo", "is_public": True, "description": "Salão do restaurante, bar interno e caixas", "order_index": 2},
                {"name": "Bar da Piscina / Rooftop", "building": "Prédio Principal", "floor": "7º Andar / Rooftop", "is_public": True, "description": "Área da piscina, bar externo e terraço", "order_index": 3},
                {"name": "Academia & Spa", "building": "Prédio Principal", "floor": "1º Andar", "is_public": True, "description": "Salas de musculação, esteiras, saunas e spa", "order_index": 4},
                {"name": "Salão de Eventos / Business Center", "building": "Prédio Principal", "floor": "Térreo", "is_public": True, "description": "Salas de reunião e eventos corporativos", "order_index": 5},
                {"name": "Racks TI - CPD", "building": "Prédio Principal", "floor": "1º Andar", "is_public": False, "description": "Sala técnica de servidores, switches e infraestrutura de TI", "order_index": 6},
                {"name": "Cozinha Central", "building": "Prédio Principal", "floor": "Subsolo", "is_public": False, "description": "Área de produção culinária e confeitaria", "order_index": 7},
                {"name": "Governança & Rouparia", "building": "Prédio Principal", "floor": "Subsolo", "is_public": False, "description": "Central de camareiras, estoque de enxovais e uniformes", "order_index": 8},
                {"name": "Sala de Manutenção / Oficina", "building": "Prédio Principal", "floor": "Subsolo", "is_public": False, "description": "Oficina técnica predial e marcenaria", "order_index": 9},
                {"name": "Garagem / Valet", "building": "Prédio Principal", "floor": "Subsolo", "is_public": False, "description": "Área de manobristas e estacionamento", "order_index": 10},
            ]

            for loc_data in default_locations:
                db.add(Location(
                    name=loc_data["name"],
                    building=loc_data["building"],
                    floor=loc_data["floor"],
                    is_public=loc_data["is_public"],
                    is_active=True,
                    order_index=loc_data.get("order_index", 0),
                    description=loc_data["description"],
                ))
            db.commit()
            print("[INIT_DB] Localizações Físicas padrão criadas.")
        else:
            print("[INIT_DB] Localizações Físicas já cadastradas pelo usuário preservadas.")
    except Exception as e:
        db.rollback()
        print(f"[INIT_DB] Aviso ao sincronizar andares/localizações: {e}")


def main():
    print("=" * 60)
    print("  TIHFSA — Inicialização e Migração do Banco de Dados")
    print("=" * 60)
    
    # 1. Garantir que o banco de dados existe no servidor
    ensure_database_exists()

    # 2. Inspecionar tabelas existentes antes do create_all
    from sqlalchemy import inspect
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    if existing_tables:
        print(f"[INIT_DB] Banco existente com {len(existing_tables)} tabela(s) detectada(s).")
        print("[INIT_DB] Verificando se há novas tabelas do modelo para adicionar...")
    else:
        print("[INIT_DB] Banco novo detectado. Criando tabelas iniciais...")

    # Base.metadata.create_all NUNCA sobrescreve nem apaga dados de tabelas existentes
    Base.metadata.create_all(bind=engine)

    updated_tables = inspect(engine).get_table_names()
    newly_created = set(updated_tables) - set(existing_tables)

    if newly_created:
        print(f"[INIT_DB] {len(newly_created)} nova(s) tabela(s) criada(s): {', '.join(sorted(newly_created))}")
    else:
        print(f"[INIT_DB] Todas as tabelas já existem no banco. Registros e dados 100% preservados.")

    # 3. Aplicar migrações incrementais de colunas
    apply_migrations()

    # 4. Inserir dados básicos essenciais apenas se necessário
    db = SessionLocal()
    try:
        seed_asset_types(db)
        seed_floors_and_locations(db)
        seed_root_admin(db)
    finally:
        db.close()

    print("=" * 60)
    print("  [OK] Banco de dados TIHFSA pronto para operação!")
    print("=" * 60)


if __name__ == "__main__":
    main()
