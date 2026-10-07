"""
Model SystemSetting — Parâmetros Globais do Sistema TIHFSA
Permite configurar e-mail do grupo de suporte, dias de garantia e notificações.
"""
from sqlalchemy import Column, Integer, String, Boolean
from app.database import Base


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    
    # E-mail da Equipe de TI / Grupo de Suporte (notificações corporativas)
    support_notification_email = Column(String(255), default="ti-hfsa@fasano.com.br", nullable=False)

    # Título e Subtítulo Personalizáveis do Cabeçalho de E-mail
    email_header_title = Column(String(255), default="TIHFSA — Hotel Fasano Salvador", nullable=False)
    email_header_subtitle = Column(String(255), default="Central de Serviços & Suporte de TI", nullable=False)
    
    # Título Personalizável do Corpo do E-mail
    email_body_title = Column(String(255), default="Notificação de Atendimento", nullable=False)
    
    # Prazo de garantia em dias para o usuário poder reabrir o chamado após fechamento
    ticket_warranty_days = Column(Integer, default=7, nullable=False)
    
    # Pesquisa de Satisfação (CSAT) de 1 a 5 estrelas
    csat_enabled = Column(Boolean, default=True, nullable=False)
    
    # Notificações por E-mail ao Solicitante
    notify_requester_on_create = Column(Boolean, default=True, nullable=False)
    notify_requester_on_assign = Column(Boolean, default=True, nullable=False)
    notify_requester_on_solve = Column(Boolean, default=True, nullable=False)
    
    # Notificação por E-mail ao Técnico Responsável
    notify_technician_on_assign = Column(Boolean, default=True, nullable=False)
