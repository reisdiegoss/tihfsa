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

from app.config import settings
from app.database import Base, engine
from app.routers import auth, users, assets, tickets, categories, sync, zabbix, attachments, departments, ad_import

# Criar pasta uploads se não existir
os.makedirs("uploads", exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: cria tabelas no banco se não existirem."""
    # Importa todos os models para registrar no Base.metadata
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    print(f"[{settings.app_name}] Backend iniciado. Tabelas criadas/verificadas.")
    yield
    print(f"[{settings.app_name}] Backend encerrado.")


app = FastAPI(
    title=settings.app_name,
    description="Sistema Integrado de Gestão de TI — Hotel Fasano Salvador",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — permite o frontend acessar a API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://localhost:3000",   # Alternativo
        settings.app_base_url,
    ],
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
