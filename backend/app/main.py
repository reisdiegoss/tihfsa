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
    attachments, departments, ad_import, locations, asset_types, network_maps, integrations
)
import app.models.network_map  # noqa: F401

# Criar pasta uploads se não existir
os.makedirs("uploads", exist_ok=True)


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
                # Rodar função sincrona em thread pool para não bloquear o event loop
                await asyncio.to_thread(sync_active_zabbix_alerts, db)
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Zabbix Poller] Erro: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: cria tabelas no banco se não existirem e inicia tarefas em background."""
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE assets ADD COLUMN IF NOT EXISTS sound_alert_offline BOOLEAN DEFAULT FALSE NOT NULL;"))
            conn.execute(text("ALTER TABLE network_maps ADD COLUMN IF NOT EXISTS in_carousel BOOLEAN DEFAULT TRUE NOT NULL;"))
            conn.execute(text("ALTER TABLE network_maps ADD COLUMN IF NOT EXISTS carousel_order INTEGER DEFAULT 0 NOT NULL;"))
            conn.execute(text("ALTER TABLE network_maps ADD COLUMN IF NOT EXISTS carousel_seconds INTEGER DEFAULT 20 NOT NULL;"))
            conn.commit()
    except Exception as e:
        print(f"[DB Auto-Migration Error] {e}")
    _seed_default_asset_types()
    
    # Iniciar o background poller do Zabbix
    poller_task = asyncio.create_task(zabbix_poller_task())
    
    print(f"[{settings.app_name}] Backend iniciado. Tabelas e Tipos de Equipamento prontos.")
    yield
    
    # Cancelar tarefas ao encerrar o servidor
    poller_task.cancel()
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
