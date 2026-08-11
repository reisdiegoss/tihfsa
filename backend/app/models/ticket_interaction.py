"""
Model TicketInteraction — interações/comentários dentro de um chamado.
"""
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, Text, Boolean, DateTime, ForeignKey
)
from sqlalchemy.orm import relationship

from app.database import Base


class TicketInteraction(Base):
    __tablename__ = "ticket_interactions"

    id = Column(Integer, primary_key=True, index=True)
    message = Column(Text, nullable=False)
    is_solution = Column(Boolean, default=False, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # FK
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationships
    ticket = relationship("Ticket", back_populates="interactions")
    user = relationship("User", back_populates="interactions")

    def __repr__(self):
        return f"<Interaction {self.id} on Ticket #{self.ticket_id}>"
