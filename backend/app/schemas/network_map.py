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
    background_image_url: str | None = None
    nodes_data: list[dict] = []
    edges_data: list[dict] = []
    zoom_level: float | None = 1.0
    pan_x: int | None = 0
    pan_y: int | None = 0
    in_carousel: bool = True
    carousel_order: int = 0
    carousel_seconds: int = 20


class NetworkMapCreate(NetworkMapBase):
    pass


class NetworkMapUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_default: bool | None = None
    location_id: int | None = None
    background_image_url: str | None = None
    nodes_data: list[dict] | None = None
    edges_data: list[dict] | None = None
    zoom_level: float | None = None
    pan_x: int | None = None
    pan_y: int | None = None
    in_carousel: bool | None = None
    carousel_order: int | None = None
    carousel_seconds: int | None = None


class NetworkMapResponse(NetworkMapBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    location_name: str | None = None
    has_alerts: bool = False
    offline_count: int = 0
    created_at: datetime
    updated_at: datetime


class CarouselItemSetting(BaseModel):
    id: int
    in_carousel: bool = True
    carousel_order: int = 0
    carousel_seconds: int = 20


class CarouselBatchUpdate(BaseModel):
    items: list[CarouselItemSetting]

