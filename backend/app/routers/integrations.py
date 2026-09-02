from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.integration_config import EvolutionConfig, UnifiConfig
from app.services.evolution_service import EvolutionService
from app.services.unifi_service import UnifiService

router = APIRouter(prefix="/api/v1/integrations/evolution", tags=["Integrations"])

class EvolutionConfigSchema(BaseModel):
    api_url: str | None = None
    instance_name: str | None = None
    api_key: str | None = None
    ti_group_jid: str | None = None
    is_active: bool = False

@router.get("", response_model=EvolutionConfigSchema)
def get_evolution_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores podem acessar integrações.")
        
    config = db.query(EvolutionConfig).first()
    if not config:
        return EvolutionConfigSchema()
        
    return EvolutionConfigSchema(
        api_url=config.api_url,
        instance_name=config.instance_name,
        api_key=config.api_key,
        ti_group_jid=config.ti_group_jid,
        is_active=config.is_active
    )

@router.post("")
def save_evolution_config(
    payload: EvolutionConfigSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores podem alterar integrações.")
        
    config = db.query(EvolutionConfig).first()
    if not config:
        config = EvolutionConfig()
        db.add(config)
        
    config.api_url = payload.api_url
    config.instance_name = payload.instance_name
    config.api_key = payload.api_key
    config.ti_group_jid = payload.ti_group_jid
    config.is_active = payload.is_active
    
    db.commit()
    return {"message": "Configurações do Evolution API salvas com sucesso!"}

@router.post("/groups")
def fetch_evolution_groups(
    payload: EvolutionConfigSchema,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Acesso negado.")
        
    import httpx
    if not payload.api_url or not payload.instance_name or not payload.api_key:
        raise HTTPException(status_code=400, detail="Preencha URL, Instância e API Key para carregar os grupos.")
        
    url = f"{payload.api_url.rstrip('/')}/group/list"
    headers = {
        "apikey": payload.api_key,
        "Content-Type": "application/json"
    }
    
    try:
        response = httpx.get(url, headers=headers, timeout=15.0, verify=False)
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Instância não encontrada na Evolution API.")
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Erro na Evolution API: {response.text}")
            
        data = response.json()
        groups = []
        
        # O Evolution pode retornar os dados num dict, ou numa lista
        if isinstance(data, dict):
            # As vezes vem dentro de um campo
            data_list = data.get("data", []) if "data" in data else []
            # Tenta pegar apenas values se for um dicionário de IDs
            if not data_list and len(data) > 0 and isinstance(list(data.values())[0], dict):
                data_list = list(data.values())
            data = data_list
            
        if not isinstance(data, list):
            raise HTTPException(status_code=400, detail="Formato de resposta inesperado da Evolution API.")

        for g in data:
            if isinstance(g, dict):
                group_id = g.get("id") or g.get("jid") or g.get("JID")
                group_name = g.get("subject") or g.get("name") or g.get("Name") or g.get("groupName") or g.get("title")
                
                if not group_name:
                    import json
                    group_name = f"JSON: {json.dumps(g)[:80]}"
                    
                groups.append({
                    "id": group_id,
                    "subject": group_name
                })
            
        return groups
    except httpx.RequestError as e:
        raise HTTPException(status_code=400, detail=f"Falha de conexão com a API: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro interno ao buscar grupos: {str(e)}")

from fastapi import BackgroundTasks

class TestMessageSchema(BaseModel):
    text: str

@router.post("/test")
def test_evolution_message(
    payload: TestMessageSchema,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Acesso negado.")
        
    background_tasks.add_task(EvolutionService.send_whatsapp_message, f"🧪 *Teste de Integração*\n\n{payload.text}")
    return {"message": "Requisição de teste enviada."}


router_unifi = APIRouter(prefix="/api/v1/integrations/unifi", tags=["Integrations - UniFi"])

class UnifiConfigSchema(BaseModel):
    api_url: str | None = None
    username: str | None = None
    password: str | None = None
    site_id: str | None = None
    is_active: bool = False

@router_unifi.get("", response_model=UnifiConfigSchema)
def get_unifi_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores podem acessar integrações.")
        
    config = db.query(UnifiConfig).first()
    if not config:
        return UnifiConfigSchema()
        
    return UnifiConfigSchema(
        api_url=config.api_url,
        username=config.username,
        password=config.password,
        site_id=config.site_id,
        is_active=config.is_active
    )

@router_unifi.post("")
def save_unifi_config(
    payload: UnifiConfigSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores podem alterar integrações.")
        
    config = db.query(UnifiConfig).first()
    if not config:
        config = UnifiConfig()
        db.add(config)
        
    config.api_url = payload.api_url
    config.username = payload.username
    config.password = payload.password
    config.site_id = payload.site_id
    config.is_active = payload.is_active
    
    db.commit()
    return {"message": "Configurações do UniFi Controller salvas com sucesso!"}

@router_unifi.get("/devices")
def fetch_unifi_devices(current_user: User = Depends(get_current_user)):
    # Any authenticated user (including the TV unlocked user) can view metrics
    devices = UnifiService.get_devices()
    return {"devices": devices}


@router_unifi.get("/test")
def test_unifi_connection(
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Acesso negado.")
        
    if UnifiService.authenticate():
        return {"success": True, "message": "Conexão com a controladora UniFi estabelecida com sucesso!"}
    else:
        raise HTTPException(status_code=401, detail="Falha ao autenticar. Verifique a URL, Usuário ou Senha.")
