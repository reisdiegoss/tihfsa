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


class AssetZabbixItemBase(BaseModel):
    zabbix_item_id: str
    name: str
    interface_name: str | None = None
    monitor_type: str = "CUSTOM"
    is_active: bool = True

class AssetZabbixItemCreate(AssetZabbixItemBase):
    pass

class AssetZabbixItemResponse(AssetZabbixItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    asset_id: int


class AssetCreate(AssetBase):
    assigned_user_id: int | None = None
    subcategory_id: int | None = None
    category_id: int | None = None
    location_id: int | None = None


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
    location_id: int | None = None
    is_active: bool | None = None


class AssetResponse(AssetBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    assigned_user_id: int | None = None
    assigned_user_name: str | None = None
    subcategory_id: int | None = None
    category_id: int | None = None
    category_name: str | None = None
    location_id: int | None = None
    location_name: str | None = None
    icmp_status: str | None = "no_ip"
    zabbix_status: str | None = "no_ip"
    zabbix_alert_title: str | None = None
    zabbix_severity: str | None = None
    monitoring_protocol: str | None = "icmp"
    snmp_status: str | None = "not_configured"
    created_at: datetime
    zabbix_items: list[AssetZabbixItemResponse] = []
