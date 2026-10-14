"""
Model Term — Termos de Responsabilidade e Retirada de Equipamentos (E-Signature & Validação Facial).
Hotel Fasano Salvador.
"""
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey, Enum
)
from sqlalchemy.orm import relationship

from app.database import Base


class EquipmentTerm(Base):
    """
    Termo de Responsabilidade e Retirada de Equipamentos/Acessórios corporativos.
    Permite assinatura digital na tela e validação biométrica facial no ato da entrega.
    """
    __tablename__ = "equipment_terms"

    id = Column(Integer, primary_key=True, index=True)
    term_number = Column(String(50), unique=True, index=True, nullable=False)  # Ex: TR-2026-0001
    status = Column(String(30), default="pending_signature", index=True, nullable=False)  # 'pending_signature', 'signed', 'returned', 'cancelled'
    term_type = Column(String(50), default="retirada", nullable=False)  # 'retirada', 'emprestimo', 'devolucao'

    # Beneficiário / Colaborador Recebedor
    beneficiary_type = Column(String(20), default="ad_user", nullable=False)  # 'ad_user', 'external_user'
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    beneficiary_name = Column(String(200), nullable=False, index=True)
    beneficiary_document = Column(String(50), nullable=True)  # CPF, RG ou Matrícula
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True)
    department_name = Column(String(150), nullable=True)
    beneficiary_email = Column(String(150), nullable=True)
    beneficiary_phone = Column(String(50), nullable=True)
    has_ad_account = Column(Boolean, default=True, nullable=False)

    # Técnico Emissor (quem abriu o termo no tablet)
    technician_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    technician_name = Column(String(200), nullable=False)

    # Assinatura Digital e Validação Facial
    signed_at = Column(DateTime(timezone=True), nullable=True)
    signature_url = Column(String(350), nullable=True)  # Caminho da imagem da rubrica (/uploads/terms/signatures/...)
    facial_photo_url = Column(String(350), nullable=True)  # Caminho da foto facial (/uploads/terms/facial_photos/...)
    facial_verified = Column(Boolean, default=False, nullable=False)
    facial_confidence = Column(Float, nullable=True)  # Score do face-api.js
    signer_ip = Column(String(50), nullable=True)
    signer_device = Column(String(255), nullable=True)

    # Devolução e Baixa
    returned_at = Column(DateTime(timezone=True), nullable=True)
    return_technician_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    return_technician_name = Column(String(200), nullable=True)
    return_condition = Column(String(100), nullable=True)
    return_notes = Column(Text, nullable=True)

    # Cláusulas Legais e Observações
    template_id = Column(Integer, ForeignKey("equipment_term_templates.id", ondelete="SET NULL"), nullable=True)
    expected_return_date = Column(DateTime(timezone=True), nullable=True)
    legal_text = Column(Text, nullable=False)
    notes = Column(Text, nullable=True)

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

    # Relacionamentos
    user = relationship("User", foreign_keys=[user_id])
    department = relationship("Department", foreign_keys=[department_id])
    technician = relationship("User", foreign_keys=[technician_id])
    return_technician = relationship("User", foreign_keys=[return_technician_id])
    template = relationship("EquipmentTermTemplate", foreign_keys=[template_id])
    items = relationship("EquipmentTermItem", back_populates="term", cascade="all, delete-orphan", order_by="EquipmentTermItem.id")


class EquipmentTermTemplate(Base):
    """
    Modelos de Termos de Retirada e Responsabilidade (Builder estilo Word com Tags Dinâmicas).
    """
    __tablename__ = "equipment_term_templates"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    category = Column(String(100), default="Geral", nullable=False)
    description = Column(String(300), nullable=True)
    content_html = Column(Text, nullable=False)
    default_items = Column(Text, nullable=True)  # JSON com itens pré-definidos
    is_active = Column(Boolean, default=True, nullable=False)
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


class EquipmentTermItem(Base):
    """
    Itens vinculados a um termo (Fone, Rádio, Celular, Notebook, Chave, Relógio, etc.).
    """
    __tablename__ = "equipment_term_items"

    id = Column(Integer, primary_key=True, index=True)
    term_id = Column(Integer, ForeignKey("equipment_terms.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True, index=True)

    item_name = Column(String(200), nullable=False)  # Ex: "Fone de ouvido estéreo", "Celular corporativo"
    category = Column(String(100), nullable=True)  # Ex: "Comunicação", "Acesso/Chave", "Periférico", "Notebook"
    asset_tag = Column(String(50), nullable=True)  # Patrimônio
    serial_number = Column(String(100), nullable=True)  # S/N
    quantity = Column(Integer, default=1, nullable=False)
    condition = Column(String(100), default="Em perfeito estado de funcionamento", nullable=False)
    accessories = Column(String(255), nullable=True)  # Carregador, cabos, case, etc.
    is_returned = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)

    term = relationship("EquipmentTerm", back_populates="items")
    asset = relationship("Asset", foreign_keys=[asset_id])

