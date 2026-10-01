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
        """Considera online se enviou sinal nos últimos 180 segundos (3 minutos)."""
        if not self.last_seen_at:
            return False
        now = datetime.now(timezone.utc)
        diff_seconds = (now - self.last_seen_at).total_seconds()
        return diff_seconds <= 180
