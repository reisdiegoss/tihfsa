"""
Auth Dependencies — injeção de dependência para proteger rotas.

get_current_user: extrai usuário do JWT no header Authorization.
require_admin/require_technician: validam roles específicos.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.jwt_handler import decode_token
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def get_optional_user(
    token: str | None = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
) -> User | None:
    """Extrai o usuário logado se o token estiver presente, senão retorna None sem erro 401."""
    if not token:
        return None
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    try:
        user = db.query(User).filter(User.id == int(user_id)).first()
        return user if (user and user.is_active) else None
    except Exception:
        return None



def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Extrai e valida o usuário logado a partir do JWT."""
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado ou inativo")

    return user


def _get_user_roles(user: User) -> set[str]:
    roles = set()
    if user.role:
        val = user.role.value if hasattr(user.role, "value") else str(user.role)
        roles.add(val.lower())
    if user.roles and isinstance(user.roles, list):
        for r in user.roles:
            if isinstance(r, str):
                roles.add(r.lower())
    # Normalizações para compatibilidade
    if "tecnico" in roles:
        roles.add("technician")
    if "gerente" in roles:
        roles.add("manager")
    return roles


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Permite usuários com role ADMIN (via role ou roles)."""
    roles = _get_user_roles(current_user)
    if "admin" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a administradores")
    return current_user


def require_technician(current_user: User = Depends(get_current_user)) -> User:
    """Permite ADMIN ou TECHNICIAN (via role ou roles)."""
    roles = _get_user_roles(current_user)
    if not (roles & {"admin", "technician"}):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a técnicos")
    return current_user


def require_manager(current_user: User = Depends(get_current_user)) -> User:
    """Permite ADMIN ou MANAGER (via role ou roles)."""
    roles = _get_user_roles(current_user)
    if not (roles & {"admin", "manager"}):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a gestores")
    return current_user


def require_staff(current_user: User = Depends(get_current_user)) -> User:
    """Permite ADMIN, TECHNICIAN ou MANAGER (via role ou roles)."""
    roles = _get_user_roles(current_user)
    if not (roles & {"admin", "technician", "manager"}):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito à equipe interna")
    return current_user


def check_user_module_access(user: User, module: str) -> bool:
    """Verifica se o usuário possui acesso liberado a um módulo específico."""
    roles = _get_user_roles(user)
    if "admin" in roles:
        return True
    if user.allowed_modules is None:
        if "technician" in roles:
            return module in {"tickets", "assets", "monitoring", "topology", "qrcodes", "reports"}
        return module == "tickets"
    return module in (user.allowed_modules or [])


def require_module(module: str):
    """Dependência para verificar se o usuário ou técnico possui permissão para o módulo."""
    def _dependency(current_user: User = Depends(get_current_user)) -> User:
        if not check_user_module_access(current_user, module):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Seu perfil não possui permissão de acesso ao módulo '{module}'. Solicite ao administrador.",
            )
        return current_user
    return _dependency
