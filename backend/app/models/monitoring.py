"""
Model Monitoring — Telemetria de Agentes e Monitoramento Nativo TIHFSA.
"""
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import relationship

from app.database import Base


class AgentCheckin(Base):
    """
    Registra a telemetria enviada periodicamente pelo TIHFSA Agent (PowerShell/Serviço)
    instalado nas estações de trabalho e servidores corporativos.
    """
    __tablename__ = "agent_checkins"

    id = Column(Integer, primary_key=True, index=True)
    hostname = Column(String(150), unique=True, index=True, nullable=False)
    logged_user = Column(String(150), nullable=True)
    ip_address = Column(String(45), nullable=False)
    
    cpu_usage_pct = Column(Integer, nullable=True)
    ram_used_mb = Column(Integer, nullable=True)
    ram_total_mb = Column(Integer, nullable=True)
    ram_usage_pct = Column(Float, nullable=True)
    
    disk_metrics = Column(JSON, nullable=True)  # Lista com discos: [{"drive": "C:", "free_gb": 12.5, "total_gb": 256.0, "used_pct": 95.1}]
    uptime_hours = Column(Float, nullable=True)
    os_name = Column(String(150), nullable=True)
    status = Column(String(20), default="online", nullable=False)  # 'online', 'warning', 'offline'
    
    last_seen_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    
    # Vínculo opcional com equipamento cadastrado no CMDB
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)
    asset = relationship("Asset")

    @property
    def is_online(self) -> bool:
        """Considera online se enviou sinal nos últimos 1200 segundos (20 minutos), cobrindo o ciclo de 15 minutos da tarefa agendada."""
        if not self.last_seen_at:
            return False
        now = datetime.now(timezone.utc)
        diff_seconds = (now - self.last_seen_at).total_seconds()
        return diff_seconds <= 1200


class AgentMetricsHistory(Base):
    """
    Armazena amostras periódicas de telemetria enviadas pelo agente para histórico de
    desempenho (evolução temporal de CPU, RAM e Disco) e emissão de relatórios de upgrade.
    """
    __tablename__ = "agent_metrics_history"

    id = Column(Integer, primary_key=True, index=True)
    hostname = Column(String(150), index=True, nullable=False)
    cpu_usage_pct = Column(Integer, nullable=True)
    ram_used_mb = Column(Integer, nullable=True)
    ram_total_mb = Column(Integer, nullable=True)
    ram_usage_pct = Column(Float, nullable=True)
    disk_metrics = Column(JSON, nullable=True)
    disk_usage_pct = Column(Float, nullable=True)  # Percentual de uso do disco principal (ex: C:)
    disk_free_gb = Column(Float, nullable=True)    # Espaço livre do disco principal em GB
    uptime_hours = Column(Float, nullable=True)
    status = Column(String(20), default="online", nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
        nullable=False,
    )

