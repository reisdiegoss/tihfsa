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
        ("users.module_permissions", "ALTER TABLE users ADD COLUMN IF NOT EXISTS module_permissions JSON;"),
        ("qrcodes.url", "ALTER TABLE qrcodes ADD COLUMN IF NOT EXISTS url VARCHAR(500);"),

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
        ("agent_checkins.disk_active_pct", "ALTER TABLE agent_checkins ADD COLUMN IF NOT EXISTS disk_active_pct INTEGER;"),
        ("agent_checkins.top_processes", "ALTER TABLE agent_checkins ADD COLUMN IF NOT EXISTS top_processes JSONB;"),
        ("agent_checkins.anydesk_id", "ALTER TABLE agent_checkins ADD COLUMN IF NOT EXISTS anydesk_id VARCHAR(50);"),
        ("agent_checkins.rustdesk_id", "ALTER TABLE agent_checkins ADD COLUMN IF NOT EXISTS rustdesk_id VARCHAR(50);"),

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
                disk_usage_pct NUMERIC(5,2),
                disk_active_pct INTEGER,
                disk_free_gb NUMERIC(8,2),
                uptime_hours NUMERIC(8,1),
                status VARCHAR(20) DEFAULT 'online' NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_agent_metrics_history_hostname ON agent_metrics_history(hostname);
            CREATE INDEX IF NOT EXISTS idx_agent_metrics_history_created_at ON agent_metrics_history(created_at);
        """),
        ("agent_metrics_history.disk_active_pct", "ALTER TABLE agent_metrics_history ADD COLUMN IF NOT EXISTS disk_active_pct INTEGER;"),

        # Histórico de Logons e Usuários de Agentes
        ("agent_logon_history", """
            CREATE TABLE IF NOT EXISTS agent_logon_history (
                id SERIAL PRIMARY KEY,
                hostname VARCHAR(150) NOT NULL,
                username VARCHAR(150) NOT NULL,
                domain VARCHAR(100),
                display_name VARCHAR(200),
                session_state VARCHAR(50) DEFAULT 'active' NOT NULL,
                is_current BOOLEAN DEFAULT FALSE NOT NULL,
                logon_time TIMESTAMP WITH TIME ZONE,
                last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                logon_type VARCHAR(50),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_agent_logon_history_hostname ON agent_logon_history(hostname);
            CREATE INDEX IF NOT EXISTS idx_agent_logon_history_username ON agent_logon_history(username);
            CREATE INDEX IF NOT EXISTS idx_agent_logon_history_last_seen ON agent_logon_history(last_seen_at);
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

        # Eventos Históricos de Quedas de Rede (UniFi, Zabbix e Agentes)
        ("network_outage_events", """
            CREATE TABLE IF NOT EXISTS network_outage_events (
                id SERIAL PRIMARY KEY,
                source VARCHAR(50) NOT NULL,
                device_identifier VARCHAR(150) NOT NULL,
                device_name VARCHAR(150) NOT NULL,
                ip_address VARCHAR(45),
                mac_address VARCHAR(50),
                device_type VARCHAR(100),
                asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
                started_at TIMESTAMP WITH TIME ZONE NOT NULL,
                ended_at TIMESTAMP WITH TIME ZONE,
                duration_seconds INTEGER,
                status VARCHAR(20) DEFAULT 'ongoing' NOT NULL,
                trigger_reason VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_outage_source ON network_outage_events(source);
            CREATE INDEX IF NOT EXISTS idx_outage_dev_id ON network_outage_events(device_identifier);
            CREATE INDEX IF NOT EXISTS idx_outage_mac ON network_outage_events(mac_address);
            CREATE INDEX IF NOT EXISTS idx_outage_status ON network_outage_events(status);
            CREATE INDEX IF NOT EXISTS idx_outage_started_at ON network_outage_events(started_at);
        """),

        # Módulo de Termos de Retirada e Responsabilidade de Equipamentos (Assinatura + Reconhecimento Facial)
        ("equipment_terms", """
            CREATE TABLE IF NOT EXISTS equipment_terms (
                id SERIAL PRIMARY KEY,
                term_number VARCHAR(50) UNIQUE NOT NULL,
                status VARCHAR(30) DEFAULT 'pending_signature' NOT NULL,
                term_type VARCHAR(50) DEFAULT 'retirada' NOT NULL,
                beneficiary_type VARCHAR(20) DEFAULT 'ad_user' NOT NULL,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                beneficiary_name VARCHAR(200) NOT NULL,
                beneficiary_document VARCHAR(50),
                department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
                department_name VARCHAR(150),
                beneficiary_email VARCHAR(150),
                beneficiary_phone VARCHAR(50),
                has_ad_account BOOLEAN DEFAULT TRUE NOT NULL,
                technician_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                technician_name VARCHAR(200) NOT NULL,
                signed_at TIMESTAMP WITH TIME ZONE,
                signature_url VARCHAR(350),
                facial_photo_url VARCHAR(350),
                facial_verified BOOLEAN DEFAULT FALSE NOT NULL,
                facial_confidence DOUBLE PRECISION,
                signer_ip VARCHAR(50),
                signer_device VARCHAR(255),
                returned_at TIMESTAMP WITH TIME ZONE,
                return_technician_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                return_technician_name VARCHAR(200),
                return_condition VARCHAR(100),
                return_notes TEXT,
                expected_return_date TIMESTAMP WITH TIME ZONE,
                legal_text TEXT NOT NULL,
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_equipment_terms_number ON equipment_terms(term_number);
            CREATE INDEX IF NOT EXISTS idx_equipment_terms_status ON equipment_terms(status);
            CREATE INDEX IF NOT EXISTS idx_equipment_terms_beneficiary ON equipment_terms(beneficiary_name);
            CREATE INDEX IF NOT EXISTS idx_equipment_terms_user_id ON equipment_terms(user_id);
            CREATE INDEX IF NOT EXISTS idx_equipment_terms_dept_id ON equipment_terms(department_id);
        """),

        ("equipment_term_items", """
            CREATE TABLE IF NOT EXISTS equipment_term_items (
                id SERIAL PRIMARY KEY,
                term_id INTEGER NOT NULL REFERENCES equipment_terms(id) ON DELETE CASCADE,
                asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
                item_name VARCHAR(200) NOT NULL,
                category VARCHAR(100),
                asset_tag VARCHAR(50),
                serial_number VARCHAR(100),
                quantity INTEGER DEFAULT 1 NOT NULL,
                condition VARCHAR(100) DEFAULT 'Em perfeito estado de funcionamento' NOT NULL,
                accessories VARCHAR(255),
                is_returned BOOLEAN DEFAULT FALSE NOT NULL,
                notes TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_equipment_term_items_term_id ON equipment_term_items(term_id);
            CREATE INDEX IF NOT EXISTS idx_equipment_term_items_asset_id ON equipment_term_items(asset_id);
        """),

        # Modelos de Documentos e Termos de Equipamentos (Builder com Formatação Word)
        ("equipment_term_templates", """
            CREATE TABLE IF NOT EXISTS equipment_term_templates (
                id SERIAL PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                category VARCHAR(100) DEFAULT 'Geral' NOT NULL,
                description VARCHAR(300),
                content_html TEXT NOT NULL,
                default_items TEXT,
                is_active BOOLEAN DEFAULT TRUE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_term_templates_title ON equipment_term_templates(title);
            CREATE INDEX IF NOT EXISTS idx_term_templates_category ON equipment_term_templates(category);
        """),
        ("equipment_terms.template_id", "ALTER TABLE equipment_terms ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES equipment_term_templates(id) ON DELETE SET NULL;"),
        # Governança ITIL 4 & COBIT DSS02 (Níveis de Atendimento N1/N2/N3, Escalação e Transferência)
        ("users.allowed_modules", "ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_modules JSON;"),
        ("users.module_permissions", "ALTER TABLE users ADD COLUMN IF NOT EXISTS module_permissions JSON;"),
        ("users.support_level", "ALTER TABLE users ADD COLUMN IF NOT EXISTS support_level VARCHAR(10) DEFAULT 'N1';"),
        ("tickets.support_level", "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS support_level VARCHAR(10) DEFAULT 'N1' NOT NULL;"),
        ("tickets.first_response_at", "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMP WITH TIME ZONE;"),
        ("tickets.escalated_at", "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP WITH TIME ZONE;"),
        ("tickets.escalated_by_id", "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS escalated_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL;"),
        ("tickets.escalation_reason", "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS escalation_reason TEXT;"),
        ("tickets.escalation_type", "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS escalation_type VARCHAR(30);"),
        ("tickets.previous_level", "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS previous_level VARCHAR(10);"),
        ("tickets.transferred_at", "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMP WITH TIME ZONE;"),
        ("tickets.transferred_by_id", "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS transferred_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL;"),
        ("tickets.transfer_reason", "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS transfer_reason TEXT;"),
        ("tickets.previous_technician_id", "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS previous_technician_id INTEGER REFERENCES users(id) ON DELETE SET NULL;"),
        ("tickets.project_id", "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;"),
        ("tickets.idx_project_id", "CREATE INDEX IF NOT EXISTS idx_tickets_project_id ON tickets(project_id);"),
        ("tickets.idx_support_level", "CREATE INDEX IF NOT EXISTS idx_tickets_support_level ON tickets(support_level);"),
        ("ticket_interactions.interaction_type", "ALTER TABLE ticket_interactions ADD COLUMN IF NOT EXISTS interaction_type VARCHAR(40) DEFAULT 'comment' NOT NULL;"),
        ("project_tasks.ticket_id", "ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL;"),
        ("project_tasks.idx_ticket_id", "CREATE INDEX IF NOT EXISTS idx_project_tasks_ticket_id ON project_tasks(ticket_id);"),
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


def seed_default_term_templates(db: Session):
    """
    Cadastra os modelos padrão de documentos e termos de equipamentos com layout estilo Word (Ribbon)
    e tags dinâmicas.
    A validação digital (assinatura touch + biometria facial) pertence 100% ao beneficiário recebedor.
    O técnico é o responsável por emitir e testemunha da entrega.
    """
    try:
        import json
        from app.models.term import EquipmentTermTemplate

        templates = [
            {
                "title": "Termo Geral de Retirada de Equipamentos e Acessórios",
                "category": "Geral",
                "description": "Modelo corporativo padrão para periféricos, fones de ouvido, cabos, adaptadores e equipamentos avulsos.",
                "default_items": json.dumps([
                    {"item_name": "Fone de ouvido estéreo com microfone", "category": "Periférico", "quantity": 1, "condition": "Novo / Em perfeito estado", "accessories": "Cabo P3/USB"}
                ], ensure_ascii=False),
                "content_html": """<div style="font-family: Arial, sans-serif; line-height: 1.45; color: #0f172a;">
  <div style="text-align: center; border-bottom: 2px solid #b89758; padding-bottom: 8px; margin-bottom: 12px;">
    <h2 style="margin: 0; color: #b89758; text-transform: uppercase; letter-spacing: 1.5px; font-size: 15pt;">HOTEL FASANO SALVADOR</h2>
    <h3 style="margin: 3px 0 0 0; font-weight: 700; font-size: 11pt; color: #1e293b;">TERMO DE RESPONSABILIDADE E RETIRADA DE EQUIPAMENTOS</h3>
    <p style="margin: 3px 0 0 0; font-size: 8.5pt; color: #64748b;">Número: <strong>{{numero_termo}}</strong> &bull; Emissão: <strong>{{data_emissao}}</strong></p>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9pt; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; page-break-inside: avoid !important; break-inside: avoid !important;">
    <tr>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; background-color: #f8fafc; width: 22%; font-weight: 600; color: #334155;">Colaborador(a):</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; width: 38%; font-weight: 600; color: #0f172a;">{{nome_colaborador}}</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; background-color: #f8fafc; width: 18%; font-weight: 600; color: #334155;">Documento / CPF:</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; width: 22%; color: #0f172a;">{{documento_cpf_rg}}</td>
    </tr>
    <tr>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; background-color: #f8fafc; font-weight: 600; color: #334155;">Setor / Departamento:</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; color: #0f172a;">{{setor_departamento}}</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; background-color: #f8fafc; font-weight: 600; color: #334155;">Técnico Emissor:</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; color: #0f172a;">{{tecnico_responsavel}}</td>
    </tr>
  </table>

  <h4 style="margin: 10px 0 4px 0; color: #1e293b; text-transform: uppercase; font-size: 9.5pt; font-weight: bold; border-left: 3.5px solid #b89758; padding-left: 8px;">1. Discriminação dos Equipamentos e Bens Retirados</h4>
  <p style="font-size: 8.5pt; margin-bottom: 6px; color: #475569;">O colaborador acima qualificado declara ter recebido da TI do <strong>{{hotel_fasano}}</strong>, em perfeito estado de conservação, o(s) seguinte(s) item(ns):</p>
  
  {{tabela_equipamentos}}

  <h4 style="margin: 12px 0 4px 0; color: #1e293b; text-transform: uppercase; font-size: 9.5pt; font-weight: bold; border-left: 3.5px solid #b89758; padding-left: 8px;">2. Cláusulas e Obrigações de Uso</h4>
  <ol style="font-size: 8.5pt; line-height: 1.45; padding-left: 18px; text-align: justify; color: #374151; margin-top: 4px; margin-bottom: 8px;">
    <li style="margin-bottom: 3px;">O(s) equipamento(s) destina(m)-se exclusivamente às atividades funcionais no Hotel Fasano Salvador;</li>
    <li style="margin-bottom: 3px;">O beneficiário assume integral responsabilidade pela guarda, conservação, asseio e segurança dos bens recebidos;</li>
    <li style="margin-bottom: 3px;">Qualquer avaria, extravio ou furto deve ser imediatamente comunicado à gerência de TI mediante boletim de ocorrência quando couber;</li>
    <li style="margin-bottom: 3px;">É expressamente vedado transferir, ceder, emprestar ou sublocar os equipamentos a outros colaboradores ou terceiros sem autorização prévia da TI;</li>
    <li style="margin-bottom: 3px;">Em caso de transferência, desligamento ou revogação deste termo, os equipamentos deverão ser imediatamente devolvidos ao setor de TI nas mesmas condições de entrega.</li>
  </ol>

  <!-- BLOCO DE DUPLA VALIDAÇÃO DO BENEFICIÁRIO (ASSINATURA TOUCH + BIOMETRIA FACIAL) -->
  <table style="width: 100%; border-collapse: collapse; margin-top: 14px; border: 1px solid #cbd5e1; background-color: #f8fafc; border-radius: 8px; page-break-inside: avoid !important; break-inside: avoid !important;">
    <tr>
      <td colspan="2" style="padding: 6px 12px; font-size: 8.5pt; font-weight: bold; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">
        Aceite do Beneficiário (Dupla Validação: Assinatura Gráfica &amp; Biometria Facial)
      </td>
    </tr>
    <tr>
      <td style="width: 50%; padding: 8px 14px 6px 14px; text-align: center; vertical-align: bottom; border-right: 1px solid #e2e8f0;">
        <div style="min-height: 52px; display: flex; align-items: center; justify-content: center; margin-bottom: 3px;">
          {{assinatura_beneficiario}}
        </div>
        <div style="border-top: 1.5px solid #374151; padding-top: 4px;">
          <p style="margin: 0; font-size: 9pt; font-weight: bold; color: #0f172a;">{{nome_colaborador}}</p>
          <p style="margin: 1px 0 0 0; font-size: 8pt; color: #475569;">Assinatura Digital Manuscrita (Touch)</p>
          <p style="margin: 1px 0 0 0; font-size: 7.5pt; color: #64748b;">Doc: {{documento_cpf_rg}} | {{setor_departamento}}</p>
        </div>
      </td>
      <td style="width: 50%; padding: 8px 14px 6px 14px; text-align: center; vertical-align: bottom;">
        <div style="min-height: 52px; display: flex; align-items: center; justify-content: center; margin-bottom: 3px;">
          {{foto_biometria}}
        </div>
        <div style="border-top: 1.5px solid #374151; padding-top: 4px;">
          <p style="margin: 0; font-size: 9pt; font-weight: bold; color: #0f172a;">Validação Facial em Tempo Real</p>
          <p style="margin: 1px 0 0 0; font-size: 8pt; color: #475569;">Evidência Biométrica do Recebedor</p>
          <p style="margin: 1px 0 0 0; font-size: 7.5pt; color: #64748b;">Autenticação Facial (Face-API)</p>
        </div>
      </td>
    </tr>
  </table>

  <!-- RESPONSÁVEL PELA ENTREGA / TESTEMUNHA TI -->
  <table style="width: 100%; border-collapse: collapse; margin-top: 12px; page-break-inside: avoid !important; break-inside: avoid !important;">
    <tr>
      <td style="text-align: center; vertical-align: top; padding: 0;">
        <div style="display: inline-block; width: 55%; border-top: 1px solid #9ca3af; padding-top: 4px;">
          <p style="margin: 0; font-size: 9pt; font-weight: bold; color: #0f172a;">{{tecnico_responsavel}}</p>
          <p style="margin: 1px 0 0 0; font-size: 8pt; color: #475569;">Técnico Emissor / Testemunha da Entrega</p>
          <p style="margin: 1px 0 0 0; font-size: 7.5pt; color: #64748b;">Tecnologia da Informação — Hotel Fasano Salvador</p>
        </div>
      </td>
    </tr>
  </table>
</div>"""
            },
            {
                "title": "Termo de Entrega de Rádio Comunicador (HT / Walkie-Talkie)",
                "category": "Comunicação",
                "description": "Modelo para entrega de rádios comunicadores HT operacionais, bases de recarga e fones PTT.",
                "default_items": json.dumps([
                    {"item_name": "Rádio Comunicador HT Profissional (Motorola / Hytera)", "category": "Comunicação", "quantity": 1, "condition": "Em perfeito estado", "accessories": "Antena original, bateria acoplada e clipe de cinto"},
                    {"item_name": "Base Carregadora de Mesa Bivolt", "category": "Comunicação", "quantity": 1, "condition": "Em perfeito estado", "accessories": "Fonte de alimentação original"},
                    {"item_name": "Fone de Ouvido PTT Acústico com microfone de lapela", "category": "Comunicação", "quantity": 1, "condition": "Novo / Higienizado", "accessories": "Tubo acústico transparente"}
                ], ensure_ascii=False),
                "content_html": """<div style="font-family: Arial, sans-serif; line-height: 1.45; color: #0f172a;">
  <div style="text-align: center; border-bottom: 2px solid #b89758; padding-bottom: 8px; margin-bottom: 12px;">
    <h2 style="margin: 0; color: #b89758; text-transform: uppercase; letter-spacing: 1.5px; font-size: 15pt;">HOTEL FASANO SALVADOR</h2>
    <h3 style="margin: 3px 0 0 0; font-weight: 700; font-size: 11pt; color: #1e293b;">TERMO DE CAUTELA — RÁDIO COMUNICADOR HT</h3>
    <p style="margin: 3px 0 0 0; font-size: 8.5pt; color: #64748b;">Número: <strong>{{numero_termo}}</strong> &bull; Emissão: <strong>{{data_emissao}}</strong></p>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9pt; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; page-break-inside: avoid !important; break-inside: avoid !important;">
    <tr>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; background-color: #f8fafc; width: 22%; font-weight: 600; color: #334155;">Colaborador(a):</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; width: 38%; font-weight: 600; color: #0f172a;">{{nome_colaborador}}</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; background-color: #f8fafc; width: 18%; font-weight: 600; color: #334155;">Documento / CPF:</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; width: 22%; color: #0f172a;">{{documento_cpf_rg}}</td>
    </tr>
    <tr>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; background-color: #f8fafc; font-weight: 600; color: #334155;">Setor / Operação:</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; color: #0f172a;">{{setor_departamento}}</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; background-color: #f8fafc; font-weight: 600; color: #334155;">Técnico Emissor:</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; color: #0f172a;">{{tecnico_responsavel}}</td>
    </tr>
  </table>

  <h4 style="margin: 10px 0 4px 0; color: #1e293b; text-transform: uppercase; font-size: 9.5pt; font-weight: bold; border-left: 3.5px solid #b89758; padding-left: 8px;">1. Equipamentos de Radiocomunicação Entregues</h4>
  <p style="font-size: 8.5pt; margin-bottom: 6px; color: #475569;">O colaborador recebe os aparelhos calibrados nos canais operacionais do hotel:</p>
  
  {{tabela_equipamentos}}

  <h4 style="margin: 12px 0 4px 0; color: #1e293b; text-transform: uppercase; font-size: 9.5pt; font-weight: bold; border-left: 3.5px solid #b89758; padding-left: 8px;">2. Regras de Utilização do Rádio</h4>
  <ul style="font-size: 8.5pt; line-height: 1.45; padding-left: 18px; text-align: justify; color: #374151; margin-top: 4px; margin-bottom: 8px;">
    <li style="margin-bottom: 3px;">O rádio deve ser mantido sempre no canal designado para o setor do colaborador durante o turno de serviço;</li>
    <li style="margin-bottom: 3px;">Utilizar linguagem estritamente profissional e de acordo com os protocolos de hospitalidade Fasano;</li>
    <li style="margin-bottom: 3px;">Proibido puxar o rádio pela antena ou expor a umidade (exceto se homologado IP67);</li>
    <li style="margin-bottom: 3px;">Ao término de cada escala de serviço, o rádio deve ser recolhido à base de carregamento correspondente.</li>
  </ul>

  <!-- BLOCO DE DUPLA VALIDAÇÃO DO BENEFICIÁRIO (ASSINATURA TOUCH + BIOMETRIA FACIAL) -->
  <table style="width: 100%; border-collapse: collapse; margin-top: 14px; border: 1px solid #cbd5e1; background-color: #f8fafc; border-radius: 8px; page-break-inside: avoid !important; break-inside: avoid !important;">
    <tr>
      <td colspan="2" style="padding: 6px 12px; font-size: 8.5pt; font-weight: bold; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">
        Aceite do Beneficiário (Dupla Validação: Assinatura Gráfica &amp; Biometria Facial)
      </td>
    </tr>
    <tr>
      <td style="width: 50%; padding: 8px 14px 6px 14px; text-align: center; vertical-align: bottom; border-right: 1px solid #e2e8f0;">
        <div style="min-height: 52px; display: flex; align-items: center; justify-content: center; margin-bottom: 3px;">
          {{assinatura_beneficiario}}
        </div>
        <div style="border-top: 1.5px solid #374151; padding-top: 4px;">
          <p style="margin: 0; font-size: 9pt; font-weight: bold; color: #0f172a;">{{nome_colaborador}}</p>
          <p style="margin: 1px 0 0 0; font-size: 8pt; color: #475569;">Assinatura Digital Manuscrita (Touch)</p>
          <p style="margin: 1px 0 0 0; font-size: 7.5pt; color: #64748b;">Doc: {{documento_cpf_rg}} | {{setor_departamento}}</p>
        </div>
      </td>
      <td style="width: 50%; padding: 8px 14px 6px 14px; text-align: center; vertical-align: bottom;">
        <div style="min-height: 52px; display: flex; align-items: center; justify-content: center; margin-bottom: 3px;">
          {{foto_biometria}}
        </div>
        <div style="border-top: 1.5px solid #374151; padding-top: 4px;">
          <p style="margin: 0; font-size: 9pt; font-weight: bold; color: #0f172a;">Validação Facial em Tempo Real</p>
          <p style="margin: 1px 0 0 0; font-size: 8pt; color: #475569;">Evidência Biométrica do Recebedor</p>
          <p style="margin: 1px 0 0 0; font-size: 7.5pt; color: #64748b;">Autenticação Facial (Face-API)</p>
        </div>
      </td>
    </tr>
  </table>

  <!-- RESPONSÁVEL PELA ENTREGA / TESTEMUNHA TI -->
  <table style="width: 100%; border-collapse: collapse; margin-top: 12px; page-break-inside: avoid !important; break-inside: avoid !important;">
    <tr>
      <td style="text-align: center; vertical-align: top; padding: 0;">
        <div style="display: inline-block; width: 55%; border-top: 1px solid #9ca3af; padding-top: 4px;">
          <p style="margin: 0; font-size: 9pt; font-weight: bold; color: #0f172a;">{{tecnico_responsavel}}</p>
          <p style="margin: 1px 0 0 0; font-size: 8pt; color: #475569;">Técnico Emissor / Testemunha da Entrega</p>
          <p style="margin: 1px 0 0 0; font-size: 7.5pt; color: #64748b;">Tecnologia da Informação — Hotel Fasano Salvador</p>
        </div>
      </td>
    </tr>
  </table>
</div>"""
            },
            {
                "title": "Termo de Responsabilidade - Smartphone / Celular Corporativo",
                "category": "Telefonia",
                "description": "Modelo para entrega de smartphone corporativo, plano de dados 4G/5G institucional e acessórios.",
                "default_items": json.dumps([
                    {"item_name": "Smartphone Corporativo Android / iOS", "category": "Telefonia", "quantity": 1, "condition": "Em perfeito estado / Sem trincas", "accessories": "Cabo USB, carregador de parede, capa protetora e película de vidro"},
                    {"item_name": "Chip Corporativo SIM Card 4G/5G", "category": "Telefonia", "quantity": 1, "condition": "Ativo com linha corporativa Fasano", "accessories": "Pacote de voz e dados corporativos"}
                ], ensure_ascii=False),
                "content_html": """<div style="font-family: Arial, sans-serif; line-height: 1.45; color: #0f172a;">
  <div style="text-align: center; border-bottom: 2px solid #b89758; padding-bottom: 8px; margin-bottom: 12px;">
    <h2 style="margin: 0; color: #b89758; text-transform: uppercase; letter-spacing: 1.5px; font-size: 15pt;">HOTEL FASANO SALVADOR</h2>
    <h3 style="margin: 3px 0 0 0; font-weight: 700; font-size: 11pt; color: #1e293b;">TERMO DE COMPROMISSO — TELEFONIA MÓVEL CORPORATIVA</h3>
    <p style="margin: 3px 0 0 0; font-size: 8.5pt; color: #64748b;">Número: <strong>{{numero_termo}}</strong> &bull; Emissão: <strong>{{data_emissao}}</strong></p>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9pt; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; page-break-inside: avoid !important; break-inside: avoid !important;">
    <tr>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; background-color: #f8fafc; width: 22%; font-weight: 600; color: #334155;">Colaborador(a):</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; width: 38%; font-weight: 600; color: #0f172a;">{{nome_colaborador}}</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; background-color: #f8fafc; width: 18%; font-weight: 600; color: #334155;">Documento / CPF:</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; width: 22%; color: #0f172a;">{{documento_cpf_rg}}</td>
    </tr>
    <tr>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; background-color: #f8fafc; font-weight: 600; color: #334155;">Departamento:</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; color: #0f172a;">{{setor_departamento}}</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; background-color: #f8fafc; font-weight: 600; color: #334155;">Técnico Emissor:</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; color: #0f172a;">{{tecnico_responsavel}}</td>
    </tr>
  </table>

  <h4 style="margin: 10px 0 4px 0; color: #1e293b; text-transform: uppercase; font-size: 9.5pt; font-weight: bold; border-left: 3.5px solid #b89758; padding-left: 8px;">1. Dispositivo Móvel e Linha Cadastrada</h4>
  {{tabela_equipamentos}}

  <h4 style="margin: 12px 0 4px 0; color: #1e293b; text-transform: uppercase; font-size: 9.5pt; font-weight: bold; border-left: 3.5px solid #b89758; padding-left: 8px;">2. Termos de Uso e Política de Segurança</h4>
  <p style="font-size: 8.5pt; line-height: 1.45; text-align: justify; color: #374151; margin-top: 4px; margin-bottom: 8px;">
    O colaborador compromete-se a manter o bloqueio de tela ativo por biometria ou PIN seguro, não instalar aplicativos não homologados e não compartilhar credenciais corporativas. O aparelho poderá ser gerenciado remotamente pelo MDM institucional em caso de perda, furto ou extravio.
  </p>

  <!-- BLOCO DE DUPLA VALIDAÇÃO DO BENEFICIÁRIO (ASSINATURA TOUCH + BIOMETRIA FACIAL) -->
  <table style="width: 100%; border-collapse: collapse; margin-top: 14px; border: 1px solid #cbd5e1; background-color: #f8fafc; border-radius: 8px; page-break-inside: avoid !important; break-inside: avoid !important;">
    <tr>
      <td colspan="2" style="padding: 6px 12px; font-size: 8.5pt; font-weight: bold; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">
        Aceite do Beneficiário (Dupla Validação: Assinatura Gráfica &amp; Biometria Facial)
      </td>
    </tr>
    <tr>
      <td style="width: 50%; padding: 8px 14px 6px 14px; text-align: center; vertical-align: bottom; border-right: 1px solid #e2e8f0;">
        <div style="min-height: 52px; display: flex; align-items: center; justify-content: center; margin-bottom: 3px;">
          {{assinatura_beneficiario}}
        </div>
        <div style="border-top: 1.5px solid #374151; padding-top: 4px;">
          <p style="margin: 0; font-size: 9pt; font-weight: bold; color: #0f172a;">{{nome_colaborador}}</p>
          <p style="margin: 1px 0 0 0; font-size: 8pt; color: #475569;">Assinatura Digital Manuscrita (Touch)</p>
          <p style="margin: 1px 0 0 0; font-size: 7.5pt; color: #64748b;">Doc: {{documento_cpf_rg}} | {{setor_departamento}}</p>
        </div>
      </td>
      <td style="width: 50%; padding: 8px 14px 6px 14px; text-align: center; vertical-align: bottom;">
        <div style="min-height: 52px; display: flex; align-items: center; justify-content: center; margin-bottom: 3px;">
          {{foto_biometria}}
        </div>
        <div style="border-top: 1.5px solid #374151; padding-top: 4px;">
          <p style="margin: 0; font-size: 9pt; font-weight: bold; color: #0f172a;">Validação Facial em Tempo Real</p>
          <p style="margin: 1px 0 0 0; font-size: 8pt; color: #475569;">Evidência Biométrica do Recebedor</p>
          <p style="margin: 1px 0 0 0; font-size: 7.5pt; color: #64748b;">Autenticação Facial (Face-API)</p>
        </div>
      </td>
    </tr>
  </table>

  <!-- RESPONSÁVEL PELA ENTREGA / TESTEMUNHA TI -->
  <table style="width: 100%; border-collapse: collapse; margin-top: 12px; page-break-inside: avoid !important; break-inside: avoid !important;">
    <tr>
      <td style="text-align: center; vertical-align: top; padding: 0;">
        <div style="display: inline-block; width: 55%; border-top: 1px solid #9ca3af; padding-top: 4px;">
          <p style="margin: 0; font-size: 9pt; font-weight: bold; color: #0f172a;">{{tecnico_responsavel}}</p>
          <p style="margin: 1px 0 0 0; font-size: 8pt; color: #475569;">Técnico Emissor / Testemunha da Entrega</p>
          <p style="margin: 1px 0 0 0; font-size: 7.5pt; color: #64748b;">Tecnologia da Informação — Hotel Fasano Salvador</p>
        </div>
      </td>
    </tr>
  </table>
</div>"""
            },
            {
                "title": "Termo de Responsabilidade - Notebook e Estação Móvel",
                "category": "Notebook",
                "description": "Modelo para entrega de computador portátil, carregador original e mochila de transporte para trabalho remoto ou híbrido.",
                "default_items": json.dumps([
                    {"item_name": "Notebook Corporativo Dell / Lenovo", "category": "Notebook", "quantity": 1, "condition": "Em perfeito estado", "accessories": "Fonte carregadora original bivolt com cabo tripé"},
                    {"item_name": "Mochila / Case acolchoada para notebook", "category": "Acessório", "quantity": 1, "condition": "Em perfeito estado", "accessories": "Alça acolchoada"},
                    {"item_name": "Mouse sem fio óptico", "category": "Periférico", "quantity": 1, "condition": "Em perfeito estado", "accessories": "Dongle USB e pilha"}
                ], ensure_ascii=False),
                "content_html": """<div style="font-family: Arial, sans-serif; line-height: 1.45; color: #0f172a;">
  <div style="text-align: center; border-bottom: 2px solid #b89758; padding-bottom: 8px; margin-bottom: 12px;">
    <h2 style="margin: 0; color: #b89758; text-transform: uppercase; letter-spacing: 1.5px; font-size: 15pt;">HOTEL FASANO SALVADOR</h2>
    <h3 style="margin: 3px 0 0 0; font-weight: 700; font-size: 11pt; color: #1e293b;">TERMO DE RESPONSABILIDADE — NOTEBOOK CORPORATIVO</h3>
    <p style="margin: 3px 0 0 0; font-size: 8.5pt; color: #64748b;">Número: <strong>{{numero_termo}}</strong> &bull; Emissão: <strong>{{data_emissao}}</strong></p>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9pt; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; page-break-inside: avoid !important; break-inside: avoid !important;">
    <tr>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; background-color: #f8fafc; width: 22%; font-weight: 600; color: #334155;">Colaborador(a):</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; width: 38%; font-weight: 600; color: #0f172a;">{{nome_colaborador}}</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; background-color: #f8fafc; width: 18%; font-weight: 600; color: #334155;">Documento / CPF:</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; width: 22%; color: #0f172a;">{{documento_cpf_rg}}</td>
    </tr>
    <tr>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; background-color: #f8fafc; font-weight: 600; color: #334155;">Setor / Departamento:</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; color: #0f172a;">{{setor_departamento}}</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; background-color: #f8fafc; font-weight: 600; color: #334155;">Técnico Emissor:</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; color: #0f172a;">{{tecnico_responsavel}}</td>
    </tr>
  </table>

  <h4 style="margin: 10px 0 4px 0; color: #1e293b; text-transform: uppercase; font-size: 9.5pt; font-weight: bold; border-left: 3.5px solid #b89758; padding-left: 8px;">1. Equipamentos e Acessórios Entregues</h4>
  {{tabela_equipamentos}}

  <h4 style="margin: 12px 0 4px 0; color: #1e293b; text-transform: uppercase; font-size: 9.5pt; font-weight: bold; border-left: 3.5px solid #b89758; padding-left: 8px;">2. Cláusulas de Proteção de Dados e Equipamento</h4>
  <p style="font-size: 8.5pt; line-height: 1.45; text-align: justify; color: #374151; margin-top: 4px; margin-bottom: 8px;">
    O usuário declara ciência de que o notebook está sujeito às políticas de segurança da informação do Hotel Fasano Salvador, com criptografia BitLocker ativada e monitoramento de telemetria pelo agente TIHFSA. É expressamente proibido alterar diretivas de segurança, compartilhar senhas ou instalar programas não homologados.
  </p>

  <!-- BLOCO DE DUPLA VALIDAÇÃO DO BENEFICIÁRIO (ASSINATURA TOUCH + BIOMETRIA FACIAL) -->
  <table style="width: 100%; border-collapse: collapse; margin-top: 14px; border: 1px solid #cbd5e1; background-color: #f8fafc; border-radius: 8px; page-break-inside: avoid !important; break-inside: avoid !important;">
    <tr>
      <td colspan="2" style="padding: 6px 12px; font-size: 8.5pt; font-weight: bold; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">
        Aceite do Beneficiário (Dupla Validação: Assinatura Gráfica &amp; Biometria Facial)
      </td>
    </tr>
    <tr>
      <td style="width: 50%; padding: 8px 14px 6px 14px; text-align: center; vertical-align: bottom; border-right: 1px solid #e2e8f0;">
        <div style="min-height: 52px; display: flex; align-items: center; justify-content: center; margin-bottom: 3px;">
          {{assinatura_beneficiario}}
        </div>
        <div style="border-top: 1.5px solid #374151; padding-top: 4px;">
          <p style="margin: 0; font-size: 9pt; font-weight: bold; color: #0f172a;">{{nome_colaborador}}</p>
          <p style="margin: 1px 0 0 0; font-size: 8pt; color: #475569;">Assinatura Digital Manuscrita (Touch)</p>
          <p style="margin: 1px 0 0 0; font-size: 7.5pt; color: #64748b;">Doc: {{documento_cpf_rg}} | {{setor_departamento}}</p>
        </div>
      </td>
      <td style="width: 50%; padding: 8px 14px 6px 14px; text-align: center; vertical-align: bottom;">
        <div style="min-height: 52px; display: flex; align-items: center; justify-content: center; margin-bottom: 3px;">
          {{foto_biometria}}
        </div>
        <div style="border-top: 1.5px solid #374151; padding-top: 4px;">
          <p style="margin: 0; font-size: 9pt; font-weight: bold; color: #0f172a;">Validação Facial em Tempo Real</p>
          <p style="margin: 1px 0 0 0; font-size: 8pt; color: #475569;">Evidência Biométrica do Recebedor</p>
          <p style="margin: 1px 0 0 0; font-size: 7.5pt; color: #64748b;">Autenticação Facial (Face-API)</p>
        </div>
      </td>
    </tr>
  </table>

  <!-- RESPONSÁVEL PELA ENTREGA / TESTEMUNHA TI -->
  <table style="width: 100%; border-collapse: collapse; margin-top: 12px; page-break-inside: avoid !important; break-inside: avoid !important;">
    <tr>
      <td style="text-align: center; vertical-align: top; padding: 0;">
        <div style="display: inline-block; width: 55%; border-top: 1px solid #9ca3af; padding-top: 4px;">
          <p style="margin: 0; font-size: 9pt; font-weight: bold; color: #0f172a;">{{tecnico_responsavel}}</p>
          <p style="margin: 1px 0 0 0; font-size: 8pt; color: #475569;">Técnico Emissor / Testemunha da Entrega</p>
          <p style="margin: 1px 0 0 0; font-size: 7.5pt; color: #64748b;">Tecnologia da Informação — Hotel Fasano Salvador</p>
        </div>
      </td>
    </tr>
  </table>
</div>"""
            },
            {
                "title": "Termo de Cautela de Chaves de Acesso, TAGs e Crachás / Relógio",
                "category": "Acesso e Segurança",
                "description": "Modelo para cautela de chaves físicas mestras, tags RFID de controle de portas e relógio de ponto/acesso.",
                "default_items": json.dumps([
                    {"item_name": "Chave física de acesso numerada", "category": "Acesso", "quantity": 1, "condition": "Em perfeito estado", "accessories": "Chaveiro com numeração e identificação do setor"},
                    {"item_name": "TAG RFID / Cartão de Proximidade de Acesso", "category": "Acesso", "quantity": 1, "condition": "Ativo e codificado no sistema de catracas/portas", "accessories": "Cordão personalizado Fasano"}
                ], ensure_ascii=False),
                "content_html": """<div style="font-family: Arial, sans-serif; line-height: 1.45; color: #0f172a;">
  <div style="text-align: center; border-bottom: 2px solid #b89758; padding-bottom: 8px; margin-bottom: 12px;">
    <h2 style="margin: 0; color: #b89758; text-transform: uppercase; letter-spacing: 1.5px; font-size: 15pt;">HOTEL FASANO SALVADOR</h2>
    <h3 style="margin: 3px 0 0 0; font-weight: 700; font-size: 11pt; color: #1e293b;">TERMO DE CAUTELA — CHAVES E DISPOSITIVOS DE ACESSO</h3>
    <p style="margin: 3px 0 0 0; font-size: 8.5pt; color: #64748b;">Número: <strong>{{numero_termo}}</strong> &bull; Emissão: <strong>{{data_emissao}}</strong></p>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9pt; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; page-break-inside: avoid !important; break-inside: avoid !important;">
    <tr>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; background-color: #f8fafc; width: 22%; font-weight: 600; color: #334155;">Colaborador(a):</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; width: 38%; font-weight: 600; color: #0f172a;">{{nome_colaborador}}</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; background-color: #f8fafc; width: 18%; font-weight: 600; color: #334155;">Documento / CPF:</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; width: 22%; color: #0f172a;">{{documento_cpf_rg}}</td>
    </tr>
    <tr>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; background-color: #f8fafc; font-weight: 600; color: #334155;">Setor / Função:</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; color: #0f172a;">{{setor_departamento}}</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; background-color: #f8fafc; font-weight: 600; color: #334155;">Técnico Emissor:</td>
      <td style="padding: 5px 8px; border: 1px solid #e2e8f0; color: #0f172a;">{{tecnico_responsavel}}</td>
    </tr>
  </table>

  <h4 style="margin: 10px 0 4px 0; color: #1e293b; text-transform: uppercase; font-size: 9.5pt; font-weight: bold; border-left: 3.5px solid #b89758; padding-left: 8px;">1. Chaves e Dispositivos Entregues</h4>
  {{tabela_equipamentos}}

  <h4 style="margin: 12px 0 4px 0; color: #1e293b; text-transform: uppercase; font-size: 9.5pt; font-weight: bold; border-left: 3.5px solid #b89758; padding-left: 8px;">2. Termos de Segurança Física e Patrimonial</h4>
  <p style="font-size: 8.5pt; line-height: 1.45; text-align: justify; color: #374151; margin-top: 4px; margin-bottom: 8px;">
    A guarda da chave ou TAG de proximidade é de responsabilidade estritamente pessoal e intransferível. É expressamente proibido confeccionar cópias sem autorização formal da Segurança Patrimonial ou franquear a entrada de pessoas não autorizadas em áreas restritas.
  </p>

  <!-- BLOCO DE DUPLA VALIDAÇÃO DO BENEFICIÁRIO (ASSINATURA TOUCH + BIOMETRIA FACIAL) -->
  <table style="width: 100%; border-collapse: collapse; margin-top: 14px; border: 1px solid #cbd5e1; background-color: #f8fafc; border-radius: 8px; page-break-inside: avoid !important; break-inside: avoid !important;">
    <tr>
      <td colspan="2" style="padding: 6px 12px; font-size: 8.5pt; font-weight: bold; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">
        Aceite do Beneficiário (Dupla Validação: Assinatura Gráfica &amp; Biometria Facial)
      </td>
    </tr>
    <tr>
      <td style="width: 50%; padding: 8px 14px 6px 14px; text-align: center; vertical-align: bottom; border-right: 1px solid #e2e8f0;">
        <div style="min-height: 52px; display: flex; align-items: center; justify-content: center; margin-bottom: 3px;">
          {{assinatura_beneficiario}}
        </div>
        <div style="border-top: 1.5px solid #374151; padding-top: 4px;">
          <p style="margin: 0; font-size: 9pt; font-weight: bold; color: #0f172a;">{{nome_colaborador}}</p>
          <p style="margin: 1px 0 0 0; font-size: 8pt; color: #475569;">Assinatura Digital Manuscrita (Touch)</p>
          <p style="margin: 1px 0 0 0; font-size: 7.5pt; color: #64748b;">Doc: {{documento_cpf_rg}} | {{setor_departamento}}</p>
        </div>
      </td>
      <td style="width: 50%; padding: 8px 14px 6px 14px; text-align: center; vertical-align: bottom;">
        <div style="min-height: 52px; display: flex; align-items: center; justify-content: center; margin-bottom: 3px;">
          {{foto_biometria}}
        </div>
        <div style="border-top: 1.5px solid #374151; padding-top: 4px;">
          <p style="margin: 0; font-size: 9pt; font-weight: bold; color: #0f172a;">Validação Facial em Tempo Real</p>
          <p style="margin: 1px 0 0 0; font-size: 8pt; color: #475569;">Evidência Biométrica do Recebedor</p>
          <p style="margin: 1px 0 0 0; font-size: 7.5pt; color: #64748b;">Autenticação Facial (Face-API)</p>
        </div>
      </td>
    </tr>
  </table>

  <!-- RESPONSÁVEL PELA ENTREGA / TESTEMUNHA TI -->
  <table style="width: 100%; border-collapse: collapse; margin-top: 12px; page-break-inside: avoid !important; break-inside: avoid !important;">
    <tr>
      <td style="text-align: center; vertical-align: top; padding: 0;">
        <div style="display: inline-block; width: 55%; border-top: 1px solid #9ca3af; padding-top: 4px;">
          <p style="margin: 0; font-size: 9pt; font-weight: bold; color: #0f172a;">{{tecnico_responsavel}}</p>
          <p style="margin: 1px 0 0 0; font-size: 8pt; color: #475569;">Técnico Emissor / Testemunha da Entrega</p>
          <p style="margin: 1px 0 0 0; font-size: 7.5pt; color: #64748b;">Tecnologia da Informação — Hotel Fasano Salvador</p>
        </div>
      </td>
    </tr>
  </table>
</div>"""
            }
        ]

        existing_templates = db.query(EquipmentTermTemplate).all()
        if existing_templates:
            # Sincroniza / atualiza os templates existentes com a estrutura correta de dupla validação em tabela nativa
            for tmpl in existing_templates:
                for new_t in templates:
                    if tmpl.title == new_t["title"]:
                        tmpl.content_html = new_t["content_html"]
                        tmpl.category = new_t["category"]
                        tmpl.description = new_t["description"]
                        tmpl.default_items = new_t["default_items"]
            db.commit()
            print("[INIT_DB] Modelos de termos de responsabilidade sincronizados com layout compacto anti-quebra.")
        else:
            for tmpl in templates:
                db.add(EquipmentTermTemplate(**tmpl))
            db.commit()
            print(f"[INIT_DB] {len(templates)} modelo(s) padrão de termos de responsabilidade criados com sucesso.")

        # Sincroniza termos existentes na tabela equipment_terms para que documentos já gerados também fiquem compactos e sem quebra
        from app.models.term import EquipmentTerm
        existing_terms = db.query(EquipmentTerm).all()
        for term_rec in existing_terms:
            if term_rec.legal_text:
                for new_t in templates:
                    if new_t["title"] in term_rec.legal_text or ("TERMO DE RESPONSABILIDADE E RETIRADA DE EQUIPAMENTOS" in term_rec.legal_text and "Periférico" in term_rec.legal_text):
                        term_rec.legal_text = new_t["content_html"]
                        break
                else:
                    if "Aceite do Beneficiário" in term_rec.legal_text or "TERMO DE RESPONSABILIDADE" in term_rec.legal_text:
                        term_rec.legal_text = templates[0]["content_html"]
        db.commit()
        print(f"[INIT_DB] {len(existing_terms)} termo(s) existente(s) atualizados com o layout compacto A4 de 1 página.")
    except Exception as e:
        db.rollback()
        print(f"[INIT_DB] Aviso ao sincronizar modelos de termos: {e}")


def seed_default_knowledge_base(db: Session):
    """
    Popula e sincroniza a Base de Conhecimento operacional (KB) com artigos
    técnicos, guias de autoatendimento e manuais de expansão de hotéis.
    """
    try:
        from app.services.knowledge_seed import seed_knowledge_base
        res = seed_knowledge_base(db, overwrite=False)
        if res.get("created", 0) > 0:
            print(f"[INIT_DB] Base de Conhecimento: {res['created']} artigo(s) inserido(s) com sucesso.")
        else:
            print("[INIT_DB] Base de Conhecimento: Categorias e artigos operacionais já verificados/preservados.")
    except Exception as e:
        print(f"[INIT_DB] Aviso ao sincronizar Base de Conhecimento: {e}")


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
        seed_default_term_templates(db)
        seed_default_knowledge_base(db)
        cleanup_corrupted_logon_history()
    finally:
        db.close()

    print("=" * 60)
    print("  [OK] Banco de dados TIHFSA pronto para operação!")
    print("=" * 60)


def cleanup_corrupted_logon_history():
    """
    Higieniza registros de logon espúrios gerados por varreduras de antivírus/manutenção
    do Windows em diretórios de perfis locais antigos de ex-funcionários.
    """
    try:
        with engine.begin() as conn:
            # 1. Remove contas de serviços do sistema
            conn.execute(text("""
                DELETE FROM agent_logon_history
                WHERE username IN ('ksnproxy', 'defaultapppool', 'iusr', 'iwam', 'sshd', 'guest', 'convidado', 'wdagutilityaccount');
            """))
            # 2. Remove registros gerados em lote por varreduras de manutenção
            conn.execute(text("""
                DELETE FROM agent_logon_history
                WHERE is_current = FALSE
                  AND logon_type = 'Perfil Local'
                  AND (
                      (logon_time >= '2026-10-11 07:28:00' AND logon_time <= '2026-10-11 07:30:00')
                      OR (logon_time >= '2026-10-06 21:23:00' AND logon_time <= '2026-10-06 21:24:00')
                      OR (logon_time >= '2026-10-08 08:32:00' AND logon_time <= '2026-10-08 08:33:00')
                      OR (logon_time >= '2026-10-09 23:11:00' AND logon_time <= '2026-10-09 23:12:00')
                      OR (logon_time >= '2026-10-12 18:46:00' AND logon_time <= '2026-10-12 18:47:00')
                  );
            """))
            # 3. Alinha last_seen_at para registros que já estavam em logoff e tiveram last_seen_at
            # erroneamente atualizado para a hora do checkin
            conn.execute(text("""
                UPDATE agent_logon_history
                SET last_seen_at = logon_time
                WHERE is_current = FALSE
                  AND session_state = 'logged_off'
                  AND logon_time IS NOT NULL
                  AND last_seen_at > logon_time;
            """))
        print("[INIT_DB] Registros corrompidos de histórico de logon higienizados com sucesso.")
    except Exception as e:
        print(f"[INIT_DB] Aviso ao higienizar histórico de logon: {e}")

    try:
        from app.models.system_setting import SystemSetting
        from app.routers.system_settings import sync_pwa_files
        db = SessionLocal()
        s = db.query(SystemSetting).first()
        sync_pwa_files(s)
        db.close()
        print("[INIT_DB] Arquivos estáticos do PWA e manifesto sincronizados com sucesso.")
    except Exception as e:
        print(f"[INIT_DB] Aviso ao sincronizar arquivos do PWA: {e}")


if __name__ == "__main__":
    main()

