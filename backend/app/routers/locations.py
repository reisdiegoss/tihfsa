"""
Router Locations — gestão de localizações físicas (Lobby, UH 101, Racks TI, etc.).
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.auth.dependencies import get_current_user, get_optional_user, require_technician
from app.models.user import User
from app.models.location import Location
from app.models.department import Department
from app.models.asset import Asset
from app.schemas.location import LocationCreate, LocationUpdate, LocationResponse

router = APIRouter(prefix="/api/v1/locations", tags=["Localizações"])


def _format_location(loc: Location, asset_cnt: int = 0) -> LocationResponse:
    dept_ids = [d.id for d in loc.departments] if hasattr(loc, "departments") and loc.departments else []
    dept_names = [d.name for d in loc.departments] if hasattr(loc, "departments") and loc.departments else []
    return LocationResponse(
        id=loc.id,
        name=loc.name,
        floor=loc.floor,
        description=loc.description,
        is_active=loc.is_active,
        is_public=getattr(loc, "is_public", True),
        order_index=getattr(loc, "order_index", 0),
        asset_count=asset_cnt,
        department_ids=dept_ids,
        department_names=dept_names,
        created_at=loc.created_at,
    )


@router.get("/", response_model=list[LocationResponse])
def list_locations(
    active_only: bool = True,
    public_only: bool = False,
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """
    Lista todas as localizações com contagem de ativos cadastrados.
    - Se public_only=True ou se for usuário comum sem perfil tech/admin: retorna apenas locais públicos.
    - Se técnico/admin: retorna todos os locais (com indicação se é público ou interno).
    """
    query = db.query(Location)

    if active_only:
        query = query.filter(Location.is_active == True)

    if public_only:
        query = query.filter(Location.is_public == True)
    elif current_user:
        u_roles = current_user.roles if (current_user.roles and isinstance(current_user.roles, list)) else [current_user.role.value]
        is_tech_or_admin = any(r in ["technician", "admin"] for r in u_roles)
        if not is_tech_or_admin:
            query = query.filter(Location.is_public == True)

    if search and isinstance(search, str) and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (Location.name.ilike(term)) |
            (Location.floor.ilike(term)) |
            (Location.description.ilike(term))
        )

    locations = query.order_by(Location.order_index.asc(), Location.name.asc()).all()

    # Contar ativos por localização
    res = []
    for loc in locations:
        asset_cnt = db.query(func.count(Asset.id)).filter(
            Asset.location_id == loc.id,
            Asset.is_active == True
        ).scalar() or 0

        res.append(_format_location(loc, asset_cnt))

    return res


@router.post("/", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
def create_location(
    data: LocationCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Cria uma nova localização física (técnico/admin)."""
    # Verificar nome duplicado
    existing = db.query(Location).filter(Location.name.ilike(data.name.strip())).first()
    if existing:
        raise HTTPException(status_code=400, detail="Já existe uma localização cadastrada com este nome.")

    order_val = data.order_index
    if not order_val:
        max_order = db.query(func.max(Location.order_index)).scalar() or 0
        order_val = max_order + 1

    loc = Location(
        name=data.name.strip(),
        floor=data.floor.strip() if data.floor else None,
        description=data.description.strip() if data.description else None,
        is_active=True,
        is_public=data.is_public if data.is_public is not None else True,
        order_index=order_val,
    )
    if data.department_ids:
        depts = db.query(Department).filter(Department.id.in_(data.department_ids)).all()
        loc.departments = depts

    db.add(loc)
    db.commit()
    db.refresh(loc)

    return _format_location(loc, 0)


@router.get("/{location_id}", response_model=LocationResponse)
def get_location(
    location_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Detalhes de uma localização."""
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Localização não encontrada")

    asset_cnt = db.query(func.count(Asset.id)).filter(
        Asset.location_id == loc.id,
        Asset.is_active == True
    ).scalar() or 0

    return _format_location(loc, asset_cnt)


@router.patch("/{location_id}", response_model=LocationResponse)
def update_location(
    location_id: int,
    data: LocationUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Atualiza dados de uma localização."""
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Localização não encontrada")

    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"]:
        name_clean = update_data["name"].strip()
        existing = db.query(Location).filter(
            Location.name.ilike(name_clean),
            Location.id != location_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Já existe outra localização com este nome.")
        loc.name = name_clean

    if "floor" in update_data:
        loc.floor = update_data["floor"].strip() if update_data["floor"] else None
    if "description" in update_data:
        loc.description = update_data["description"].strip() if update_data["description"] else None
    if "is_active" in update_data and update_data["is_active"] is not None:
        loc.is_active = update_data["is_active"]
    if "is_public" in update_data and update_data["is_public"] is not None:
        loc.is_public = update_data["is_public"]
    if "order_index" in update_data and update_data["order_index"] is not None:
        loc.order_index = update_data["order_index"]
    if "department_ids" in update_data:
        dept_ids = update_data.pop("department_ids") or []
        depts = db.query(Department).filter(Department.id.in_(dept_ids)).all()
        loc.departments = depts

    db.commit()
    db.refresh(loc)

    asset_cnt = db.query(func.count(Asset.id)).filter(
        Asset.location_id == loc.id,
        Asset.is_active == True
    ).scalar() or 0

    return _format_location(loc, asset_cnt)


@router.patch("/{location_id}/move", response_model=list[LocationResponse])
def move_location_order(
    location_id: int,
    direction: str = Query(..., regex="^(up|down)$"),
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """
    Move a posição de ordenação de uma localização para cima ('up') ou para baixo ('down').
    Normaliza a sequência inteira de 1 a N e retorna a lista ordenada.
    """
    locs = db.query(Location).filter(Location.is_active == True).order_by(Location.order_index.asc(), Location.name.asc()).all()

    idx = None
    for i, item in enumerate(locs):
        if item.id == location_id:
            idx = i
            break

    if idx is None:
        raise HTTPException(status_code=404, detail="Localização não encontrada ou inativa.")

    if direction == "up" and idx > 0:
        locs[idx], locs[idx - 1] = locs[idx - 1], locs[idx]
    elif direction == "down" and idx < len(locs) - 1:
        locs[idx], locs[idx + 1] = locs[idx + 1], locs[idx]

    for i, item in enumerate(locs, start=1):
        item.order_index = i

    db.commit()

    res = []
    for l in locs:
        asset_cnt = db.query(func.count(Asset.id)).filter(
            Asset.location_id == l.id,
            Asset.is_active == True
        ).scalar() or 0
        res.append(LocationResponse(
            id=l.id,
            name=l.name,
            floor=l.floor,
            description=l.description,
            is_active=l.is_active,
            is_public=getattr(l, "is_public", True),
            order_index=getattr(l, "order_index", 0),
            asset_count=asset_cnt,
            created_at=l.created_at
        ))
    return res


@router.patch("/{location_id}/toggle-public", response_model=LocationResponse)
def toggle_location_public(
    location_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Alterna rapidamente o status de visibilidade pública do local com 1 clique."""
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Localização não encontrada")

    loc.is_public = not bool(getattr(loc, "is_public", True))
    db.commit()
    db.refresh(loc)

    asset_cnt = db.query(func.count(Asset.id)).filter(
        Asset.location_id == loc.id,
        Asset.is_active == True
    ).scalar() or 0

    return LocationResponse(
        id=loc.id,
        name=loc.name,
        floor=loc.floor,
        description=loc.description,
        is_active=loc.is_active,
        is_public=loc.is_public,
        order_index=getattr(loc, "order_index", 0),
        asset_count=asset_cnt,
        created_at=loc.created_at
    )


@router.delete("/{location_id}")
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Desativa ou exclui uma localização."""
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Localização não encontrada")

    asset_cnt = db.query(func.count(Asset.id)).filter(Asset.location_id == loc.id).scalar() or 0
    if asset_cnt > 0:
        loc.is_active = False
        db.commit()
        return {"status": "deactivated", "message": f"Localização '{loc.name}' desativada pois possui {asset_cnt} ativo(s) vinculado(s)."}
    else:
        db.delete(loc)
        db.commit()
        return {"status": "deleted", "message": f"Localização '{loc.name}' excluída com sucesso."}
