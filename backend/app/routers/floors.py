"""
Router Floors — Gestão de Andares e Pavimentos do Hotel.

Permite listar, cadastrar, editar, desativar e auditar os andares do hotel
(ex: Subsolo, Térreo, 1º ao 7º Andar, Rooftop), utilizados na alocação de UHs,
localizações físicas e CMDB.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.auth.dependencies import get_current_user, require_technician
from app.models.user import User
from app.models.floor import Floor
from app.models.location import Location
from app.schemas.floor import FloorCreate, FloorUpdate, FloorResponse

router = APIRouter(prefix="/api/v1/floors", tags=["Andares & Pavimentos"])


@router.get("/", response_model=list[FloorResponse])
def list_floors(
    active_only: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lista todos os andares cadastrados com contagem de UHs e locais associados."""
    query = db.query(Floor)
    if active_only:
        query = query.filter(Floor.is_active == True)

    # Ordena numericamente se houver número, senão por nome
    floors = query.order_by(Floor.number.asc().nulls_last(), Floor.name.asc()).all()

    # Agrupa contagem de UHs por floor
    room_counts = (
        db.query(User.floor, func.count(User.id))
        .filter(User.is_room == True)
        .group_by(User.floor)
        .all()
    )
    room_count_map = {r[0]: r[1] for r in room_counts if r[0]}

    # Agrupa contagem de localizações físicas por floor
    loc_counts = (
        db.query(Location.floor, func.count(Location.id))
        .group_by(Location.floor)
        .all()
    )
    loc_count_map = {l[0]: l[1] for l in loc_counts if l[0]}

    res = []
    for f in floors:
        res.append(
            FloorResponse(
                id=f.id,
                name=f.name,
                number=f.number,
                description=f.description,
                is_active=f.is_active,
                rooms_count=room_count_map.get(f.name, 0),
                locations_count=loc_count_map.get(f.name, 0),
                created_at=f.created_at,
            )
        )

    return res


@router.post("/", response_model=FloorResponse, status_code=status.HTTP_201_CREATED)
def create_floor(
    data: FloorCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Cadastra um novo andar/pavimento no hotel (apenas técnicos e admins)."""
    name = data.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O nome do andar é obrigatório.",
        )

    existing = db.query(Floor).filter(func.lower(Floor.name) == name.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"O andar '{name}' já está cadastrado.",
        )

    new_floor = Floor(
        name=name,
        number=data.number,
        description=data.description.strip() if data.description else None,
        is_active=data.is_active,
    )
    db.add(new_floor)
    db.commit()
    db.refresh(new_floor)

    return FloorResponse(
        id=new_floor.id,
        name=new_floor.name,
        number=new_floor.number,
        description=new_floor.description,
        is_active=new_floor.is_active,
        rooms_count=0,
        locations_count=0,
        created_at=new_floor.created_at,
    )


@router.patch("/{floor_id}", response_model=FloorResponse)
def update_floor(
    floor_id: int,
    data: FloorUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Atualiza as informações de um andar cadastrado."""
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if not floor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Andar não encontrado.",
        )

    if data.name is not None:
        new_name = data.name.strip()
        if not new_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O nome do andar não pode ser vazio.",
            )
        # Verifica conflito de nome
        existing = (
            db.query(Floor)
            .filter(func.lower(Floor.name) == new_name.lower(), Floor.id != floor_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Já existe outro andar cadastrado com o nome '{new_name}'.",
            )
        
        # Se renomeou o andar, atualiza UHs e Locais vinculados ao nome antigo
        old_name = floor.name
        if old_name != new_name:
            db.query(User).filter(User.is_room == True, User.floor == old_name).update({"floor": new_name})
            db.query(Location).filter(Location.floor == old_name).update({"floor": new_name})

        floor.name = new_name

    if data.number is not None:
        floor.number = data.number

    if data.description is not None:
        floor.description = data.description.strip() if data.description else None

    if data.is_active is not None:
        floor.is_active = data.is_active

    db.commit()
    db.refresh(floor)

    rooms_count = db.query(User).filter(User.is_room == True, User.floor == floor.name).count()
    locations_count = db.query(Location).filter(Location.floor == floor.name).count()

    return FloorResponse(
        id=floor.id,
        name=floor.name,
        number=floor.number,
        description=floor.description,
        is_active=floor.is_active,
        rooms_count=rooms_count,
        locations_count=locations_count,
        created_at=floor.created_at,
    )


@router.patch("/{floor_id}/toggle-active", response_model=FloorResponse)
def toggle_floor_active(
    floor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Alterna rapidamente o status ativo/inativo do andar com 1 clique."""
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if not floor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Andar não encontrado.",
        )

    floor.is_active = not floor.is_active
    db.commit()
    db.refresh(floor)

    rooms_count = db.query(User).filter(User.is_room == True, User.floor == floor.name).count()
    locations_count = db.query(Location).filter(Location.floor == floor.name).count()

    return FloorResponse(
        id=floor.id,
        name=floor.name,
        number=floor.number,
        description=floor.description,
        is_active=floor.is_active,
        rooms_count=rooms_count,
        locations_count=locations_count,
        created_at=floor.created_at,
    )


@router.delete("/{floor_id}")
def delete_floor(
    floor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Remove o andar ou desativa se houver UHs ou locais vinculados."""
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if not floor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Andar não encontrado.",
        )

    rooms_count = db.query(User).filter(User.is_room == True, User.floor == floor.name).count()
    locations_count = db.query(Location).filter(Location.floor == floor.name).count()

    if rooms_count > 0 or locations_count > 0:
        # Desativa com segurança em vez de remover
        floor.is_active = False
        db.commit()
        return {
            "message": f"Andar '{floor.name}' desativado com sucesso (possui {rooms_count} UHs e {locations_count} locais vinculados).",
            "deactivated": True,
        }

    db.delete(floor)
    db.commit()
    return {"message": f"Andar '{floor.name}' removido com sucesso.", "deleted": True}
