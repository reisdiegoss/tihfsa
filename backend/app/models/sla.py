"""
Model SLA — Parametrização e regras de SLA para Helpdesk do Hotel Fasano Salvador.
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class SLAConfig(Base):
    """
    Configuração Global de SLA do Sistema.
    Define os tempos de Primeira Resposta e Resolução por Prioridade,
    com suporte opcional a Horário Comercial e sobreposição por Categoria.
    """
    __tablename__ = "sla_config"

    id = Column(Integer, primary_key=True, index=True)

    # 1. Modo Horário Comercial vs 24/7
    calc_business_hours = Column(Boolean, default=False, nullable=False)
    business_start_time = Column(String(10), default="08:00", nullable=False)
    business_end_time = Column(String(10), default="18:00", nullable=False)
    business_days = Column(String(50), default="mon,tue,wed,thu,fri", nullable=False)

    # 2. Ativar sobreposição de SLA por Categoria
    enable_category_sla = Column(Boolean, default=False, nullable=False)

    # 3. Prazos Padrão por Prioridade (em Minutos)
    # Crítica: 15 min resposta / 2h resolução
    critical_response_min = Column(Integer, default=15, nullable=False)
    critical_resolution_min = Column(Integer, default=120, nullable=False)

    # Alta: 60 min resposta / 4h resolução
    high_response_min = Column(Integer, default=60, nullable=False)
    high_resolution_min = Column(Integer, default=240, nullable=False)

    # Média: 120 min resposta / 8h resolução
    medium_response_min = Column(Integer, default=120, nullable=False)
    medium_resolution_min = Column(Integer, default=480, nullable=False)

    # Baixa: 240 min resposta / 24h (1440 min) resolução
    low_response_min = Column(Integer, default=240, nullable=False)
    low_resolution_min = Column(Integer, default=1440, nullable=False)

    # Alertas de iminência de quebra (Warning)
    warning_threshold_percent = Column(Integer, default=75, nullable=False) # Avisar quando atingir 75% do tempo

    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    updated_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    updated_by = relationship("User", foreign_keys=[updated_by_id], lazy="select")


class SLACategoryRule(Base):
    """
    Regras de SLA específicas por Categoria (quando ativado enable_category_sla).
    """
    __tablename__ = "sla_category_rules"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False, unique=True)
    response_min = Column(Integer, nullable=True)
    resolution_min = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    category = relationship("Category", lazy="joined")
