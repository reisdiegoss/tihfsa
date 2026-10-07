"""
Router Rooms — Gestão de Apartamentos / UHs (Unidades Habitacionais).

Permite aos administradores e técnicos cadastrar, editar, desativar
e auditar os apartamentos do hotel que recebem inventário de TI (TV, AP UniFi, SKY, Ramais)
e abertura de chamados.
"""
import re
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.auth.dependencies import get_current_user, require_technician
from app.models.user import User, UserRole
from app.models.asset import Asset
from app.models.ticket import Ticket, TicketStatus
from app.schemas.room import RoomCreate, RoomUpdate, RoomResponse

router = APIRouter(prefix="/api/v1/rooms", tags=["Apartamentos / UHs"])


def _extract_room_number(user: User) -> str:
    if user.room_number and user.room_number.strip():
        return user.room_number.strip()
    nums = re.findall(r"\d+", user.display_name or "")
    if nums:
        return nums[0]
    return user.display_name or str(user.id)


def _compute_floor(num_str: str) -> str:
    if not num_str:
        return "Geral"
    first_char = num_str[0]
    if first_char.isdigit():
        if len(num_str) >= 3:
            return f"{first_char}º Andar"
        elif len(num_str) == 2 and first_char == "0":
            return "Térreo"
        return f"{first_char}º Andar"
    return "Outros"


@router.get("/", response_model=list[RoomResponse])
def list_rooms(
    active_only: bool = False,
    search: str | None = Query(None),
    floor: str | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lista todas as UHs cadastradas no hotel com contagem de ativos e chamados abertos."""
    query = db.query(User).filter(User.is_room == True)

    if active_only:
        query = query.filter(User.is_active == True)

    rooms = query.all()

    # Ordenação numérica
    def _sort_key(u: User):
        num_str = _extract_room_number(u)
        nums = re.findall(r"\d+", num_str)
        return int(nums[0]) if nums else 99999

    sorted_rooms = sorted(rooms, key=_sort_key)

    res = []
    for r in sorted_rooms:
        num_str = _extract_room_number(r)
        floor_label = _compute_floor(num_str)

        # Filtro de busca
        if search and search.strip():
            term = search.strip().lower()
            if term not in num_str.lower() and term not in (r.display_name or "").lower():
                continue

        # Filtro de andar
        if floor and floor.strip() and floor != "all":
            if floor.lower() not in floor_label.lower():
                continue

        asset_cnt = db.query(func.count(Asset.id)).filter(
            Asset.assigned_user_id == r.id,
            Asset.is_active == True
        ).scalar() or 0

        open_tickets = db.query(func.count(Ticket.id)).filter(
            Ticket.requester_id == r.id,
            Ticket.status.in_([TicketStatus.NEW, TicketStatus.IN_PROGRESS, TicketStatus.PENDING_VALIDATION])
        ).scalar() or 0

        res.append(RoomResponse(
            id=r.id,
            number=num_str,
            name=r.display_name,
            floor=floor_label,
            phone=r.phone,
            is_active=r.is_active,
            asset_count=asset_cnt,
            open_tickets_count=open_tickets,
            created_at=r.created_at,
        ))

    return res


@router.post("/", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
def create_room(
    data: RoomCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Cadastra um novo Apartamento / UH no hotel."""
    clean_number = data.number.strip()
    if not clean_number:
        raise HTTPException(status_code=400, detail="O número do apartamento é obrigatório.")

    # Verificar se já existe
    existing = db.query(User).filter(
        User.is_room == True,
        (User.room_number == clean_number) | (User.display_name.ilike(f"%{clean_number}%"))
    ).first()

    if existing:
        if not existing.is_active:
            # Reativa se estava inativo
            existing.is_active = True
            existing.room_number = clean_number
            if data.name:
                existing.display_name = data.name.strip()
            if data.phone:
                existing.phone = data.phone.strip()
            db.commit()
            db.refresh(existing)
            num_str = _extract_room_number(existing)
            return RoomResponse(
                id=existing.id,
                number=num_str,
                name=existing.display_name,
                floor=_compute_floor(num_str),
                phone=existing.phone,
                is_active=existing.is_active,
                asset_count=0,
                open_tickets_count=0,
                created_at=existing.created_at,
            )
        raise HTTPException(status_code=400, detail=f"O apartamento / UH '{clean_number}' já está cadastrado no sistema.")

    display_name = data.name.strip() if data.name and data.name.strip() else f"Apt {clean_number}"

    new_room = User(
        display_name=display_name,
        room_number=clean_number,
        phone=data.phone.strip() if data.phone else None,
        is_room=True,
        is_active=data.is_active,
        role=UserRole.USER,
        roles=["user"],
    )
    db.add(new_room)
    db.commit()
    db.refresh(new_room)

    return RoomResponse(
        id=new_room.id,
        number=clean_number,
        name=new_room.display_name,
        floor=_compute_floor(clean_number),
        phone=new_room.phone,
        is_active=new_room.is_active,
        asset_count=0,
        open_tickets_count=0,
        created_at=new_room.created_at,
    )


@router.patch("/{room_id}", response_model=RoomResponse)
def update_room(
    room_id: int,
    data: RoomUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Atualiza dados do Apartamento / UH."""
    room = db.query(User).filter(User.id == room_id, User.is_room == True).first()
    if not room:
        raise HTTPException(status_code=404, detail="Apartamento / UH não encontrado.")

    if data.number is not None and data.number.strip():
        clean_num = data.number.strip()
        # Verificar duplicidade com outro quarto
        duplicate = db.query(User).filter(
            User.is_room == True,
            User.id != room_id,
            (User.room_number == clean_num) | (User.display_name.ilike(f"Apt {clean_num}"))
        ).first()
        if duplicate:
            raise HTTPException(status_code=400, detail=f"Já existe outro quarto com o número '{clean_num}'.")
        room.room_number = clean_num

    if data.name is not None and data.name.strip():
        room.display_name = data.name.strip()
    elif data.number is not None and data.number.strip():
        room.display_name = f"Apt {data.number.strip()}"

    if data.phone is not None:
        room.phone = data.phone.strip() if data.phone.strip() else None

    if data.is_active is not None:
        room.is_active = data.is_active

    db.commit()
    db.refresh(room)

    num_str = _extract_room_number(room)
    asset_cnt = db.query(func.count(Asset.id)).filter(
        Asset.assigned_user_id == room.id,
        Asset.is_active == True
    ).scalar() or 0

    open_tickets = db.query(func.count(Ticket.id)).filter(
        Ticket.requester_id == room.id,
        Ticket.status.in_([TicketStatus.NEW, TicketStatus.IN_PROGRESS, TicketStatus.PENDING_VALIDATION])
    ).scalar() or 0

    return RoomResponse(
        id=room.id,
        number=num_str,
        name=room.display_name,
        floor=_compute_floor(num_str),
        phone=room.phone,
        is_active=room.is_active,
        asset_count=asset_cnt,
        open_tickets_count=open_tickets,
        created_at=room.created_at,
    )


@router.patch("/{room_id}/toggle-active", response_model=RoomResponse)
def toggle_room_active(
    room_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Ativa ou desativa a UH com 1 clique."""
    room = db.query(User).filter(User.id == room_id, User.is_room == True).first()
    if not room:
        raise HTTPException(status_code=404, detail="Apartamento / UH não encontrado.")

    room.is_active = not bool(room.is_active)
    db.commit()
    db.refresh(room)

    num_str = _extract_room_number(room)
    asset_cnt = db.query(func.count(Asset.id)).filter(
        Asset.assigned_user_id == room.id,
        Asset.is_active == True
    ).scalar() or 0

    open_tickets = db.query(func.count(Ticket.id)).filter(
        Ticket.requester_id == room.id,
        Ticket.status.in_([TicketStatus.NEW, TicketStatus.IN_PROGRESS, TicketStatus.PENDING_VALIDATION])
    ).scalar() or 0

    return RoomResponse(
        id=room.id,
        number=num_str,
        name=room.display_name,
        floor=_compute_floor(num_str),
        phone=room.phone,
        is_active=room.is_active,
        asset_count=asset_cnt,
        open_tickets_count=open_tickets,
        created_at=room.created_at,
    )


@router.delete("/{room_id}")
def delete_room(
    room_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Desativa ou remove o apartamento."""
    room = db.query(User).filter(User.id == room_id, User.is_room == True).first()
    if not room:
        raise HTTPException(status_code=404, detail="Apartamento / UH não encontrado.")

    asset_cnt = db.query(func.count(Asset.id)).filter(Asset.assigned_user_id == room.id).scalar() or 0
    ticket_cnt = db.query(func.count(Ticket.id)).filter(Ticket.requester_id == room.id).scalar() or 0

    if asset_cnt > 0 or ticket_cnt > 0:
        room.is_active = False
        db.commit()
        return {
            "status": "deactivated",
            "message": f"Apartamento '{room.display_name}' desativado com sucesso (possui {asset_cnt} ativo(s) e {ticket_cnt} chamado(s) associados)."
        }

    db.delete(room)
    db.commit()
    return {"status": "deleted", "message": f"Apartamento '{room.display_name}' excluído com sucesso."}
