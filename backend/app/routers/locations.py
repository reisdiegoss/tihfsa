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
from app.models.asset import Asset
from app.schemas.location import LocationCreate, LocationUpdate, LocationResponse

router = APIRouter(prefix="/api/v1/locations", tags=["Localizações"])


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

    is_tech_or_admin = False
    if current_user:
        u_roles = current_user.roles if (current_user.roles and isinstance(current_user.roles, list)) else [current_user.role.value]
        is_tech_or_admin = any(r in ["technician", "admin"] for r in u_roles)

    if public_only or not is_tech_or_admin:
        query = query.filter(Location.is_public == True)

    if search and isinstance(search, str) and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (Location.name.ilike(term)) |
            (Location.floor.ilike(term)) |
            (Location.description.ilike(term))
        )

    locations = query.order_by(Location.name.asc()).all()

    # Contar ativos por localização
    res = []
    for loc in locations:
        asset_cnt = db.query(func.count(Asset.id)).filter(
            Asset.location_id == loc.id,
            Asset.is_active == True
        ).scalar() or 0

        res.append(LocationResponse(
            id=loc.id,
            name=loc.name,
            floor=loc.floor,
            description=loc.description,
            is_active=loc.is_active,
            is_public=getattr(loc, "is_public", True),
            asset_count=asset_cnt,
            created_at=loc.created_at
        ))

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

    loc = Location(
        name=data.name.strip(),
        floor=data.floor.strip() if data.floor else None,
        description=data.description.strip() if data.description else None,
        is_active=True,
        is_public=data.is_public if data.is_public is not None else True,
    )
    db.add(loc)
    db.commit()
    db.refresh(loc)

    return LocationResponse(
        id=loc.id,
        name=loc.name,
        floor=loc.floor,
        description=loc.description,
        is_active=loc.is_active,
        is_public=loc.is_public,
        asset_count=0,
        created_at=loc.created_at
    )


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

    return LocationResponse(
        id=loc.id,
        name=loc.name,
        floor=loc.floor,
        description=loc.description,
        is_active=loc.is_active,
        is_public=getattr(loc, "is_public", True),
        asset_count=asset_cnt,
        created_at=loc.created_at
    )


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
        is_public=getattr(loc, "is_public", True),
        asset_count=asset_cnt,
        created_at=loc.created_at
    )


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
