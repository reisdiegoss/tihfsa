"""
Model AssetTypeModel — Tipos de Equipamento dinâmicos com campos personalizados.
"""
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, JSON
)

from app.database import Base


class AssetTypeModel(Base):
    __tablename__ = "asset_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    icon = Column(String(50), default="Server", nullable=False)
    description = Column(String(255), nullable=True)
    
    # Lista de definições de campos personalizados:
    # [{"name": "RAM", "key": "ram", "field_type": "text|number|select|boolean", "options": ["8GB", "16GB"], "required": false}]
    custom_fields = Column(JSON, nullable=True, default=list)
    
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<AssetTypeModel {self.id}: {self.name}>"
