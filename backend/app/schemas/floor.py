"""
Schemas de Andar / Pavimento (Floor).
"""
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class FloorCreate(BaseModel):
    name: str
    number: int | None = None
    description: str | None = None
    is_active: bool = True


class FloorUpdate(BaseModel):
    name: str | None = None
    number: int | None = None
    description: str | None = None
    is_active: bool | None = None


class FloorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    number: int | None = None
    description: str | None = None
    is_active: bool
    rooms_count: int = 0
    locations_count: int = 0
    created_at: datetime
