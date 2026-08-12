"""
Router Assets — CRUD de equipamentos (CMDB).
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import get_current_user, require_technician
from app.models.user import User
from app.models.asset import Asset
from app.schemas.asset import AssetCreate, AssetUpdate, AssetResponse

router = APIRouter(prefix="/api/v1/assets", tags=["Ativos (CMDB)"])


@router.get("/", response_model=list[AssetResponse])
def list_assets(
    type: str | None = None,
    subcategory_id: int | None = None,
    category_id: int | None = None,
    is_active: bool = True,
    search: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lista todos os ativos com filtros."""
    query = db.query(Asset).filter(Asset.is_active == is_active)
    if type:
        query = query.filter(Asset.type == type)
    if subcategory_id:
        query = query.filter(Asset.subcategory_id == subcategory_id)
    if category_id:
        query = query.filter(Asset.category_id == category_id)
    if search:
        query = query.filter(Asset.name.ilike(f"%{search}%"))
    return query.order_by(Asset.name).all()


@router.get("/user/{user_id}", response_model=list[AssetResponse])
def list_user_assets(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lista ativos de um usuário ou apartamento específico."""
    return (
        db.query(Asset)
        .filter(Asset.assigned_user_id == user_id, Asset.is_active == True)  # noqa: E712
        .order_by(Asset.type)
        .all()
    )


@router.get("/{asset_id}", response_model=AssetResponse)
def get_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Detalhe de um ativo."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")
    return asset


@router.post("/", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
def create_asset(
    data: AssetCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Cadastra um novo equipamento."""
    asset = Asset(**data.model_dump())
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.patch("/{asset_id}", response_model=AssetResponse)
def update_asset(
    asset_id: int,
    data: AssetUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Atualiza dados de um ativo."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(asset, field, value)

    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Soft delete: desativa o ativo."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")
    asset.is_active = False
    db.commit()


@router.get("/{asset_id}/zabbix-status")
def get_asset_zabbix_status(
    asset_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Integração com Zabbix: Consulta o status em tempo real do host associado a este ativo via IP."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")

    if not asset.ip_address:
        return {"status": "Sem IP", "message": "Ativo não possui IP configurado", "host_name": None, "problems": []}

    # Realizar o lookup no ZabbixService usando o IP
    from app.services.zabbix_service import ZabbixService
    return ZabbixService.get_host_status_by_ip(asset.ip_address)
@router.get("/zabbix/discover")
def discover_zabbix_hosts(
    db: Session = Depends(get_db),
    _: User = Depends(require_technician)
):
    """Busca todos os hosts no Zabbix e filtra removendo aqueles cujos IPs já estão no TIHFSA."""
    from app.services.zabbix_service import ZabbixService
    
    # 1. Obter IPs já cadastrados no CMDB
    existing_assets = db.query(Asset.ip_address).filter(
        Asset.ip_address.isnot(None),
        Asset.is_active == True # noqa: E712
    ).all()
    existing_ips = {asset[0] for asset in existing_assets if asset[0]}
    
    # 2. Obter todos os hosts do Zabbix
    zabbix_hosts = ZabbixService.get_hosts()
    
    # 3. Filtrar hosts "Órfãos" (IPs não existentes no CMDB)
    orphan_hosts = []
    
    for host in zabbix_hosts:
        interfaces = host.get("interfaces", [])
        host_ip = None
        # Pegar a primeira interface com IP válido
        for interface in interfaces:
            if interface.get("ip") and interface.get("ip") != "127.0.0.1":
                host_ip = interface.get("ip")
                break
                
        if host_ip and host_ip not in existing_ips:
            # Tentar inferir o tipo pelo nome
            inferred_type = "Outro"
            name_lower = host["name"].lower()
            if "switch" in name_lower or "sw" in name_lower:
                inferred_type = "Switch"
            elif "ap" in name_lower or "unifi" in name_lower or "wifi" in name_lower:
                inferred_type = "Access Point"
            elif "router" in name_lower or "roteador" in name_lower or "mikrotik" in name_lower:
                inferred_type = "Roteador"
            elif "pc" in name_lower or "desktop" in name_lower:
                inferred_type = "Desktop"
            elif "tv" in name_lower:
                inferred_type = "TV"
            elif "cam" in name_lower or "cftv" in name_lower:
                inferred_type = "Outro" # CFTV
                
            orphan_hosts.append({
                "zabbix_host_id": host["hostid"],
                "name": host["name"],
                "ip_address": host_ip,
                "inferred_type": inferred_type,
                "status": "Monitored" if str(host.get("status")) == "0" else "Unmonitored"
            })
            
    return {"total_orphans": len(orphan_hosts), "hosts": orphan_hosts}


@router.post("/zabbix/import")
def import_zabbix_hosts(
    hosts_to_import: list[AssetCreate],
    db: Session = Depends(get_db),
    _: User = Depends(require_technician)
):
    """Importa massivamente hosts do Zabbix como novos ativos."""
    imported_assets = []
    for host_data in hosts_to_import:
        # Dupla checagem: garantir que o IP ainda não existe (para prevenir race conditions)
        if host_data.ip_address:
            exists = db.query(Asset).filter(Asset.ip_address == host_data.ip_address).first()
            if exists:
                continue
                
        asset = Asset(**host_data.model_dump())
        asset.description = "Importado via Zabbix Auto-Discovery"
        db.add(asset)
        imported_assets.append(asset)
        
    if imported_assets:
        db.commit()
        
    return {"status": "success", "imported_count": len(imported_assets)}
