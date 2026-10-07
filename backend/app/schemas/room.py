"""
Schemas de Apartamento / UH (Unidade Habitacional).
"""
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class RoomCreate(BaseModel):
    number: str
    name: str | None = None
    phone: str | None = None
    is_active: bool = True


class RoomUpdate(BaseModel):
    number: str | None = None
    name: str | None = None
    phone: str | None = None
    is_active: bool | None = None


class RoomResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    number: str
    name: str
    floor: str | None = None
    phone: str | None = None
    is_active: bool
    asset_count: int = 0
    open_tickets_count: int = 0
    created_at: datetime
