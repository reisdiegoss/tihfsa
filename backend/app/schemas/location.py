"""
Schemas de Location (Localizações).
"""
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class LocationCreate(BaseModel):
    name: str
    floor: str | None = None
    description: str | None = None


class LocationUpdate(BaseModel):
    name: str | None = None
    floor: str | None = None
    description: str | None = None
    is_active: bool | None = None


class LocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    floor: str | None = None
    description: str | None = None
    is_active: bool
    asset_count: int = 0
    created_at: datetime
