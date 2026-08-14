"""
Router NetworkMaps — CRUD de mapas de topologia de rede com enriquececimento Zabbix/ICMP em tempo real.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import get_current_user, require_technician
from app.models.user import User
from app.models.network_map import NetworkMap
from app.schemas.network_map import NetworkMapCreate, NetworkMapUpdate, NetworkMapResponse

router = APIRouter(prefix="/api/v1/network-maps", tags=["Network Maps"])


def _format_map_response(net_map: NetworkMap) -> dict:
    return {
        "id": net_map.id,
        "name": net_map.name,
        "description": net_map.description,
        "is_default": net_map.is_default,
        "location_id": net_map.location_id,
        "location_name": net_map.location.name if net_map.location else None,
        "nodes_data": net_map.nodes_data or [],
        "edges_data": net_map.edges_data or [],
        "zoom_level": getattr(net_map, "zoom_level", 1.0) or 1.0,
        "pan_x": getattr(net_map, "pan_x", 0) or 0,
        "pan_y": getattr(net_map, "pan_y", 0) or 0,
        "created_at": net_map.created_at,
        "updated_at": net_map.updated_at,
    }


@router.get("", response_model=list[NetworkMapResponse])
@router.get("/", response_model=list[NetworkMapResponse])
def list_network_maps(
    location_id: int | None = None,
    db: Session = Depends(get_db),
):
    """Lista todos os mapas de topologia de rede cadastrados."""
    query = db.query(NetworkMap)
    if location_id:
        query = query.filter(NetworkMap.location_id == location_id)

    maps = query.order_by(NetworkMap.updated_at.desc()).all()
    return [_format_map_response(m) for m in maps]


@router.get("/{map_id}")
def get_network_map_enriched(
    map_id: int,
    db: Session = Depends(get_db),
):
    """Retorna um mapa de topologia enriquecido com o status Zabbix/ICMP em tempo real de cada nó."""
    net_map = db.query(NetworkMap).filter(NetworkMap.id == map_id).first()
    if not net_map:
        raise HTTPException(status_code=404, detail="Mapa de topologia não encontrado")

    resp = _format_map_response(net_map)

    # Buscar status de ativos vinculados para enriquecer os nós do mapa
    try:
        from app.models.asset import Asset
        from app.routers.assets import _format_asset_response, _enrich_assets_with_zabbix_status

        asset_ids = list({
            int(node["asset_id"]) for node in resp["nodes_data"]
            if node.get("asset_id") and str(node.get("asset_id")).isdigit()
        })

        if asset_ids:
            assets = db.query(Asset).filter(Asset.id.in_(asset_ids)).all()
            formatted_assets = [_format_asset_response(a) for a in assets]
            enriched_assets = _enrich_assets_with_zabbix_status(formatted_assets, db=db)
            assets_by_id = {a["id"]: a for a in enriched_assets}

            # Acoplar o status em tempo real a cada nó do mapa
            for node in resp["nodes_data"]:
                a_id = node.get("asset_id")
                if a_id and str(a_id).isdigit() and int(a_id) in assets_by_id:
                    matched = assets_by_id[int(a_id)]
                    node["icmp_status"] = matched.get("icmp_status")
                    node["zabbix_status"] = matched.get("zabbix_status")
                    node["zabbix_alert_title"] = matched.get("zabbix_alert_title")
                    node["monitoring_protocol"] = matched.get("monitoring_protocol")
                    node["ip_address"] = matched.get("ip_address")
    except Exception as e:
        print(f"[NetworkMap Enrich Error] {e}")

    return resp


@router.post("", response_model=NetworkMapResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=NetworkMapResponse, status_code=status.HTTP_201_CREATED)
def create_network_map(
    map_data: NetworkMapCreate,
    db: Session = Depends(get_db),
):
    """Cria um novo mapa de topologia de rede."""
    net_map = NetworkMap(
        name=map_data.name,
        description=map_data.description,
        is_default=map_data.is_default,
        location_id=map_data.location_id,
        nodes_data=map_data.nodes_data,
        edges_data=map_data.edges_data,
        zoom_level=map_data.zoom_level if map_data.zoom_level is not None else 1.0,
        pan_x=map_data.pan_x if map_data.pan_x is not None else 0,
        pan_y=map_data.pan_y if map_data.pan_y is not None else 0,
    )
    db.add(net_map)
    db.commit()
    db.refresh(net_map)
    return _format_map_response(net_map)


@router.put("/{map_id}", response_model=NetworkMapResponse)
def update_network_map(
    map_id: int,
    map_data: NetworkMapUpdate,
    db: Session = Depends(get_db),
):
    """Atualiza um mapa de topologia (posições dos nós, conexões, zoom e pan)."""
    net_map = db.query(NetworkMap).filter(NetworkMap.id == map_id).first()
    if not net_map:
        raise HTTPException(status_code=404, detail="Mapa de topologia não encontrado")

    if map_data.name is not None:
        net_map.name = map_data.name
    if map_data.description is not None:
        net_map.description = map_data.description
    if map_data.is_default is not None:
        net_map.is_default = map_data.is_default
    if map_data.location_id is not None:
        net_map.location_id = map_data.location_id
    if map_data.nodes_data is not None:
        net_map.nodes_data = map_data.nodes_data
    if map_data.edges_data is not None:
        net_map.edges_data = map_data.edges_data
    if map_data.zoom_level is not None:
        net_map.zoom_level = map_data.zoom_level
    if map_data.pan_x is not None:
        net_map.pan_x = map_data.pan_x
    if map_data.pan_y is not None:
        net_map.pan_y = map_data.pan_y

    db.commit()
    db.refresh(net_map)
    return _format_map_response(net_map)


@router.delete("/{map_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_network_map(
    map_id: int,
    db: Session = Depends(get_db),
):
    """Exclui um mapa de topologia de rede."""
    net_map = db.query(NetworkMap).filter(NetworkMap.id == map_id).first()
    if not net_map:
        raise HTTPException(status_code=404, detail="Mapa não encontrado")

    db.delete(net_map)
    db.commit()
    return None
