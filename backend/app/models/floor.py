"""
Model Floor — representa os andares e pavimentos do hotel (ex: Subsolo, Térreo, 1º ao 7º Andar, Rooftop).
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from app.database import Base


class Floor(Base):
    __tablename__ = "floors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True, index=True)  # Ex: "Térreo", "1º Andar", "Rooftop"
    number = Column(Integer, nullable=True, index=True)  # Nível numérico para ordenação (-1, 0, 1, 2...)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, server_default="1", nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<Floor {self.id}: {self.name} (Nível {self.number})>"
