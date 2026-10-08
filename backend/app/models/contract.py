"""
Model Contract, Supplier, SupplierContact, ContractService e ContractInvoice
Módulo de Gestão de Contratos, Fornecedores e Vencimentos de Faturas da TI.
Hotel Fasano Salvador — TI Corporativa
"""
from datetime import datetime, timezone, date
from decimal import Decimal
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Date, DateTime, 
    Numeric, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from app.database import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    corporate_name = Column(String(200), nullable=False)  # Razão Social
    trade_name = Column(String(150), nullable=False, index=True)  # Nome Fantasia
    cnpj = Column(String(25), nullable=True, index=True)  # CNPJ ou documento
    category = Column(String(80), nullable=True, default="Geral", index=True)  # Telecom, Software/SaaS, Hardware, CFTV, etc.
    support_portal = Column(String(300), nullable=True)  # URL de abertura de chamados / portal
    address = Column(String(300), nullable=True)
    notes = Column(Text, nullable=True)
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

    # Relacionamentos
    contacts = relationship("SupplierContact", back_populates="supplier", cascade="all, delete-orphan", order_by="SupplierContact.is_primary.desc()")
    contracts = relationship("Contract", back_populates="supplier", order_by="Contract.end_date.asc()")


class SupplierContact(Base):
    __tablename__ = "supplier_contacts"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(120), nullable=False)
    role_title = Column(String(100), nullable=True)  # Ex: Gerente de Contas, Suporte 24h, Faturamento
    contact_type = Column(String(50), nullable=True, default="Comercial")  # Comercial, Suporte, Financeiro, Emergência
    email = Column(String(150), nullable=True)
    phone = Column(String(50), nullable=True)
    mobile_whatsapp = Column(String(50), nullable=True)
    is_primary = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)  # Plantão, horário, SLA

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    supplier = relationship("Supplier", back_populates="contacts")


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, index=True)
    contract_number = Column(String(80), nullable=True, index=True)  # Nº do Contrato (ex: CTR-2026/012)
    title = Column(String(200), nullable=False, index=True)  # Objeto do Contrato
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True)
    manager_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # Gestor interno TI
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)  # Centro de Custo favorecido

    start_date = Column(Date, nullable=False, default=date.today)
    end_date = Column(Date, nullable=False, index=True)  # Vencimento do contrato
    renewal_type = Column(String(50), nullable=False, default="Automática")  # Automática, Negociação Anual, Indeterminado
    notice_period_days = Column(Integer, default=30, nullable=False)  # Dias de aviso prévio para cancelamento

    monthly_cost = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)  # Valor mensal recorrente
    total_cost = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)  # Valor total do contrato
    payment_terms = Column(String(100), nullable=True, default="Boleto Bancário")  # Condições de faturamento

    # ACTIVE, EXPIRING_SOON, EXPIRED, CANCELLED
    status = Column(String(30), default="ACTIVE", nullable=False, index=True)

    # E-mails específicos para receberem alertas de vencimento deste contrato e de suas faturas
    notification_emails = Column(Text, nullable=True)

    attachment_path = Column(String(400), nullable=True)  # PDF do contrato
    notes = Column(Text, nullable=True)  # Cláusulas de SLA, Reajuste (IPCA/IGP-M)

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

    supplier = relationship("Supplier", back_populates="contracts")
    manager = relationship("User", foreign_keys=[manager_id])
    department = relationship("Department", foreign_keys=[department_id])
    services = relationship("ContractService", back_populates="contract", cascade="all, delete-orphan")
    invoices = relationship("ContractInvoice", back_populates="contract", cascade="all, delete-orphan", order_by="ContractInvoice.due_date.asc()")


class ContractService(Base):
    __tablename__ = "contract_services"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(180), nullable=False)  # Ex: Link Dedicado 500Mbps, Licenças Microsoft 365 E3
    service_type = Column(String(80), nullable=True, default="Serviço Recorrente")  # Telecom, Licença, Manutenção, Hardware
    description = Column(Text, nullable=True)
    quantity = Column(Integer, default=1, nullable=False)
    unit = Column(String(40), default="un", nullable=False)  # links, licenças, horas, instâncias
    unit_price = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    contract = relationship("Contract", back_populates="services")


class ContractInvoice(Base):
    __tablename__ = "contract_invoices"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False, index=True)

    invoice_number = Column(String(80), nullable=True)  # Nº da Nota Fiscal / Fatura
    competence = Column(String(30), nullable=True, index=True)  # Ex: 10/2026
    due_date = Column(Date, nullable=False, index=True)  # Vencimento da fatura
    amount = Column(Numeric(12, 2), nullable=False)  # Valor da parcela/fatura
    paid_at = Column(DateTime(timezone=True), nullable=True)  # Data e hora do pagamento/baixa

    payment_code = Column(String(200), nullable=True)  # Linha digitável / Código de barras / Chave PIX
    status = Column(String(30), default="PENDING", nullable=False, index=True)  # PENDING, OVERDUE, PAID, CONTESTED
    file_attachment = Column(String(400), nullable=True)  # Boleto ou NF em anexo
    notes = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    contract = relationship("Contract", back_populates="invoices")
