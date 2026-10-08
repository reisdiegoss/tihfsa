"""
Model NotificationLog — Histórico e Auditoria de Notificações Disparadas (E-mail e WhatsApp).
Suporte a visualização de status, diagnóstico de falhas e reenvio manual ou automático.
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, index=True)
    channel = Column(String(30), nullable=False, index=True)  # "EMAIL" ou "WHATSAPP"
    notification_type = Column(String(50), nullable=False, index=True)  # ex: "TICKET_CREATED", "TICKET_ASSIGNED", "TICKET_SOLVED_CSAT", "TICKET_REOPENED", "NOC_ALERT", "SYSTEM_TEST"
    recipient = Column(String(255), nullable=False, index=True)  # E-mail ou número de telefone/grupo
    recipient_name = Column(String(150), nullable=True)
    subject = Column(String(300), nullable=True)
    body = Column(Text, nullable=True)  # Conteúdo ou resumo HTML/texto
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(String(30), default="SENT", nullable=False, index=True)  # "SENT", "DELIVERED", "FAILED"
    error_message = Column(Text, nullable=True)
    resend_count = Column(Integer, default=0, nullable=False)
    last_attempt_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    ticket = relationship("Ticket", foreign_keys=[ticket_id])

    def __repr__(self):
        return f"<NotificationLog {self.id}: {self.channel} -> {self.recipient} [{self.status}]>"
