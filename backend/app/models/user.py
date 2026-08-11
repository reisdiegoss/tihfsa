"""
Model User — representa tanto colaboradores quanto apartamentos.

Regra de Ouro: auto-relacionamento manager_id para hierarquia de gestores.
Flag is_room diferencia pessoas de apartamentos (Apt 101, Apt 204).
"""
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, Text
)
from sqlalchemy.orm import relationship

from app.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    TECHNICIAN = "technician"
    MANAGER = "manager"
    USER = "user"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    ad_username = Column(String(100), unique=True, nullable=True, index=True)
    display_name = Column(String(200), nullable=False)
    email = Column(String(200), nullable=True, index=True)
    password_hash = Column(String(255), nullable=True)  # Apenas admin root
    role = Column(Enum(UserRole), default=UserRole.USER, nullable=False)
    is_room = Column(Boolean, default=False, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    phone = Column(String(50), nullable=True)
    room_number = Column(String(20), nullable=True)  # Ex: "101", "204"
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # FK — Departamento
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)

    # FK — Auto-relacionamento: quem é o gestor deste usuário
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    department = relationship("Department", back_populates="members", foreign_keys=[department_id])
    manager = relationship("User", remote_side=[id], foreign_keys=[manager_id])
    subordinates = relationship("User", foreign_keys=[manager_id], back_populates="manager")
    assets = relationship("Asset", back_populates="assigned_user")
    tickets_opened = relationship("Ticket", foreign_keys="Ticket.requester_id", back_populates="requester")
    tickets_assigned = relationship("Ticket", foreign_keys="Ticket.technician_id", back_populates="technician")
    interactions = relationship("TicketInteraction", back_populates="user")

    def __repr__(self):
        kind = f"Room {self.room_number}" if self.is_room else self.role.value
        return f"<User {self.id}: {self.display_name} ({kind})>"
