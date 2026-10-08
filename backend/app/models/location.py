"""
Model Location — representa localizações físicas do hotel/empresa (ex: Lobby, UH 101, Rack TI, Sala de Reunião).
"""
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Table, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base

# Association Table — Múltiplos Setores por Localização e Múltiplas Localizações por Setor
location_departments = Table(
    "location_departments",
    Base.metadata,
    Column("location_id", Integer, ForeignKey("locations.id", ondelete="CASCADE"), primary_key=True),
    Column("department_id", Integer, ForeignKey("departments.id", ondelete="CASCADE"), primary_key=True),
)


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, unique=True, index=True)  # Ex: "Lobby Principal", "Rack TI - Bloco A"
    building = Column(String(100), nullable=True)  # Ex: "Bloco A", "Prédio Principal"
    floor = Column(String(50), nullable=True)  # Ex: "Térreo", "1º Andar", "Subsolo"
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_public = Column(Boolean, default=True, server_default="1", nullable=False)
    order_index = Column(Integer, default=0, server_default="0", nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    assets = relationship("Asset", back_populates="location")
    departments = relationship("Department", secondary=location_departments, backref="locations")

    def __repr__(self):
        return f"<Location {self.id}: {self.name}>"
