"""Schemas de User."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class UserBase(BaseModel):
    display_name: str
    email: str | None = None
    is_room: bool = False
    room_number: str | None = None
    phone: str | None = None


class UserCreate(UserBase):
    ad_username: str | None = None
    department_id: int | None = None
    manager_id: int | None = None
    role: str = "user"
    password: str | None = None  # Apenas para admin root


class UserUpdate(BaseModel):
    display_name: str | None = None
    email: str | None = None
    phone: str | None = None
    department_id: int | None = None
    manager_id: int | None = None
    role: str | None = None
    is_active: bool | None = None


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ad_username: str | None = None
    role: str
    is_active: bool
    department_id: int | None = None
    manager_id: int | None = None
    created_at: datetime


class UserSimple(BaseModel):
    """Versão enxuta para listas e selects."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    is_room: bool
    room_number: str | None = None
    department_id: int | None = None
