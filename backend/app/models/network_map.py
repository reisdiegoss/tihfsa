"""
Model NetworkMap — armazena diagramas e mapas de topologia de rede.
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class NetworkMap(Base):
    __tablename__ = "network_maps"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False, nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    background_image_url = Column(String(2000), nullable=True)

    # JSON com estrutura dos nós: [{id, asset_id, label, icon_type, x, y}]
    nodes_data = Column(JSON, default=list, nullable=False)

    # JSON com estrutura das conexões: [{id, source_id, target_id, label, speed}]
    edges_data = Column(JSON, default=list, nullable=False)

    # Nível de Zoom e Panorâmica salvos do canvas
    zoom_level = Column(JSON, default=1.0, nullable=True)
    pan_x = Column(Integer, default=0, nullable=True)
    pan_y = Column(Integer, default=0, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    location = relationship("Location")
