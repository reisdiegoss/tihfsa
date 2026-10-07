"""
Model TicketSatisfactionSurvey — Pesquisa de Satisfação CSAT (1 a 5 Estrelas)
Avaliação do atendimento pelo solicitante após solução do chamado.
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class TicketSatisfactionSurvey(Base):
    __tablename__ = "ticket_satisfaction_surveys"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), unique=True, nullable=False, index=True)
    
    # Avaliação: 1 = Muito Insatisfeito, 2 = Pouco Satisfeito, 3 = Regular, 4 = Satisfeito, 5 = Muito Satisfeito
    rating = Column(Integer, nullable=True)
    
    # Comentário ou sugestão opcional do solicitante
    comment = Column(Text, nullable=True)
    
    # Token seguro único para acesso direto via e-mail sem login
    token = Column(String(100), unique=True, nullable=False, index=True)
    
    answered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    ticket = relationship("Ticket", back_populates="satisfaction_survey")
