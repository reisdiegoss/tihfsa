"""
Schemas Pydantic para NetworkMap.
"""
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class NetworkMapBase(BaseModel):
    name: str
    description: str | None = None
    is_default: bool = False
    location_id: int | None = None
    nodes_data: list[dict] = []
    edges_data: list[dict] = []
    zoom_level: float | None = 1.0
    pan_x: int | None = 0
    pan_y: int | None = 0


class NetworkMapCreate(NetworkMapBase):
    pass


class NetworkMapUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_default: bool | None = None
    location_id: int | None = None
    nodes_data: list[dict] | None = None
    edges_data: list[dict] | None = None
    zoom_level: float | None = None
    pan_x: int | None = None
    pan_y: int | None = None


class NetworkMapResponse(NetworkMapBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    location_name: str | None = None
    created_at: datetime
    updated_at: datetime
