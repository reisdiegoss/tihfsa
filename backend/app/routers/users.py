"""
Router Users — CRUD de usuários e apartamentos.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import get_current_user, require_admin, require_technician
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserSimple

router = APIRouter(prefix="/api/v1/users", tags=["Usuários"])


from app.models.department import Department

def _format_user_response(user: User) -> dict:
    role_str = user.role.value if isinstance(user.role, UserRole) else str(user.role)
    user_roles = user.roles if (user.roles and isinstance(user.roles, list)) else [role_str]
    return {
        "id": user.id,
        "ad_username": user.ad_username,
        "display_name": user.display_name,
        "email": user.email,
        "is_room": user.is_room,
        "room_number": user.room_number,
        "phone": user.phone,
        "role": role_str,
        "roles": user_roles,
        "is_active": user.is_active,
        "department_id": user.department_id,
        "department_name": user.department.name if user.department else None,
        "manager_id": user.manager_id,
        "managed_department_ids": [d.id for d in user.managed_departments] if user.managed_departments else [],
        "managed_department_names": [d.name for d in user.managed_departments] if user.managed_departments else [],
        "created_at": user.created_at,
    }


@router.get("/", response_model=list[UserResponse])
def list_users(
    is_room: bool | None = Query(None, description="Filtrar: True=Apartamentos, False=Pessoas"),
    department_id: int | None = None,
    is_active: bool = True,
    search: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lista usuários com filtros opcionais."""
    query = db.query(User).filter(User.is_active == is_active)
    if is_room is not None:
        query = query.filter(User.is_room == is_room)
    if department_id:
        query = query.filter(User.department_id == department_id)
    if search:
        query = query.filter(User.display_name.ilike(f"%{search}%"))
    
    users = query.order_by(User.display_name).all()
    return [_format_user_response(u) for u in users]


@router.get("/simple", response_model=list[UserSimple])
def list_users_simple(
    is_room: bool | None = None,
    department_id: int | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lista enxuta para selects e dropdowns."""
    query = db.query(User).filter(User.is_active == True)  # noqa: E712
    if is_room is not None:
        query = query.filter(User.is_room == is_room)
    if department_id:
        query = query.filter(User.department_id == department_id)
    if search:
        query = query.filter(User.display_name.ilike(f"%{search}%"))
    return query.order_by(User.display_name).all()


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Detalhe de um usuário."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return _format_user_response(user)


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Cria um usuário manualmente (fora do AD)."""
    from app.auth.jwt_handler import hash_password

    user = User(
        ad_username=data.ad_username,
        display_name=data.display_name,
        email=data.email,
        is_room=data.is_room,
        room_number=data.room_number,
        phone=data.phone,
        department_id=data.department_id,
        manager_id=data.manager_id,
        role=UserRole(data.role) if data.role else UserRole.USER,
    )
    if data.password:
        user.password_hash = hash_password(data.password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return _format_user_response(user)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Atualiza dados de um usuário e suas atribuições de múltiplos papéis e gerente de setor."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    update_data = data.model_dump(exclude_unset=True)
    
    if "managed_department_ids" in update_data:
        dept_ids = update_data.pop("managed_department_ids") or []
        depts = db.query(Department).filter(Department.id.in_(dept_ids)).all()
        user.managed_departments = depts

    if "roles" in update_data:
        roles_list = update_data.pop("roles") or ["user"]
        user.roles = roles_list
        if "admin" in roles_list:
            user.role = UserRole.ADMIN
        elif "technician" in roles_list or "tecnico" in roles_list:
            user.role = UserRole.TECHNICIAN
        elif "manager" in roles_list or "gerente" in roles_list:
            user.role = UserRole.MANAGER
        else:
            user.role = UserRole.USER

    if "role" in update_data and update_data["role"]:
        user.role = UserRole(update_data["role"])

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return _format_user_response(user)


@router.get("/{user_id}/subordinates", response_model=list[UserSimple])
def list_subordinates(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lista subordinados diretos de um gestor."""
    return db.query(User).filter(User.manager_id == user_id, User.is_active == True).all()  # noqa: E712


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Exclui ou desativa um usuário/pessoa."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    user.is_active = False
    db.commit()
