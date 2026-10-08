"""
TIHFSA Backend — FastAPI Application.

Sistema Integrado de Gestão de TI do Hotel Fasano Salvador.
Helpdesk + CMDB + Monitoramento Zabbix.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import asyncio

from app.config import settings
from app.database import Base, engine, SessionLocal
from app.routers import (
    auth, users, assets, tickets, categories, sync, zabbix, 
    attachments, departments, ad_import, locations, asset_types, network_maps, integrations, qrcodes,
    sla, monitoring, public_tickets, rooms, floors, system_settings, surveys, notification_logs, contracts
)
import app.models.network_map  # noqa: F401
import app.models.qrcode       # noqa: F401
import app.models.sla          # noqa: F401

# Criar pasta uploads se não existir
os.makedirs("uploads", exist_ok=True)

# Ativar resolvedor de DNS corporativo resiliente (suporte nativo para Docker e Linux sem DNS interno)
from app.utils.dns_resolver import setup_corporate_dns_resolver
setup_corporate_dns_resolver()


def _seed_default_asset_types():
    from app.database import SessionLocal
    from app.models.asset_type import AssetTypeModel

    db = SessionLocal()
    try:
        count = db.query(AssetTypeModel).count()
        if count == 0:
            defaults = [
                {
                    "name": "Servidor",
                    "icon": "Server",
                    "description": "Servidores de aplicação, banco de dados e virtualizadores",
                    "custom_fields": [
                        {"name": "Processador (vCPU)", "key": "vcpu", "field_type": "number", "required": False},
                        {"name": "Memória RAM (GB)", "key": "ram_gb", "field_type": "number", "required": False},
                        {"name": "Armazenamento (TB/RAID)", "key": "storage", "field_type": "text", "required": False},
                        {"name": "Sistema Operacional", "key": "os", "field_type": "text", "required": False},
                        {"name": "IP Gerenciamento (iLO/iDRAC)", "key": "idrac_ip", "field_type": "text", "required": False},
                    ]
                },
                {
                    "name": "Desktop / Workstation",
                    "icon": "Monitor",
                    "description": "Computadores de mesa dos setores administrativos e recepção",
                    "custom_fields": [
                        {"name": "Processador", "key": "cpu", "field_type": "text", "required": False},
                        {"name": "Memória RAM", "key": "ram", "field_type": "select", "options": ["4 GB", "8 GB", "16 GB", "32 GB"], "required": False},
                        {"name": "Armazenamento (SSD/HD)", "key": "storage", "field_type": "text", "required": False},
                        {"name": "Sistema Operacional", "key": "os", "field_type": "text", "required": False},
                    ]
                },
                {
                    "name": "Notebook",
                    "icon": "Monitor",
                    "description": "Laptops e notebooks corporativos",
                    "custom_fields": [
                        {"name": "Processador", "key": "cpu", "field_type": "text", "required": False},
                        {"name": "Memória RAM", "key": "ram", "field_type": "select", "options": ["8 GB", "16 GB", "32 GB"], "required": False},
                        {"name": "Armazenamento SSD", "key": "storage", "field_type": "text", "required": False},
                        {"name": "Tamanho da Tela", "key": "screen_size", "field_type": "text", "required": False},
                    ]
                },
                {
                    "name": "Switch / Roteador",
                    "icon": "HardDrive",
                    "description": "Switches de acesso, core e roteadores de borda",
                    "custom_fields": [
                        {"name": "Número de Portas", "key": "ports", "field_type": "number", "required": False},
                        {"name": "Velocidade das Portas", "key": "speed", "field_type": "select", "options": ["100 Mbps", "1 Gbps", "10 Gbps", "25 Gbps"], "required": False},
                        {"name": "Suporta PoE", "key": "poe", "field_type": "boolean", "required": False},
                        {"name": "VLANs Principais", "key": "vlans", "field_type": "text", "required": False},
                    ]
                },
                {
                    "name": "Access Point / Antena Wi-Fi",
                    "icon": "Wifi",
                    "description": "Antenas Ubiquiti UniFi e pontos de acesso Wi-Fi",
                    "custom_fields": [
                        {"name": "Frequência Suportada", "key": "freq", "field_type": "select", "options": ["2.4 GHz", "5 GHz", "Dual-Band (2.4/5GHz)", "Wi-Fi 6 (AX)"], "required": False},
                        {"name": "SSID Transmitido", "key": "ssid", "field_type": "text", "required": False},
                        {"name": "Ganho da Antena (dBi)", "key": "gain_dbi", "field_type": "text", "required": False},
                    ]
                },
                {
                    "name": "Telefone IP / Ramal",
                    "icon": "Phone",
                    "description": "Telefones SIP, ramais dos apartamentos e administrativas",
                    "custom_fields": [
                        {"name": "Número do Ramal", "key": "extension", "field_type": "text", "required": False},
                        {"name": "Protocolo", "key": "protocol", "field_type": "select", "options": ["SIP / VoIP", "Analógico", "Digital"], "required": False},
                    ]
                },
                {
                    "name": "TV / Smart TV",
                    "icon": "Tv",
                    "description": "Televisores das Unidades Habitacionais (UH) e áreas comuns",
                    "custom_fields": [
                        {"name": "Tamanho (Polegadas)", "key": "screen_inches", "field_type": "number", "required": False},
                        {"name": "Resolução", "key": "resolution", "field_type": "select", "options": ["Full HD (1080p)", "4K UHD", "8K"], "required": False},
                        {"name": "Sistema Smart", "key": "smart_os", "field_type": "text", "required": False},
                    ]
                },
                {
                    "name": "Impressora",
                    "icon": "Printer",
                    "description": "Impressoras de recibos, térmicas e multifuncionais de rede",
                    "custom_fields": [
                        {"name": "Tipo de Impressão", "key": "print_type", "field_type": "select", "options": ["Laser Mono", "Laser Color", "Térmica / Cupom", "Jato de Tinta"], "required": False},
                        {"name": "Impressão em Rede", "key": "network_print", "field_type": "boolean", "required": False},
                    ]
                }
            ]
            for item in defaults:
                db.add(AssetTypeModel(**item))
            db.commit()
            print("[Seed] 8 Tipos de Equipamento padrão cadastrados com sucesso!")

        # Sincronizar qualquer tipo existente na tabela assets que não esteja em asset_types
        from app.models.asset import Asset
        distinct_types = db.query(Asset.type).distinct().all()
        existing_configured_names = {t.name.lower(): t for t in db.query(AssetTypeModel).all()}

        for r in distinct_types:
            t_name = str(r[0]).strip() if r[0] else ""
            if t_name and t_name.lower() not in existing_configured_names:
                new_type = AssetTypeModel(
                    name=t_name,
                    icon="Server",
                    description="Tipo importado automaticamente dos equipamentos cadastrados",
                    custom_fields=[]
                )
                db.add(new_type)
                existing_configured_names[t_name.lower()] = new_type
        db.commit()

    except Exception as e:
        print(f"[Seed Asset Types Error] {e}")
        db.rollback()
    finally:
        db.close()


async def zabbix_poller_task():
    """Tarefa em segundo plano que pesquisa alertas do Zabbix continuamente."""
    from app.routers.zabbix import sync_active_zabbix_alerts
    while True:
        try:
            await asyncio.sleep(60) # Checa a cada 60 segundos
            db = SessionLocal()
            try:
                # Rodar função síncrona em thread pool para não bloquear o event loop
                await asyncio.to_thread(sync_active_zabbix_alerts, db)
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Zabbix Poller] Erro: {e}")


async def unifi_poller_task():
    """Tarefa em segundo plano que monitora status de Switches e APs da UniFi continuamente."""
    from app.services.unifi_service import sync_active_unifi_devices
    while True:
        try:
            await asyncio.sleep(60) # Checa a cada 60 segundos
            db = SessionLocal()
            try:
                # Rodar função síncrona em thread pool para não bloquear o event loop
                await asyncio.to_thread(sync_active_unifi_devices, db)
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[UniFi Poller] Erro: {e}")

async def ticket_summary_scheduler_task():
    """
    Verifica a cada 30 segundos se o horário atual (fuso de Salvador/UTC-3)
    coincide com algum dos horários configurados para cobrança de chamados.
    """
    from datetime import datetime, timezone, timedelta
    from app.models.integration_config import EvolutionConfig
    from app.services.alert_summary_service import send_open_tickets_summary

    last_dispatched_key = None
    tz_br = timezone(timedelta(hours=-3))

    while True:
        try:
            await asyncio.sleep(30)
            now_br = datetime.now(tz_br)
            current_time_str = now_br.strftime("%H:%M")
            current_date_str = now_br.strftime("%Y-%m-%d")
            dispatch_key = f"{current_date_str}_{current_time_str}"

            if dispatch_key == last_dispatched_key:
                continue

            db = SessionLocal()
            try:
                config = db.query(EvolutionConfig).first()
                if config and getattr(config, "summary_reminder_active", True):
                    raw_times = getattr(config, "summary_reminder_times", "") or "09:00,14:00,18:00"
                    target_times = [t.strip() for t in raw_times.split(",") if t.strip()]

                    if current_time_str in target_times:
                        last_dispatched_key = dispatch_key
                        print(f"[Summary Scheduler] Disparando resumo de chamados programado para as {current_time_str}...")
                        await asyncio.to_thread(send_open_tickets_summary, db=db, force=False)
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Summary Scheduler Error] {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: cria tabelas no banco se não existirem e inicia tarefas em background."""
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE assets ADD COLUMN IF NOT EXISTS sound_alert_offline BOOLEAN DEFAULT FALSE NOT NULL;"))
            conn.execute(text("ALTER TABLE network_maps ADD COLUMN IF NOT EXISTS pan_y INTEGER DEFAULT 0;"))
            conn.execute(text("ALTER TABLE network_maps ADD COLUMN IF NOT EXISTS in_carousel BOOLEAN DEFAULT TRUE NOT NULL;"))
            conn.execute(text("ALTER TABLE network_maps ADD COLUMN IF NOT EXISTS carousel_order INTEGER DEFAULT 0 NOT NULL;"))
            conn.execute(text("ALTER TABLE network_maps ADD COLUMN IF NOT EXISTS carousel_seconds INTEGER DEFAULT 20 NOT NULL;"))
            conn.execute(text("ALTER TABLE evolution_config ADD COLUMN IF NOT EXISTS summary_reminder_active BOOLEAN DEFAULT TRUE;"))
            conn.execute(text("ALTER TABLE evolution_config ADD COLUMN IF NOT EXISTS summary_reminder_times VARCHAR DEFAULT '09:00,14:00,18:00';"))
            conn.execute(text("ALTER TABLE evolution_config ADD COLUMN IF NOT EXISTS summary_reminder_whatsapp BOOLEAN DEFAULT TRUE;"))
            conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMP WITH TIME ZONE;"))
            conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS reopen_count INTEGER DEFAULT 0 NOT NULL;"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_modules JSON;"))
            conn.execute(text("ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS notify_requester_on_update BOOLEAN DEFAULT TRUE;"))
            conn.execute(text("ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS notify_ti_on_create BOOLEAN DEFAULT TRUE;"))
            conn.execute(text("ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS notify_ti_on_close BOOLEAN DEFAULT TRUE;"))
            conn.execute(text("ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS notify_ti_on_update BOOLEAN DEFAULT TRUE;"))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS location_departments (
                    location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
                    department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
                    PRIMARY KEY (location_id, department_id)
                );
                CREATE TABLE IF NOT EXISTS notification_logs (
                    id SERIAL PRIMARY KEY,
                    channel VARCHAR(30) NOT NULL,
                    notification_type VARCHAR(50) NOT NULL,
                    recipient VARCHAR(255) NOT NULL,
                    recipient_name VARCHAR(150),
                    subject VARCHAR(300),
                    body TEXT,
                    ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
                    status VARCHAR(30) DEFAULT 'SENT' NOT NULL,
                    error_message TEXT,
                    resend_count INTEGER DEFAULT 0 NOT NULL,
                    last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
                );
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
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS system_settings (
                    id SERIAL PRIMARY KEY,
                    support_notification_email VARCHAR(255) DEFAULT 'ti-hfsa@fasano.com.br' NOT NULL,
                    email_header_title VARCHAR(255) DEFAULT 'TIHFSA — Hotel Fasano Salvador' NOT NULL,
                    email_header_subtitle VARCHAR(255) DEFAULT 'Central de Serviços & Suporte de TI' NOT NULL,
                    email_body_title VARCHAR(255) DEFAULT 'Notificação de Atendimento' NOT NULL,
                    ticket_warranty_days INTEGER DEFAULT 7 NOT NULL,
                    csat_enabled BOOLEAN DEFAULT TRUE NOT NULL,
                    notify_requester_on_create BOOLEAN DEFAULT TRUE NOT NULL,
                    notify_requester_on_assign BOOLEAN DEFAULT TRUE NOT NULL,
                    notify_requester_on_solve BOOLEAN DEFAULT TRUE NOT NULL,
                    notify_technician_on_assign BOOLEAN DEFAULT TRUE NOT NULL
                );
                ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS email_body_title VARCHAR(255) DEFAULT 'Notificação de Atendimento' NOT NULL;
                CREATE TABLE IF NOT EXISTS ticket_satisfaction_surveys (
                    id SERIAL PRIMARY KEY,
                    ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE UNIQUE NOT NULL,
                    rating INTEGER,
                    comment TEXT,
                    token VARCHAR(64) UNIQUE NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                    answered_at TIMESTAMP WITH TIME ZONE
                );
                INSERT INTO system_settings (id, support_notification_email, email_header_title, email_header_subtitle, email_body_title, ticket_warranty_days, csat_enabled)
                SELECT 1, 'ti-hfsa@fasano.com.br', 'TIHFSA — Hotel Fasano Salvador', 'Central de Serviços & Suporte de TI', 'Notificação de Atendimento', 7, TRUE
                WHERE NOT EXISTS (SELECT 1 FROM system_settings);
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS zabbix_config (
                    id SERIAL PRIMARY KEY,
                    min_severity INTEGER DEFAULT 3,
                    ignored_patterns VARCHAR DEFAULT 'System time is out of sync,Failed to fetch info data,has just been restarted',
                    auto_ticket_enabled BOOLEAN DEFAULT TRUE,
                    auto_notify_whatsapp BOOLEAN DEFAULT TRUE,
                    auto_notify_email BOOLEAN DEFAULT TRUE
                );
                CREATE TABLE IF NOT EXISTS qrcodes (
                    id SERIAL PRIMARY KEY,
                    code VARCHAR(32) UNIQUE NOT NULL,
                    type VARCHAR(20) NOT NULL DEFAULT 'equipment',
                    encode_mode VARCHAR(20) DEFAULT 'vcard',
                    title VARCHAR(200) NOT NULL,
                    company VARCHAR(150),
                    ssid VARCHAR(100),
                    password VARCHAR(100),
                    security_type VARCHAR(20) DEFAULT 'WPA',
                    is_hidden BOOLEAN DEFAULT FALSE,
                    collaborator VARCHAR(150),
                    asset_name VARCHAR(150),
                    brand VARCHAR(100),
                    model VARCHAR(100),
                    address VARCHAR(255),
                    message TEXT,
                    asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
                    logo_url VARCHAR(500),
                    include_logo BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL
                );
                CREATE TABLE IF NOT EXISTS qrcode_config (
                    id SERIAL PRIMARY KEY,
                    default_logo_url VARCHAR(500),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS sla_config (
                    id SERIAL PRIMARY KEY,
                    calc_business_hours BOOLEAN DEFAULT FALSE NOT NULL,
                    business_start_time VARCHAR(10) DEFAULT '08:00' NOT NULL,
                    business_end_time VARCHAR(10) DEFAULT '18:00' NOT NULL,
                    business_days VARCHAR(50) DEFAULT 'mon,tue,wed,thu,fri' NOT NULL,
                    enable_category_sla BOOLEAN DEFAULT FALSE NOT NULL,
                    critical_response_min INTEGER DEFAULT 15 NOT NULL,
                    critical_resolution_min INTEGER DEFAULT 120 NOT NULL,
                    high_response_min INTEGER DEFAULT 60 NOT NULL,
                    high_resolution_min INTEGER DEFAULT 240 NOT NULL,
                    medium_response_min INTEGER DEFAULT 120 NOT NULL,
                    medium_resolution_min INTEGER DEFAULT 480 NOT NULL,
                    low_response_min INTEGER DEFAULT 240 NOT NULL,
                    low_resolution_min INTEGER DEFAULT 1440 NOT NULL,
                    warning_threshold_percent INTEGER DEFAULT 75 NOT NULL,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL
                );
                CREATE TABLE IF NOT EXISTS sla_category_rules (
                    id SERIAL PRIMARY KEY,
                    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE UNIQUE NOT NULL,
                    response_min INTEGER,
                    resolution_min INTEGER NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """))
            conn.execute(text("ALTER TABLE qrcodes ADD COLUMN IF NOT EXISTS encode_mode VARCHAR(20) DEFAULT 'vcard';"))
            conn.execute(text("ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;"))
            conn.execute(text("UPDATE categories SET is_public = TRUE WHERE is_public IS NULL;"))
            conn.execute(text("ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;"))
            conn.execute(text("UPDATE locations SET is_public = TRUE WHERE is_public IS NULL;"))
            conn.execute(text("UPDATE locations SET is_public = FALSE WHERE name ILIKE '%rack%' OR name ILIKE '%cpd%' OR name ILIKE '%servidor%';"))
            # Tabela de Telemetria do TIHFSA Agent (Substituição Nativa Zabbix)
            conn.execute(text("""
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

                CREATE TABLE IF NOT EXISTS agent_metrics_history (
                    id SERIAL PRIMARY KEY,
                    hostname VARCHAR(150) NOT NULL,
                    cpu_usage_pct INTEGER,
                    ram_used_mb INTEGER,
                    ram_total_mb INTEGER,
                    ram_usage_pct NUMERIC(5,2),
                    disk_metrics JSONB,
                    disk_usage_pct NUMERIC(5,2),
                    disk_free_gb NUMERIC(8,2),
                    uptime_hours NUMERIC(8,1),
                    status VARCHAR(20) DEFAULT 'online' NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
                );
                ALTER TABLE agent_metrics_history ADD COLUMN IF NOT EXISTS disk_usage_pct NUMERIC(5,2);
                ALTER TABLE agent_metrics_history ADD COLUMN IF NOT EXISTS disk_free_gb NUMERIC(8,2);
                CREATE INDEX IF NOT EXISTS idx_agent_metrics_history_hostname ON agent_metrics_history(hostname);
                CREATE INDEX IF NOT EXISTS idx_agent_metrics_history_created_at ON agent_metrics_history(created_at);
                CREATE INDEX IF NOT EXISTS idx_agent_metrics_history_host_created ON agent_metrics_history(hostname, created_at DESC);
            """))
            # Seed SLA config default se tabela estiver vazia
            conn.execute(text("""
                INSERT INTO sla_config (
                    id, calc_business_hours, business_start_time, business_end_time, business_days,
                    enable_category_sla, critical_response_min, critical_resolution_min,
                    high_response_min, high_resolution_min, medium_response_min, medium_resolution_min,
                    low_response_min, low_resolution_min, warning_threshold_percent
                )
                SELECT 1, FALSE, '08:00', '18:00', 'mon,tue,wed,thu,fri',
                       FALSE, 15, 120, 60, 240, 120, 480, 240, 1440, 75
                WHERE NOT EXISTS (SELECT 1 FROM sla_config);
            """))
            conn.commit()
    except Exception as e:
        print(f"[DB Auto-Migration Error] {e}")
    _seed_default_asset_types()
    
    # Iniciar os background pollers do Zabbix, UniFi e Agendador de Resumo
    zabbix_task = asyncio.create_task(zabbix_poller_task())
    unifi_task = asyncio.create_task(unifi_poller_task())
    summary_task = asyncio.create_task(ticket_summary_scheduler_task())
    
    print(f"[{settings.app_name}] Backend iniciado. Pollers Zabbix, UniFi e Agendador de Resumo ativos.")
    yield
    
    # Cancelar tarefas ao encerrar o servidor
    zabbix_task.cancel()
    unifi_task.cancel()
    summary_task.cancel()
    print(f"[{settings.app_name}] Backend encerrado.")


app = FastAPI(
    title=settings.app_name,
    description="Sistema Integrado de Gestão de TI — Hotel Fasano Salvador",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — permite qualquer origem de IP, localhost e portas (Vite dev server, TV dashboard, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        settings.app_base_url,
    ],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar routers

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(assets.router)
app.include_router(tickets.router)
app.include_router(categories.router)
app.include_router(sync.router)
app.include_router(zabbix.router)
app.include_router(attachments.router)
app.include_router(departments.router)
app.include_router(ad_import.router)
app.include_router(locations.router)
app.include_router(asset_types.router)
app.include_router(network_maps.router)
app.include_router(integrations.router)
app.include_router(integrations.router_unifi)
app.include_router(qrcodes.router)
app.include_router(sla.router)
app.include_router(monitoring.router)
app.include_router(public_tickets.router)
app.include_router(rooms.router)
app.include_router(floors.router)
app.include_router(system_settings.router)
app.include_router(surveys.router)
app.include_router(notification_logs.router)
app.include_router(contracts.router)

# Servir arquivos estáticos (uploads)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/", tags=["Health"])
def health_check():
    return {
        "status": "online",
        "app": settings.app_name,
        "version": "1.0.0",
        "message": "TIHFSA — Hotel Fasano Salvador IT Management System",
    }
