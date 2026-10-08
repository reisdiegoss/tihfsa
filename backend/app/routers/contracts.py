"""
Router Contracts — Gestão de Contratos, Fornecedores, Serviços e Vencimento de Faturas da TI.
Hotel Fasano Salvador — TI Corporativa
"""
import os
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.database import get_db
from app.models.contract import (
    Supplier, SupplierContact, Contract, ContractService, ContractInvoice
)
from app.models.user import User
from app.models.department import Department
from app.auth.dependencies import get_current_user, require_staff, require_module
from app.schemas.contract import (
    SupplierCreate, SupplierUpdate, SupplierResponse,
    SupplierContactCreate, SupplierContactUpdate, SupplierContactResponse,
    ContractCreate, ContractUpdate, ContractResponse,
    ContractServiceCreate, ContractServiceResponse,
    ContractInvoiceCreate, ContractInvoiceUpdate, ContractInvoiceResponse,
    ContractDashboardResponse
)
from app.services.email_service import (
    render_bulletproof_email, send_system_email, get_email_header_branding, get_support_email
)
from app.config import get_app_base_url

router = APIRouter(prefix="/api/v1", tags=["Contracts & Suppliers"])


# ==========================================================
# UTILITÁRIOS E CÁLCULO DE STATUS
# ==========================================================

def _format_contract_response(contract: Contract) -> ContractResponse:
    today = date.today()
    days_left = (contract.end_date - today).days

    # Determinar status dinâmico
    status_val = contract.status
    if status_val not in ["CANCELLED", "RENEWED"]:
        if days_left < 0:
            status_val = "EXPIRED"
        elif days_left <= 60:
            status_val = "EXPIRING_SOON"
        else:
            status_val = "ACTIVE"

    next_invoice = None
    for inv in contract.invoices or []:
        if inv.status in ["PENDING", "OVERDUE"]:
            if next_invoice is None or inv.due_date < next_invoice:
                next_invoice = inv.due_date

    resp = ContractResponse(
        id=contract.id,
        contract_number=contract.contract_number,
        title=contract.title,
        supplier_id=contract.supplier_id,
        manager_id=contract.manager_id,
        department_id=contract.department_id,
        start_date=contract.start_date,
        end_date=contract.end_date,
        renewal_type=contract.renewal_type,
        notice_period_days=contract.notice_period_days,
        monthly_cost=contract.monthly_cost,
        total_cost=contract.total_cost,
        payment_terms=contract.payment_terms,
        status=status_val,
        notification_emails=contract.notification_emails,
        attachment_path=contract.attachment_path,
        notes=contract.notes,
        created_at=contract.created_at,
        updated_at=contract.updated_at,
        supplier_name=contract.supplier.corporate_name if contract.supplier else None,
        supplier_trade_name=contract.supplier.trade_name if contract.supplier else None,
        manager_name=contract.manager.display_name if contract.manager else None,
        department_name=contract.department.name if contract.department else None,
        days_until_expiration=days_left,
        is_expiring_soon=(0 <= days_left <= 60),
        is_expired=(days_left < 0),
        invoices_count=len(contract.invoices or []),
        next_invoice_due=next_invoice,
        services=[
            ContractServiceResponse(
                id=s.id,
                contract_id=s.contract_id,
                name=s.name,
                service_type=s.service_type,
                description=s.description,
                quantity=s.quantity,
                unit=s.unit,
                unit_price=s.unit_price,
                created_at=s.created_at,
            ) for s in (contract.services or [])
        ],
        invoices=[
            ContractInvoiceResponse(
                id=i.id,
                contract_id=i.contract_id,
                contract_title=contract.title,
                supplier_name=contract.supplier.trade_name if contract.supplier else None,
                invoice_number=i.invoice_number,
                competence=i.competence,
                due_date=i.due_date,
                amount=i.amount,
                paid_at=i.paid_at,
                payment_code=i.payment_code,
                status="OVERDUE" if (i.status == "PENDING" and i.due_date < today) else i.status,
                file_attachment=i.file_attachment,
                notes=i.notes,
                is_overdue=(i.status == "PENDING" and i.due_date < today),
                created_at=i.created_at,
            ) for i in (contract.invoices or [])
        ],
    )
    return resp


def _format_supplier_response(supplier: Supplier) -> SupplierResponse:
    return SupplierResponse(
        id=supplier.id,
        corporate_name=supplier.corporate_name,
        trade_name=supplier.trade_name,
        cnpj=supplier.cnpj,
        category=supplier.category,
        support_portal=supplier.support_portal,
        address=supplier.address,
        notes=supplier.notes,
        is_active=supplier.is_active,
        created_at=supplier.created_at,
        updated_at=supplier.updated_at,
        contracts_count=len(supplier.contracts or []),
        contacts=[
            SupplierContactResponse(
                id=c.id,
                supplier_id=c.supplier_id,
                name=c.name,
                role_title=c.role_title,
                contact_type=c.contact_type,
                email=c.email,
                phone=c.phone,
                mobile_whatsapp=c.mobile_whatsapp,
                is_primary=c.is_primary,
                notes=c.notes,
                created_at=c.created_at,
            ) for c in (supplier.contacts or [])
        ]
    )


# ==========================================================
# 1. DASHBOARD DE CONTRATOS & FATURAS
# ==========================================================

@router.get("/contracts/dashboard", response_model=ContractDashboardResponse, summary="Dashboard Executivo de Contratos e Vencimentos")
def get_contracts_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    today = date.today()
    all_contracts = db.query(Contract).all()
    all_suppliers_count = db.query(Supplier).filter(Supplier.is_active == True).count()

    active_count = 0
    expiring_count = 0
    expired_count = 0
    monthly_cost_total = Decimal("0.00")
    total_contract_cost = Decimal("0.00")
    expiring_list = []

    for c in all_contracts:
        days_left = (c.end_date - today).days
        if c.status not in ["CANCELLED", "RENEWED"]:
            if days_left < 0:
                expired_count += 1
            elif days_left <= 60:
                expiring_count += 1
                active_count += 1
                monthly_cost_total += c.monthly_cost
                total_contract_cost += c.total_cost
                expiring_list.append(_format_contract_response(c))
            else:
                active_count += 1
                monthly_cost_total += c.monthly_cost
                total_contract_cost += c.total_cost

    # Faturas do mês corrente
    start_of_month = date(today.year, today.month, 1)
    if today.month == 12:
        end_of_month = date(today.year + 1, 1, 1) - timedelta(days=1)
    else:
        end_of_month = date(today.year, today.month + 1, 1) - timedelta(days=1)

    all_invoices = db.query(ContractInvoice).all()
    month_invoices_amount = Decimal("0.00")
    pending_invoices_count = 0
    overdue_invoices_count = 0
    upcoming_invoices_list = []

    # Ordenar contratos com vencimento mais próximo
    expiring_list.sort(key=lambda x: x.days_until_expiration)

    for inv in all_invoices:
        c = inv.contract
        is_overdue = (inv.status == "PENDING" and inv.due_date < today)
        if is_overdue:
            overdue_invoices_count += 1

        if inv.status == "PENDING":
            pending_invoices_count += 1

        if start_of_month <= inv.due_date <= end_of_month:
            month_invoices_amount += inv.amount

        # Próximas faturas a vencer nos próximos 45 dias
        if inv.status in ["PENDING", "OVERDUE"] and inv.due_date <= today + timedelta(days=45):
            upcoming_invoices_list.append(
                ContractInvoiceResponse(
                    id=inv.id,
                    contract_id=inv.contract_id,
                    contract_title=c.title if c else f"Contrato #{inv.contract_id}",
                    supplier_name=c.supplier.trade_name if c and c.supplier else "Fornecedor",
                    invoice_number=inv.invoice_number,
                    competence=inv.competence,
                    due_date=inv.due_date,
                    amount=inv.amount,
                    paid_at=inv.paid_at,
                    payment_code=inv.payment_code,
                    status="OVERDUE" if is_overdue else inv.status,
                    file_attachment=inv.file_attachment,
                    notes=inv.notes,
                    is_overdue=is_overdue,
                    created_at=inv.created_at,
                )
            )

    upcoming_invoices_list.sort(key=lambda x: x.due_date)

    return ContractDashboardResponse(
        active_contracts_count=active_count,
        expiring_contracts_count=expiring_count,
        expired_contracts_count=expired_count,
        total_suppliers_count=all_suppliers_count,
        monthly_cost_total=float(monthly_cost_total),
        total_contract_cost=float(total_contract_cost),
        month_invoices_amount=float(month_invoices_amount),
        pending_invoices_count=pending_invoices_count,
        overdue_invoices_count=overdue_invoices_count,
        expiring_contracts=expiring_list[:8],
        upcoming_invoices=upcoming_invoices_list[:12],
    )


# ==========================================================
# 2. FORNECEDORES & CONTATOS
# ==========================================================

@router.get("/suppliers", response_model=List[SupplierResponse], summary="Listar Fornecedores")
def list_suppliers(
    search: Optional[str] = None,
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    query = db.query(Supplier)
    if is_active is not None:
        query = query.filter(Supplier.is_active == is_active)
    if category:
        query = query.filter(Supplier.category == category)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Supplier.trade_name.ilike(term),
                Supplier.corporate_name.ilike(term),
                Supplier.cnpj.ilike(term),
                Supplier.category.ilike(term),
            )
        )

    suppliers = query.order_by(Supplier.trade_name.asc()).all()
    return [_format_supplier_response(s) for s in suppliers]


@router.post("/suppliers", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED, summary="Cadastrar Fornecedor")
def create_supplier(
    payload: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    supplier = Supplier(
        corporate_name=payload.corporate_name.strip(),
        trade_name=payload.trade_name.strip(),
        cnpj=payload.cnpj.strip() if payload.cnpj else None,
        category=payload.category or "Geral",
        support_portal=payload.support_portal,
        address=payload.address,
        notes=payload.notes,
        is_active=payload.is_active,
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)

    if payload.initial_contacts:
        for c in payload.initial_contacts:
            contact = SupplierContact(
                supplier_id=supplier.id,
                name=c.name.strip(),
                role_title=c.role_title,
                contact_type=c.contact_type or "Comercial",
                email=c.email,
                phone=c.phone,
                mobile_whatsapp=c.mobile_whatsapp,
                is_primary=c.is_primary,
                notes=c.notes,
            )
            db.add(contact)
        db.commit()
        db.refresh(supplier)

    return _format_supplier_response(supplier)


@router.get("/suppliers/{supplier_id}", response_model=SupplierResponse, summary="Obter Detalhes do Fornecedor")
def get_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")
    return _format_supplier_response(supplier)


@router.put("/suppliers/{supplier_id}", response_model=SupplierResponse, summary="Atualizar Fornecedor")
def update_supplier(
    supplier_id: int,
    payload: SupplierUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")

    data = payload.model_dump(exclude_unset=True)
    for field, val in data.items():
        setattr(supplier, field, val)

    supplier.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(supplier)
    return _format_supplier_response(supplier)


@router.delete("/suppliers/{supplier_id}", summary="Excluir ou Inativar Fornecedor")
def delete_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")

    if supplier.contracts and len(supplier.contracts) > 0:
        supplier.is_active = False
        db.commit()
        return {"detail": "Fornecedor possui contratos ativos vinculados e foi inativado com sucesso."}

    db.delete(supplier)
    db.commit()
    return {"detail": "Fornecedor removido com sucesso."}


# Contatos de Fornecedor
@router.post("/suppliers/{supplier_id}/contacts", response_model=SupplierContactResponse, summary="Adicionar Contato ao Fornecedor")
def add_supplier_contact(
    supplier_id: int,
    payload: SupplierContactCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")

    if payload.is_primary:
        # Desmarca outros contatos primários
        db.query(SupplierContact).filter(SupplierContact.supplier_id == supplier_id).update({"is_primary": False})

    contact = SupplierContact(
        supplier_id=supplier_id,
        name=payload.name.strip(),
        role_title=payload.role_title,
        contact_type=payload.contact_type or "Comercial",
        email=payload.email,
        phone=payload.phone,
        mobile_whatsapp=payload.mobile_whatsapp,
        is_primary=payload.is_primary,
        notes=payload.notes,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/suppliers/{supplier_id}/contacts/{contact_id}", summary="Remover Contato do Fornecedor")
def delete_supplier_contact(
    supplier_id: int,
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    contact = db.query(SupplierContact).filter(
        SupplierContact.id == contact_id,
        SupplierContact.supplier_id == supplier_id
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contato não encontrado.")
    db.delete(contact)
    db.commit()
    return {"detail": "Contato removido com sucesso."}


# ==========================================================
# 3. CONTRATOS (CRUD + GERAÇÃO AUTOMÁTICA DE PARCELAS)
# ==========================================================

@router.get("/contracts", response_model=List[ContractResponse], summary="Listar Contratos com Filtros")
def list_contracts(
    supplier_id: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    query = db.query(Contract)
    if supplier_id:
        query = query.filter(Contract.supplier_id == supplier_id)

    today = date.today()
    if status_filter:
        s_upper = status_filter.upper()
        if s_upper == "EXPIRING_SOON":
            query = query.filter(
                Contract.end_date >= today,
                Contract.end_date <= today + timedelta(days=60),
                Contract.status != "CANCELLED"
            )
        elif s_upper == "EXPIRED":
            query = query.filter(
                Contract.end_date < today,
                Contract.status != "CANCELLED"
            )
        elif s_upper == "ACTIVE":
            query = query.filter(
                Contract.end_date > today + timedelta(days=60),
                Contract.status == "ACTIVE"
            )
        else:
            query = query.filter(Contract.status == status_filter)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.join(Supplier, Contract.supplier_id == Supplier.id, isouter=True)
        query = query.filter(
            or_(
                Contract.title.ilike(term),
                Contract.contract_number.ilike(term),
                Supplier.trade_name.ilike(term),
                Supplier.corporate_name.ilike(term),
            )
        )

    contracts = query.order_by(Contract.end_date.asc()).all()
    return [_format_contract_response(c) for c in contracts]


@router.post("/contracts", response_model=ContractResponse, status_code=status.HTTP_201_CREATED, summary="Cadastrar Contrato")
def create_contract(
    payload: ContractCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    supplier = db.query(Supplier).filter(Supplier.id == payload.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Fornecedor informado não existe.")

    contract = Contract(
        contract_number=payload.contract_number,
        title=payload.title.strip(),
        supplier_id=payload.supplier_id,
        manager_id=payload.manager_id or current_user.id,
        department_id=payload.department_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        renewal_type=payload.renewal_type or "Automática",
        notice_period_days=payload.notice_period_days or 30,
        monthly_cost=payload.monthly_cost or Decimal("0.00"),
        total_cost=payload.total_cost or (payload.monthly_cost * 12 if payload.monthly_cost else Decimal("0.00")),
        payment_terms=payload.payment_terms or "Boleto Bancário",
        status=payload.status or "ACTIVE",
        notification_emails=payload.notification_emails.strip() if payload.notification_emails else None,
        attachment_path=payload.attachment_path,
        notes=payload.notes,
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)

    # Inclusão de produtos/serviços iniciais
    if payload.services:
        for s in payload.services:
            srv = ContractService(
                contract_id=contract.id,
                name=s.name.strip(),
                service_type=s.service_type or "Serviço Recorrente",
                description=s.description,
                quantity=s.quantity or 1,
                unit=s.unit or "un",
                unit_price=s.unit_price or Decimal("0.00"),
            )
            db.add(srv)
        db.commit()

    # Geração automática opcional de faturas mensais até a data final
    if payload.auto_generate_invoices and payload.monthly_cost > 0:
        cur_date = payload.start_date
        parcel = 1
        while cur_date <= payload.end_date:
            competence_str = f"{cur_date.month:02d}/{cur_date.year}"
            inv = ContractInvoice(
                contract_id=contract.id,
                invoice_number=f"{contract.contract_number or 'CTR'}-{parcel:02d}",
                competence=competence_str,
                due_date=cur_date,
                amount=payload.monthly_cost,
                status="PENDING",
            )
            db.add(inv)
            parcel += 1
            # Avança 1 mês
            if cur_date.month == 12:
                cur_date = date(cur_date.year + 1, 1, min(cur_date.day, 28))
            else:
                cur_date = date(cur_date.year, cur_date.month + 1, min(cur_date.day, 28))
        db.commit()

    db.refresh(contract)
    return _format_contract_response(contract)


@router.get("/contracts/{contract_id}", response_model=ContractResponse, summary="Obter Detalhes do Contrato")
def get_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")
    return _format_contract_response(contract)


@router.put("/contracts/{contract_id}", response_model=ContractResponse, summary="Atualizar Contrato")
def update_contract(
    contract_id: int,
    payload: ContractUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")

    data = payload.model_dump(exclude_unset=True)
    if "notification_emails" in data and data["notification_emails"]:
        data["notification_emails"] = data["notification_emails"].strip()

    for field, val in data.items():
        setattr(contract, field, val)

    contract.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(contract)
    return _format_contract_response(contract)


@router.delete("/contracts/{contract_id}", summary="Excluir Contrato")
def delete_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")
    db.delete(contract)
    db.commit()
    return {"detail": "Contrato excluído com sucesso."}


# ==========================================================
# 4. SERVIÇOS & FATURAS
# ==========================================================

@router.post("/contracts/{contract_id}/services", response_model=ContractServiceResponse, summary="Adicionar Produto/Serviço ao Contrato")
def add_contract_service(
    contract_id: int,
    payload: ContractServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")

    srv = ContractService(
        contract_id=contract_id,
        name=payload.name.strip(),
        service_type=payload.service_type or "Serviço Recorrente",
        description=payload.description,
        quantity=payload.quantity or 1,
        unit=payload.unit or "un",
        unit_price=payload.unit_price or Decimal("0.00"),
    )
    db.add(srv)
    db.commit()
    db.refresh(srv)
    return srv


@router.delete("/contracts/{contract_id}/services/{service_id}", summary="Remover Produto/Serviço")
def delete_contract_service(
    contract_id: int,
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    srv = db.query(ContractService).filter(
        ContractService.id == service_id,
        ContractService.contract_id == contract_id
    ).first()
    if not srv:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")
    db.delete(srv)
    db.commit()
    return {"detail": "Serviço removido com sucesso."}


# Faturas
@router.get("/contracts/{contract_id}/invoices", response_model=List[ContractInvoiceResponse], summary="Listar Faturas do Contrato")
def list_contract_invoices(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")

    today = date.today()
    invoices = db.query(ContractInvoice).filter(ContractInvoice.contract_id == contract_id).order_by(ContractInvoice.due_date.asc()).all()

    return [
        ContractInvoiceResponse(
            id=i.id,
            contract_id=i.contract_id,
            contract_title=contract.title,
            supplier_name=contract.supplier.trade_name if contract.supplier else None,
            invoice_number=i.invoice_number,
            competence=i.competence,
            due_date=i.due_date,
            amount=i.amount,
            paid_at=i.paid_at,
            payment_code=i.payment_code,
            status="OVERDUE" if (i.status == "PENDING" and i.due_date < today) else i.status,
            file_attachment=i.file_attachment,
            notes=i.notes,
            is_overdue=(i.status == "PENDING" and i.due_date < today),
            created_at=i.created_at,
        ) for i in invoices
    ]


@router.post("/contracts/{contract_id}/invoices", response_model=ContractInvoiceResponse, status_code=status.HTTP_201_CREATED, summary="Lançar Fatura no Contrato")
def create_contract_invoice(
    contract_id: int,
    payload: ContractInvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")

    inv = ContractInvoice(
        contract_id=contract_id,
        invoice_number=payload.invoice_number,
        competence=payload.competence,
        due_date=payload.due_date,
        amount=payload.amount,
        payment_code=payload.payment_code,
        status=payload.status or "PENDING",
        file_attachment=payload.file_attachment,
        notes=payload.notes,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)

    today = date.today()
    return ContractInvoiceResponse(
        id=inv.id,
        contract_id=inv.contract_id,
        contract_title=contract.title,
        supplier_name=contract.supplier.trade_name if contract.supplier else None,
        invoice_number=inv.invoice_number,
        competence=inv.competence,
        due_date=inv.due_date,
        amount=inv.amount,
        paid_at=inv.paid_at,
        payment_code=inv.payment_code,
        status="OVERDUE" if (inv.status == "PENDING" and inv.due_date < today) else inv.status,
        file_attachment=inv.file_attachment,
        notes=inv.notes,
        is_overdue=(inv.status == "PENDING" and inv.due_date < today),
        created_at=inv.created_at,
    )


@router.patch("/contracts/invoices/{invoice_id}/pay", response_model=ContractInvoiceResponse, summary="Registrar Pagamento/Baixa da Fatura")
def mark_invoice_as_paid(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    inv = db.query(ContractInvoice).filter(ContractInvoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Fatura não encontrada.")

    inv.status = "PAID"
    inv.paid_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(inv)

    c = inv.contract
    return ContractInvoiceResponse(
        id=inv.id,
        contract_id=inv.contract_id,
        contract_title=c.title if c else None,
        supplier_name=c.supplier.trade_name if c and c.supplier else None,
        invoice_number=inv.invoice_number,
        competence=inv.competence,
        due_date=inv.due_date,
        amount=inv.amount,
        paid_at=inv.paid_at,
        payment_code=inv.payment_code,
        status="PAID",
        file_attachment=inv.file_attachment,
        notes=inv.notes,
        is_overdue=False,
        created_at=inv.created_at,
    )


@router.delete("/contracts/invoices/{invoice_id}", summary="Excluir Fatura")
def delete_contract_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    inv = db.query(ContractInvoice).filter(ContractInvoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Fatura não encontrada.")
    db.delete(inv)
    db.commit()
    return {"detail": "Fatura removida com sucesso."}


# ==========================================================
# 5. DISPARO E PROCESSAMENTO DE ALERTAS DE VENCIMENTO
# ==========================================================

@router.post("/contracts/alerts/trigger", summary="Disparar Alertas de Vencimento de Contratos e Faturas para os E-mails Específicos")
def trigger_contract_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    """
    Verifica contratos vencendo em 60, 30 e 15 dias e faturas vencendo em 7, 2 dias ou hoje.
    Envia alertas estritamente para os e-mails específicos configurados em contract.notification_emails.
    """
    today = date.today()
    contracts = db.query(Contract).filter(Contract.status.in_(["ACTIVE", "EXPIRING_SOON"])).all()
    emails_sent = 0
    notified_items = []

    h_title, h_sub, _ = get_email_header_branding()
    base_url = get_app_base_url()

    for c in contracts:
        days_left = (c.end_date - today).days

        # Determina a lista de e-mails de destino configurados especificamente
        recipients = []
        if c.notification_emails:
            # Separa por vírgula, ponto e vírgula ou quebra de linha
            raw = c.notification_emails.replace(";", ",").replace("\n", ",").split(",")
            recipients = [em.strip() for em in raw if "@" in em.strip()]

        # Fallback: se não tiver e-mails específicos, notifica o gestor ou TI
        if not recipients:
            if c.manager and c.manager.email:
                recipients.append(c.manager.email)
            else:
                recipients.append(get_support_email())

        # 1. Alerta de Vencimento de Contrato (60, 30, 15, 7, 0 dias)
        if days_left in [60, 30, 15, 7, 3, 1, 0] or (days_left < 0 and days_left >= -3):
            subject = f"⚠️ [Alerta TIHFSA] Contrato prestes a vencer: {c.title} ({days_left} dias restantes)"
            if days_left <= 0:
                subject = f"🚨 [URGENTE TIHFSA] Contrato VENCIDO: {c.title}"

            supplier_name = c.supplier.trade_name if c.supplier else "Fornecedor"
            content = f"""
            <p style="font-size: 15px; color: #1e293b; margin-bottom: 12px;">
                Este é um alerta automático para os responsáveis configurados no contrato da TI:
            </p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <tr><td style="padding: 10px; font-weight: bold; width: 140px; color: #475569;">Contrato:</td><td style="padding: 10px; font-weight: bold; color: #0f172a;">{c.title} (#{c.contract_number or c.id})</td></tr>
                <tr><td style="padding: 10px; font-weight: bold; color: #475569;">Fornecedor:</td><td style="padding: 10px; color: #0f172a;">{supplier_name}</td></tr>
                <tr><td style="padding: 10px; font-weight: bold; color: #475569;">Data de Término:</td><td style="padding: 10px; font-weight: bold; color: {'#dc2626' if days_left <= 30 else '#d97706'};">{c.end_date.strftime('%d/%m/%Y')} ({days_left} dias)</td></tr>
                <tr><td style="padding: 10px; font-weight: bold; color: #475569;">Custo Mensal:</td><td style="padding: 10px; color: #0f172a;">R$ {c.monthly_cost:,.2f}</td></tr>
                <tr><td style="padding: 10px; font-weight: bold; color: #475569;">Aviso Prévio:</td><td style="padding: 10px; color: #0f172a;">{c.notice_period_days} dias</td></tr>
            </table>
            <p style="font-size: 13px; color: #64748b;">
                Verifique se o contrato será renovado, aditado ou se requer envio de aviso prévio de cancelamento.
            </p>
            """
            action_btn = f"""
            <a href="{base_url}/admin/contracts" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
                Acessar Painel de Contratos
            </a>
            """
            html = render_bulletproof_email(
                header_title=h_title,
                header_subtitle="Gestão de Contratos e Fornecedores",
                badge_text="AVISO DE VENCIMENTO",
                badge_bg="#fef3c7",
                badge_color="#92400e",
                content_html=content,
                action_html=action_btn,
                footer_text="Notificação enviada aos e-mails específicos configurados no contrato.",
                body_title="Vencimento de Contrato de TI",
            )

            for target in recipients:
                if send_system_email(target, subject, html, notification_type="CONTRACT_EXPIRATION"):
                    emails_sent += 1
            notified_items.append(f"Contrato #{c.id}: {c.title} ({days_left}d)")

        # 2. Alertas de Faturas a Vencer (7, 2, 0 dias)
        for inv in c.invoices or []:
            if inv.status == "PENDING":
                inv_days = (inv.due_date - today).days
                if inv_days in [7, 2, 0]:
                    inv_subject = f"💳 [Alerta Fatura TIHFSA] Vencimento em {inv_days} dias: {c.title} (R$ {inv.amount:,.2f})"
                    if inv_days == 0:
                        inv_subject = f"🚨 [FATURA VENCE HOJE] {c.title} - R$ {inv.amount:,.2f}"

                    inv_content = f"""
                    <p style="font-size: 15px; color: #1e293b; margin-bottom: 12px;">
                        Lembrete de vencimento de fatura de fornecedor de TI:
                    </p>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <tr><td style="padding: 10px; font-weight: bold; width: 140px; color: #475569;">Contrato:</td><td style="padding: 10px; font-weight: bold; color: #0f172a;">{c.title}</td></tr>
                        <tr><td style="padding: 10px; font-weight: bold; color: #475569;">Fornecedor:</td><td style="padding: 10px; color: #0f172a;">{c.supplier.trade_name if c.supplier else 'Fornecedor'}</td></tr>
                        <tr><td style="padding: 10px; font-weight: bold; color: #475569;">Fatura/NF:</td><td style="padding: 10px; color: #0f172a;">{inv.invoice_number or 'Sem número'} ({inv.competence or ''})</td></tr>
                        <tr><td style="padding: 10px; font-weight: bold; color: #475569;">Vencimento:</td><td style="padding: 10px; font-weight: bold; color: #dc2626;">{inv.due_date.strftime('%d/%m/%Y')}</td></tr>
                        <tr><td style="padding: 10px; font-weight: bold; color: #475569;">Valor:</td><td style="padding: 10px; font-weight: bold; color: #16a34a;">R$ {inv.amount:,.2f}</td></tr>
                        {f'<tr><td style="padding: 10px; font-weight: bold; color: #475569;">Linha/PIX:</td><td style="padding: 10px; font-family: monospace; font-size: 11px; color: #0f172a;">{inv.payment_code}</td></tr>' if inv.payment_code else ''}
                    </table>
                    """
                    inv_action = f"""
                    <a href="{base_url}/admin/contracts" style="background-color: #16a34a; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
                        Ver Faturas no Sistema
                    </a>
                    """
                    inv_html = render_bulletproof_email(
                        header_title=h_title,
                        header_subtitle="Gestão Financeira de TI",
                        badge_text="FATURA A VENCER",
                        badge_bg="#dcfce7",
                        badge_color="#15803d",
                        content_html=inv_content,
                        action_html=inv_action,
                        footer_text="Notificação enviada aos e-mails específicos configurados no contrato.",
                        body_title="Vencimento de Fatura de TI",
                    )
                    for target in recipients:
                        if send_system_email(target, inv_subject, inv_html, notification_type="INVOICE_DUE"):
                            emails_sent += 1
                    notified_items.append(f"Fatura {inv.invoice_number or inv.id} do Contrato #{c.id}")

    return {
        "status": "success",
        "emails_dispatched": emails_sent,
        "notified_items": notified_items,
        "detail": f"{emails_sent} e-mail(s) de alerta enviado(s) com sucesso para os e-mails específicos dos contratos."
    }


# ==========================================================
# 6. UPLOAD DE DOCUMENTOS (CONTRATO E FATURAS)
# ==========================================================

UPLOAD_CONTRACTS_DIR = os.path.join("uploads", "contracts")
UPLOAD_INVOICES_DIR = os.path.join("uploads", "invoices")
os.makedirs(UPLOAD_CONTRACTS_DIR, exist_ok=True)
os.makedirs(UPLOAD_INVOICES_DIR, exist_ok=True)


@router.post("/contracts/{contract_id}/upload", response_model=ContractResponse, summary="Upload de Documento/PDF do Contrato")
async def upload_contract_document(
    contract_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")

    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".pdf"
    if ext not in [".pdf", ".doc", ".docx", ".jpg", ".png", ".webp"]:
        raise HTTPException(status_code=400, detail="Formato não suportado. Utilize PDF, DOC, DOCX ou Imagem.")

    unique_name = f"contract_{contract_id}_{uuid.uuid4().hex[:8]}{ext}"
    dest_path = os.path.join(UPLOAD_CONTRACTS_DIR, unique_name)

    content = await file.read()
    with open(dest_path, "wb") as f:
        f.write(content)

    contract.attachment_path = f"/uploads/contracts/{unique_name}"
    contract.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(contract)
    return _format_contract_response(contract)


@router.post("/contracts/invoices/{invoice_id}/upload", response_model=ContractInvoiceResponse, summary="Upload de Boleto ou Nota Fiscal da Fatura")
async def upload_invoice_document(
    invoice_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    invoice = db.query(ContractInvoice).filter(ContractInvoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Fatura não encontrada.")

    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".pdf"
    if ext not in [".pdf", ".xml", ".jpg", ".png", ".webp"]:
        raise HTTPException(status_code=400, detail="Formato não suportado. Utilize PDF, XML ou Imagem.")

    unique_name = f"invoice_{invoice_id}_{uuid.uuid4().hex[:8]}{ext}"
    dest_path = os.path.join(UPLOAD_INVOICES_DIR, unique_name)

    content = await file.read()
    with open(dest_path, "wb") as f:
        f.write(content)

    invoice.file_attachment = f"/uploads/invoices/{unique_name}"
    db.commit()
    db.refresh(invoice)

    c = invoice.contract
    today = date.today()
    return ContractInvoiceResponse(
        id=invoice.id,
        contract_id=invoice.contract_id,
        contract_title=c.title if c else None,
        supplier_name=c.supplier.trade_name if c and c.supplier else None,
        invoice_number=invoice.invoice_number,
        competence=invoice.competence,
        due_date=invoice.due_date,
        amount=invoice.amount,
        paid_at=invoice.paid_at,
        payment_code=invoice.payment_code,
        status="OVERDUE" if (invoice.status == "PENDING" and invoice.due_date < today) else invoice.status,
        file_attachment=invoice.file_attachment,
        notes=invoice.notes,
        is_overdue=(invoice.status == "PENDING" and invoice.due_date < today),
        created_at=invoice.created_at,
    )


@router.get("/contracts/invoices/all", response_model=List[ContractInvoiceResponse], summary="Listagem Geral de Todas as Faturas")
def list_all_invoices(
    status_filter: Optional[str] = Query(None, alias="status"),
    competence: Optional[str] = None,
    supplier_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    today = date.today()
    query = db.query(ContractInvoice).join(Contract, ContractInvoice.contract_id == Contract.id)

    if supplier_id:
        query = query.filter(Contract.supplier_id == supplier_id)

    if competence:
        query = query.filter(ContractInvoice.competence == competence)

    if status_filter:
        s_upper = status_filter.upper()
        if s_upper == "OVERDUE":
            query = query.filter(ContractInvoice.status == "PENDING", ContractInvoice.due_date < today)
        elif s_upper == "PENDING":
            query = query.filter(ContractInvoice.status == "PENDING", ContractInvoice.due_date >= today)
        else:
            query = query.filter(ContractInvoice.status == status_filter)

    invoices = query.order_by(ContractInvoice.due_date.asc()).all()

    return [
        ContractInvoiceResponse(
            id=i.id,
            contract_id=i.contract_id,
            contract_title=i.contract.title if i.contract else None,
            supplier_name=i.contract.supplier.trade_name if i.contract and i.contract.supplier else None,
            invoice_number=i.invoice_number,
            competence=i.competence,
            due_date=i.due_date,
            amount=i.amount,
            paid_at=i.paid_at,
            payment_code=i.payment_code,
            status="OVERDUE" if (i.status == "PENDING" and i.due_date < today) else i.status,
            file_attachment=i.file_attachment,
            notes=i.notes,
            is_overdue=(i.status == "PENDING" and i.due_date < today),
            created_at=i.created_at,
        ) for i in invoices
    ]

