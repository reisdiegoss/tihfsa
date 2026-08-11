"""
JWT Handler — geração e validação de tokens.

- Access token: login normal (técnicos/admin)
- Validation token: uso único para gestor aprovar/rejeitar chamado
"""
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
import bcrypt

from app.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Gera JWT de acesso com expiração configurável."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.jwt_expiration_minutes)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_validation_token(ticket_id: int, manager_id: int, action: str) -> str:
    """
    Gera JWT de uso único para validação de chamado pelo gestor.
    Expira em 72h para dar tempo ao gestor responder.
    """
    expire = datetime.now(timezone.utc) + timedelta(hours=72)
    data = {
        "ticket_id": ticket_id,
        "manager_id": manager_id,
        "action": action,
        "exp": expire,
        "type": "validation",
    }
    return jwt.encode(data, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict | None:
    """Decodifica e valida um JWT. Retorna None se inválido/expirado."""
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
