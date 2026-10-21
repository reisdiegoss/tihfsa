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
    notify_requester_on_update = Column(Boolean, default=True, nullable=False)
    
    # Notificações por E-mail à Equipe de TI / Suporte
    notify_ti_on_create = Column(Boolean, default=True, nullable=False)
    notify_ti_on_close = Column(Boolean, default=True, nullable=False)
    notify_ti_on_update = Column(Boolean, default=True, nullable=False)
    
    # Notificação por E-mail ao Técnico Responsável
    notify_technician_on_assign = Column(Boolean, default=True, nullable=False)

    # Parâmetros de Instalação e Identidade Visual PWA (Mobile & Desktop)
    pwa_name = Column(String(255), default="TIHFSA — Hotel Fasano Salvador", nullable=True)
    pwa_short_name = Column(String(50), default="TIHFSA", nullable=True)
    pwa_theme_color = Column(String(30), default="#0f172a", nullable=True)
    pwa_bg_color = Column(String(30), default="#0f172a", nullable=True)
    pwa_icon_url = Column(String(500), default="/icons/icon-512.png", nullable=True)

    # Parâmetros AIOps — Abertura Automática de Chamados por Alertas Persistentes
    auto_ticket_on_alert_enabled = Column(Boolean, default=True, nullable=False)
    auto_ticket_alert_hours = Column(Integer, default=12, nullable=False)
    auto_ticket_ram_threshold_pct = Column(Integer, default=80, nullable=False)
    auto_ticket_disk_threshold_pct = Column(Integer, default=90, nullable=False)
    auto_ticket_temp_threshold_c = Column(Integer, default=85, nullable=False)
    auto_ticket_category_id = Column(Integer, nullable=True)


