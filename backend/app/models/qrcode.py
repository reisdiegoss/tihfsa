"""
Model QRCode — Registro de QR Codes emitidos para Equipamentos e redes Wi-Fi de eventos.
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.database import Base


class QRCodeItem(Base):
    __tablename__ = "qrcodes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(32), unique=True, index=True, nullable=False)  # Ex: QR-B72F9A
    type = Column(String(20), nullable=False, default="equipment")     # "equipment" | "wifi"
    title = Column(String(200), nullable=False)                         # Identificação / Nome de exibição
    company = Column(String(150), nullable=True)                        # Nome da Empresa (Hotel Fasano Salvador / Cliente Evento)

    # Parâmetros específicos para Wi-Fi
    ssid = Column(String(100), nullable=True)
    password = Column(String(100), nullable=True)
    security_type = Column(String(20), default="WPA")                   # "WPA" (WPA/WPA2/WPA3), "WEP", "nopass"
    is_hidden = Column(Boolean, default=False)

    # Parâmetros específicos para Equipamento
    collaborator = Column(String(150), nullable=True)                   # Colaborador / Responsável
    asset_name = Column(String(150), nullable=True)                     # Nome do equipamento / Hostname / Patrimônio
    brand = Column(String(100), nullable=True)                          # Marca
    model = Column(String(100), nullable=True)                          # Modelo
    address = Column(String(255), nullable=True)                        # Endereço / Localização física
    message = Column(Text, nullable=True)                               # Mensagem personalizada / Instrução
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)

    # Personalização Visual
    logo_url = Column(String(500), nullable=True)                       # URL da logo centralizada
    include_logo = Column(Boolean, default=True)

    # Auditoria e Rastreabilidade
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relacionamentos
    asset = relationship("Asset", foreign_keys=[asset_id], lazy="select")
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="select")


class QRCodeConfig(Base):
    __tablename__ = "qrcode_config"

    id = Column(Integer, primary_key=True, index=True)
    default_logo_url = Column(String(500), nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
