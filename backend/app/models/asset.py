"""
Model Asset — equipamentos do CMDB (TV, SKY, Notebook, Unifi, etc.).

Cada ativo pertence a um usuário ou apartamento via assigned_user_id.
"""
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, JSON, Text
)
from sqlalchemy.orm import relationship

from app.database import Base


class ZabbixMonitorType(str, enum.Enum):
    TRAFFIC_IN = "TRAFFIC_IN"
    TRAFFIC_OUT = "TRAFFIC_OUT"
    STATUS_UPDOWN = "STATUS_UPDOWN"
    SDWAN_STATUS = "SDWAN_STATUS"
    SPEED = "SPEED"
    CUSTOM = "CUSTOM"


class AssetType(str, enum.Enum):
    # Apartamento
    TV = "TV"
    SKY = "SKY"
    CONTROLE_SKY = "Controle SKY"
    TELEFONE = "Telefone"
    CAIXA_SOM = "Caixa de Som"
    ANTENA_UNIFI = "Antena Unifi"
    # Backoffice
    NOTEBOOK = "Notebook"
    DESKTOP = "Desktop"
    MONITOR = "Monitor"
    TECLADO = "Teclado"
    MOUSE = "Mouse"
    IMPRESSORA = "Impressora"
    # Rede / Infra
    SWITCH = "Switch"
    ROTEADOR = "Roteador"
    ACCESS_POINT = "Access Point"
    OUTRO = "Outro"


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    asset_tag = Column(String(50), unique=True, nullable=True, index=True)  # Patrimônio
    name = Column(String(200), nullable=False)  # Ex: "TV Samsung 55' - Apt 101"
    type = Column(String(100), nullable=False, index=True)  # Nome do tipo de ativo dinâmico
    brand = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    serial_number = Column(String(100), nullable=True)
    mac_address = Column(String(17), nullable=True)  # AA:BB:CC:DD:EE:FF
    ip_address = Column(String(45), nullable=True)
    specs = Column(JSON, nullable=True)  # Configurações extras em JSON
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # FK — Usuário ou Apartamento dono do ativo
    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # FK — Subcategoria (vincula o ativo ao tipo de equipamento no helpdesk)
    subcategory_id = Column(Integer, ForeignKey("subcategories.id"), nullable=True)

    # FK — Categoria (vincula o ativo à categoria geral)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)

    # FK — Localização física (ex: Lobby, UH 101, Rack TI)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)

    # Relationships
    assigned_user = relationship("User", back_populates="assets")
    tickets = relationship("Ticket", back_populates="asset")
    subcategory = relationship("Subcategory")
    category = relationship("Category")
    location = relationship("Location", back_populates="assets")
    zabbix_items = relationship("AssetZabbixItem", back_populates="asset", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Asset {self.id}: {self.name} ({self.type.value})>"


class AssetZabbixItem(Base):
    __tablename__ = "asset_zabbix_items"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True)
    zabbix_item_id = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    interface_name = Column(String(100), nullable=True)
    monitor_type = Column(String(50), default=ZabbixMonitorType.CUSTOM.value, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    asset = relationship("Asset", back_populates="zabbix_items")

    def __repr__(self):
        return f"<AssetZabbixItem {self.id}: {self.name} ({self.monitor_type})>"

