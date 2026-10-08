"""
Schemas Pydantic para o Módulo de Contratos, Fornecedores e Faturas.
Hotel Fasano Salvador — TI Corporativa
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr


# ==========================================================
# SUPPLIER CONTACT SCHEMAS
# ==========================================================

class SupplierContactBase(BaseModel):
    name: str = Field(..., max_length=120)
    role_title: Optional[str] = Field(None, max_length=100)
    contact_type: Optional[str] = Field("Comercial", max_length=50)
    email: Optional[str] = Field(None, max_length=150)
    phone: Optional[str] = Field(None, max_length=50)
    mobile_whatsapp: Optional[str] = Field(None, max_length=50)
    is_primary: bool = False
    notes: Optional[str] = None


class SupplierContactCreate(SupplierContactBase):
    pass


class SupplierContactUpdate(BaseModel):
    name: Optional[str] = None
    role_title: Optional[str] = None
    contact_type: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile_whatsapp: Optional[str] = None
    is_primary: Optional[bool] = None
    notes: Optional[str] = None


class SupplierContactResponse(SupplierContactBase):
    id: int
    supplier_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ==========================================================
# SUPPLIER SCHEMAS
# ==========================================================

class SupplierBase(BaseModel):
    corporate_name: str = Field(..., max_length=200, description="Razão Social")
    trade_name: str = Field(..., max_length=150, description="Nome Fantasia")
    cnpj: Optional[str] = Field(None, max_length=25)
    category: Optional[str] = Field("Geral", max_length=80)
    support_portal: Optional[str] = Field(None, max_length=300)
    address: Optional[str] = Field(None, max_length=300)
    notes: Optional[str] = None
    is_active: bool = True


class SupplierCreate(SupplierBase):
    initial_contacts: Optional[List[SupplierContactCreate]] = None


class SupplierUpdate(BaseModel):
    corporate_name: Optional[str] = None
    trade_name: Optional[str] = None
    cnpj: Optional[str] = None
    category: Optional[str] = None
    support_portal: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class SupplierResponse(SupplierBase):
    id: int
    created_at: datetime
    updated_at: datetime
    contacts: List[SupplierContactResponse] = []
    contracts_count: int = 0

    class Config:
        from_attributes = True


# ==========================================================
# CONTRACT SERVICE SCHEMAS
# ==========================================================

class ContractServiceBase(BaseModel):
    name: str = Field(..., max_length=180)
    service_type: Optional[str] = Field("Serviço Recorrente", max_length=80)
    description: Optional[str] = None
    quantity: int = Field(1, ge=1)
    unit: str = Field("un", max_length=40)
    unit_price: Decimal = Field(Decimal("0.00"), ge=0)


class ContractServiceCreate(ContractServiceBase):
    pass


class ContractServiceResponse(ContractServiceBase):
    id: int
    contract_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ==========================================================
# CONTRACT INVOICE SCHEMAS
# ==========================================================

class ContractInvoiceBase(BaseModel):
    invoice_number: Optional[str] = Field(None, max_length=80)
    competence: Optional[str] = Field(None, max_length=30)
    due_date: date
    amount: Decimal = Field(..., ge=0)
    payment_code: Optional[str] = Field(None, max_length=200)
    status: str = Field("PENDING", max_length=30)
    file_attachment: Optional[str] = Field(None, max_length=400)
    notes: Optional[str] = None


class ContractInvoiceCreate(ContractInvoiceBase):
    pass


class ContractInvoiceUpdate(BaseModel):
    invoice_number: Optional[str] = None
    competence: Optional[str] = None
    due_date: Optional[date] = None
    amount: Optional[Decimal] = None
    paid_at: Optional[datetime] = None
    payment_code: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ContractInvoiceResponse(ContractInvoiceBase):
    id: int
    contract_id: int
    contract_title: Optional[str] = None
    supplier_name: Optional[str] = None
    paid_at: Optional[datetime] = None
    is_overdue: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


# ==========================================================
# CONTRACT SCHEMAS
# ==========================================================

class ContractBase(BaseModel):
    contract_number: Optional[str] = Field(None, max_length=80)
    title: str = Field(..., max_length=200)
    supplier_id: int
    manager_id: Optional[int] = None
    department_id: Optional[int] = None
    start_date: date = Field(default_factory=date.today)
    end_date: date
    renewal_type: str = Field("Automática", max_length=50)
    notice_period_days: int = Field(30, ge=0)
    monthly_cost: Decimal = Field(Decimal("0.00"), ge=0)
    total_cost: Decimal = Field(Decimal("0.00"), ge=0)
    payment_terms: Optional[str] = Field("Boleto Bancário", max_length=100)
    status: str = Field("ACTIVE", max_length=30)
    notification_emails: Optional[str] = Field(
        None, 
        description="E-mails específicos para receberem alertas de vencimento deste contrato e faturas (separados por vírgula)"
    )
    attachment_path: Optional[str] = Field(None, max_length=400)
    notes: Optional[str] = None


class ContractCreate(ContractBase):
    auto_generate_invoices: bool = False
    services: Optional[List[ContractServiceCreate]] = None


class ContractUpdate(BaseModel):
    contract_number: Optional[str] = None
    title: Optional[str] = None
    supplier_id: Optional[int] = None
    manager_id: Optional[int] = None
    department_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    renewal_type: Optional[str] = None
    notice_period_days: Optional[int] = None
    monthly_cost: Optional[Decimal] = None
    total_cost: Optional[Decimal] = None
    payment_terms: Optional[str] = None
    status: Optional[str] = None
    notification_emails: Optional[str] = None
    attachment_path: Optional[str] = None
    notes: Optional[str] = None


class ContractResponse(ContractBase):
    id: int
    created_at: datetime
    updated_at: datetime
    supplier_name: Optional[str] = None
    supplier_trade_name: Optional[str] = None
    manager_name: Optional[str] = None
    department_name: Optional[str] = None
    days_until_expiration: int = 0
    is_expiring_soon: bool = False
    is_expired: bool = False
    invoices_count: int = 0
    next_invoice_due: Optional[date] = None
    services: List[ContractServiceResponse] = []
    invoices: List[ContractInvoiceResponse] = []

    class Config:
        from_attributes = True


# ==========================================================
# DASHBOARD SCHEMAS
# ==========================================================

class ContractDashboardResponse(BaseModel):
    active_contracts_count: int
    expiring_contracts_count: int
    expired_contracts_count: int
    total_suppliers_count: int
    monthly_cost_total: float
    total_contract_cost: float
    month_invoices_amount: float
    pending_invoices_count: int
    overdue_invoices_count: int
    expiring_contracts: List[ContractResponse] = []
    upcoming_invoices: List[ContractInvoiceResponse] = []
