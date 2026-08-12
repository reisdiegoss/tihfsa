"""
Model Ticket — chamado do helpdesk.

Ciclo de vida: NEW → IN_PROGRESS → PENDING_VALIDATION → CLOSED/REJECTED
Regra: Técnico NÃO fecha. Muda para PENDING_VALIDATION e gestor aprova.
"""
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Enum, ForeignKey
)
from sqlalchemy.orm import relationship

from app.database import Base


class TicketStatus(str, enum.Enum):
    NEW = "Novo"
    IN_PROGRESS = "Em Andamento"
    PENDING_VALIDATION = "Aguardando Validação"
    CLOSED = "Fechado"
    REJECTED = "Rejeitado"


class TicketPriority(str, enum.Enum):
    LOW = "Baixa"
    MEDIUM = "Média"
    HIGH = "Alta"
    CRITICAL = "Crítica"


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(
        Enum(TicketStatus),
        default=TicketStatus.NEW,
        nullable=False,
        index=True,
    )
    priority = Column(
        Enum(TicketPriority),
        default=TicketPriority.MEDIUM,
        nullable=False,
    )

    # Token JWT de uso único para validação do gestor
    validation_token = Column(String(500), nullable=True)

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
    solved_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    # FK — Quem abriu o chamado (pessoa ou apartamento)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # FK — Técnico atribuído
    technician_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # FK — Equipamento com problema (opcional)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True)

    # FK — Categoria, Subcategoria e Tipo de Problema
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    subcategory_id = Column(Integer, ForeignKey("subcategories.id"), nullable=True)
    problem_type_id = Column(Integer, ForeignKey("problem_types.id"), nullable=True)

    # Relationships
    requester = relationship("User", foreign_keys=[requester_id], back_populates="tickets_opened")
    technician = relationship("User", foreign_keys=[technician_id], back_populates="tickets_assigned")
    asset = relationship("Asset", back_populates="tickets")
    category = relationship("Category")
    subcategory = relationship("Subcategory")
    problem_type = relationship("ProblemType", back_populates="tickets")
    interactions = relationship(
        "TicketInteraction",
        back_populates="ticket",
        order_by="TicketInteraction.created_at",
    )
    attachments = relationship(
        "TicketAttachment",
        back_populates="ticket",
        order_by="TicketAttachment.created_at",
    )

    def __repr__(self):
        return f"<Ticket #{self.id}: {self.title} [{self.status.value}]>"
