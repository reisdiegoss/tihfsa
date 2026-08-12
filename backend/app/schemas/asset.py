"""Schemas de Asset (CMDB)."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class AssetBase(BaseModel):
    name: str
    type: str
    brand: str | None = None
    model: str | None = None
    serial_number: str | None = None
    mac_address: str | None = None
    ip_address: str | None = None
    asset_tag: str | None = None
    description: str | None = None
    specs: dict | None = None


class AssetCreate(AssetBase):
    assigned_user_id: int | None = None
    subcategory_id: int | None = None
    category_id: int | None = None


class AssetUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    brand: str | None = None
    model: str | None = None
    serial_number: str | None = None
    mac_address: str | None = None
    ip_address: str | None = None
    asset_tag: str | None = None
    description: str | None = None
    specs: dict | None = None
    assigned_user_id: int | None = None
    subcategory_id: int | None = None
    category_id: int | None = None
    is_active: bool | None = None


class AssetResponse(AssetBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    assigned_user_id: int | None = None
    subcategory_id: int | None = None
    category_id: int | None = None
    created_at: datetime
