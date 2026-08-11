"""
Router Auth — login via LDAP ou admin root.

- POST /login: Autentica via LDAP (AD) ou credenciais locais (admin root).
- GET /me: Retorna dados do usuário logado.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.auth.jwt_handler import create_access_token, verify_password, hash_password
from app.auth.dependencies import get_current_user
from app.models.user import User, UserRole
from app.schemas.auth import TokenResponse
from app.schemas.user import UserResponse

router = APIRouter(prefix="/api/v1/auth", tags=["Autenticação"])


def _authenticate_ldap(username: str, password: str) -> bool:
    """Tenta autenticar via LDAP/AD. Retorna True se sucesso."""
    try:
        from ldap3 import Server, Connection, ALL
        server = Server(settings.ldap_host, port=settings.ldap_port, get_info=ALL)
        # Tenta bind com as credenciais do usuário
        user_dn = f"{settings.ldap_bind_user.split(chr(92))[0]}\\{username}"
        conn = Connection(server, user=user_dn, password=password, auto_bind=True)
        conn.unbind()
        return True
    except Exception:
        return False


@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Login: tenta admin root primeiro, depois LDAP.
    """
    # 1. Verificar admin root local
    if form_data.username == settings.admin_username:
        admin = db.query(User).filter(
            User.ad_username == settings.admin_username,
            User.role == UserRole.ADMIN,
        ).first()

        if admin and admin.password_hash and verify_password(form_data.password, admin.password_hash):
            token = create_access_token({"sub": str(admin.id), "role": admin.role.value})
            return TokenResponse(
                access_token=token,
                user_id=admin.id,
                display_name=admin.display_name,
                role=admin.role.value,
            )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas")

    # 2. Autenticar via LDAP
    user = db.query(User).filter(User.ad_username == form_data.username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado no sistema")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário inativo")

    if not _authenticate_ldap(form_data.username, form_data.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas no AD")

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        display_name=user.display_name,
        role=user.role.value,
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Retorna os dados do usuário logado."""
    return current_user
