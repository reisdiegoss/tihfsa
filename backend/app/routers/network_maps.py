"""
Router NetworkMaps — CRUD de mapas de topologia de rede com enriquececimento Zabbix/ICMP em tempo real.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import get_current_user, require_technician
from app.models.user import User
from app.models.network_map import NetworkMap
from app.schemas.network_map import NetworkMapCreate, NetworkMapUpdate, NetworkMapResponse, CarouselBatchUpdate, NetworkMapClone

router = APIRouter(prefix="/api/v1/network-maps", tags=["Network Maps"])


def _format_map_response(net_map: NetworkMap, has_alerts: bool = False, offline_count: int = 0) -> dict:
    return {
        "id": net_map.id,
        "name": net_map.name,
        "description": net_map.description,
        "is_default": net_map.is_default,
        "location_id": net_map.location_id,
        "location_name": net_map.location.name if net_map.location else None,
        "nodes_data": net_map.nodes_data or [],
        "edges_data": net_map.edges_data or [],
        "background_image_url": getattr(net_map, "background_image_url", None),
        "zoom_level": getattr(net_map, "zoom_level", 1.0) or 1.0,
        "pan_x": getattr(net_map, "pan_x", 0) or 0,
        "pan_y": getattr(net_map, "pan_y", 0) or 0,
        "in_carousel": getattr(net_map, "in_carousel", True) if getattr(net_map, "in_carousel", True) is not None else True,
        "carousel_order": getattr(net_map, "carousel_order", 0) or 0,
        "carousel_seconds": getattr(net_map, "carousel_seconds", 20) or 20,
        "has_alerts": has_alerts,
        "offline_count": offline_count,
        "created_at": net_map.created_at,
        "updated_at": net_map.updated_at,
    }


@router.get("", response_model=list[NetworkMapResponse])
@router.get("/", response_model=list[NetworkMapResponse])
def list_network_maps(
    location_id: int | None = None,
    db: Session = Depends(get_db),
):
    """Lista todos os mapas de topologia de rede cadastrados com status de alertas e telemetria para carrossel."""
    from app.models.asset import Asset
    from app.routers.assets import _enrich_assets_with_zabbix_status, _format_asset_response

    query = db.query(NetworkMap)
    if location_id:
        query = query.filter(NetworkMap.location_id == location_id)

    # Ordena por ordem do carrossel, e depois data de atualização
    maps = query.order_by(NetworkMap.carousel_order.asc(), NetworkMap.updated_at.desc()).all()

    # Coleta todos os IDs de ativos referenciados nos nós de todos os mapas
    all_asset_ids = set()
    for m in maps:
        for node in (m.nodes_data or []):
            a_id = node.get("asset_id")
            if a_id and str(a_id).isdigit():
                all_asset_ids.add(int(a_id))
            for cid in node.get("child_asset_ids", []):
                if str(cid).isdigit():
                    all_asset_ids.add(int(cid))

    assets_status = {}
    if all_asset_ids:
        try:
            assets = db.query(Asset).filter(Asset.id.in_(list(all_asset_ids))).all()
            formatted = [_format_asset_response(a) for a in assets]
            enriched = _enrich_assets_with_zabbix_status(formatted, db=db)
            for ea in enriched:
                is_offline = ea.get("icmp_status") == "offline" or ea.get("zabbix_status") in ("problem", "critical")
                assets_status[ea["id"]] = is_offline
        except Exception as e:
            print(f"[List Network Maps Enrich Error] {e}")

    result = []
    for m in maps:
        map_offline_count = 0
        for node in (m.nodes_data or []):
            # No fluxograma, apenas nós com alerta ativado (sound_alert_offline) contam como alerta crítico
            if not node.get("sound_alert_offline"):
                continue

            node_offline = False
            a_id = node.get("asset_id")
            if a_id and str(a_id).isdigit() and assets_status.get(int(a_id)):
                node_offline = True
            for cid in node.get("child_asset_ids", []):
                if str(cid).isdigit() and assets_status.get(int(cid)):
                    node_offline = True
            if node_offline:
                map_offline_count += 1

        has_alerts = map_offline_count > 0
        result.append(_format_map_response(m, has_alerts=has_alerts, offline_count=map_offline_count))

    return result


@router.put("/carousel/batch", response_model=list[NetworkMapResponse])
def update_carousel_batch(
    data: CarouselBatchUpdate,
    db: Session = Depends(get_db),
):
    """Atualiza as preferências do carrossel (ordem, tempo e participação) em lote."""
    for item in data.items:
        net_map = db.query(NetworkMap).filter(NetworkMap.id == item.id).first()
        if net_map:
            net_map.in_carousel = item.in_carousel
            net_map.carousel_order = item.carousel_order
            net_map.carousel_seconds = max(5, item.carousel_seconds)
    db.commit()
    return list_network_maps(db=db)


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

        asset_ids_set = {
            int(node["asset_id"]) for node in resp["nodes_data"]
            if node.get("asset_id") and str(node.get("asset_id")).isdigit()
        }
        for node in resp["nodes_data"]:
            for cid in node.get("child_asset_ids", []):
                if str(cid).isdigit():
                    asset_ids_set.add(int(cid))

        asset_ids = list(asset_ids_set)

        if asset_ids:
            assets = db.query(Asset).filter(Asset.id.in_(asset_ids)).all()
            formatted_assets = [_format_asset_response(a) for a in assets]
            enriched_assets = _enrich_assets_with_zabbix_status(formatted_assets, db=db)
            assets_by_id = {a["id"]: a for a in enriched_assets}
            resp["assets_data"] = enriched_assets

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
        in_carousel=map_data.in_carousel if map_data.in_carousel is not None else True,
        carousel_order=map_data.carousel_order if map_data.carousel_order is not None else 0,
        carousel_seconds=map_data.carousel_seconds if map_data.carousel_seconds is not None else 20,
        background_image_url=map_data.background_image_url,
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
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(net_map, "nodes_data")
    if map_data.edges_data is not None:
        net_map.edges_data = map_data.edges_data
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(net_map, "edges_data")
    if map_data.zoom_level is not None:
        net_map.zoom_level = map_data.zoom_level
    if map_data.pan_x is not None:
        net_map.pan_x = map_data.pan_x
    if map_data.pan_y is not None:
        net_map.pan_y = map_data.pan_y
    if map_data.in_carousel is not None:
        net_map.in_carousel = map_data.in_carousel
    if map_data.carousel_order is not None:
        net_map.carousel_order = map_data.carousel_order
    if map_data.carousel_seconds is not None:
        net_map.carousel_seconds = max(5, map_data.carousel_seconds)
    if map_data.background_image_url is not None:
        net_map.background_image_url = map_data.background_image_url

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


@router.post("/{map_id}/clone", response_model=NetworkMapResponse, status_code=status.HTTP_201_CREATED)
def clone_network_map(
    map_id: int,
    clone_data: NetworkMapClone,
    db: Session = Depends(get_db),
):
    """Clona/duplica um mapa de topologia existente preservando racks, switches, nós, conexões e enquadramento."""
    source_map = db.query(NetworkMap).filter(NetworkMap.id == map_id).first()
    if not source_map:
        raise HTTPException(status_code=404, detail="Mapa de origem não encontrado")

    import copy
    new_map = NetworkMap(
        name=clone_data.name.strip(),
        description=clone_data.description or source_map.description,
        is_default=False,
        location_id=source_map.location_id,
        nodes_data=copy.deepcopy(source_map.nodes_data or []),
        edges_data=copy.deepcopy(source_map.edges_data or []),
        zoom_level=source_map.zoom_level,
        pan_x=source_map.pan_x,
        pan_y=source_map.pan_y,
        in_carousel=source_map.in_carousel,
        carousel_order=(source_map.carousel_order or 0) + 1,
        carousel_seconds=source_map.carousel_seconds or 20,
        background_image_url=source_map.background_image_url,
    )
    db.add(new_map)
    db.commit()
    db.refresh(new_map)
    return _format_map_response(new_map)

