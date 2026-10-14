"""
Router de Termos de Retirada e Responsabilidade de Equipamentos.
Hotel Fasano Salvador — TI Corporativa.
Suporta assinatura digital em tela (signature_pad) e validação biométrica facial (face-api.js).
"""
import base64
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_technician, require_module
from app.database import get_db
from app.models.asset import Asset
from app.models.department import Department
from app.models.term import EquipmentTerm, EquipmentTermItem
from app.models.user import User
from app.schemas.term import (
    DEFAULT_TERMS_LEGAL_TEXT,
    EquipmentTermCreate,
    EquipmentTermItemCreate,
    EquipmentTermItemResponse,
    EquipmentTermResponse,
    EquipmentTermReturnRequest,
    EquipmentTermSignRequest,
    EquipmentTermStats,
    EquipmentTermUpdate,
)

router = APIRouter(prefix="/api/v1/terms", tags=["Equipment Terms"])

# Diretórios para armazenamento das evidências digitais
BASE_UPLOAD_DIR = Path("uploads/terms")
SIGNATURES_DIR = BASE_UPLOAD_DIR / "signatures"
FACIAL_PHOTOS_DIR = BASE_UPLOAD_DIR / "facial_photos"

SIGNATURES_DIR.mkdir(parents=True, exist_ok=True)
FACIAL_PHOTOS_DIR.mkdir(parents=True, exist_ok=True)


def _save_base64_file(data_url: str, target_dir: Path, prefix: str) -> str:
    """
    Decodifica uma string Base64 (data:image/...;base64,...) e grava em disco.
    Retorna a URL relativa para acesso HTTP (/uploads/terms/...).
    """
    if not data_url:
        return None

    ext = "png"
    match = re.match(r"^data:image\/([a-zA-Z0-9\+\-\.]+);base64,(.+)$", data_url)
    if match:
        image_type = match.group(1).lower()
        if "jpeg" in image_type or "jpg" in image_type:
            ext = "jpg"
        elif "png" in image_type:
            ext = "png"
        elif "webp" in image_type:
            ext = "webp"
        encoded_data = match.group(2)
    else:
        encoded_data = data_url

    try:
        raw_bytes = base64.b64decode(encoded_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato Base64 inválido para evidência digital: {e}",
        )

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    unique_suffix = uuid.uuid4().hex[:8]
    filename = f"{prefix}_{timestamp}_{unique_suffix}.{ext}"
    filepath = target_dir / filename

    with open(filepath, "wb") as f:
        f.write(raw_bytes)

    # Converte o caminho para formato web compatível
    relative_path = filepath.as_posix()
    if not relative_path.startswith("/"):
        relative_path = "/" + relative_path
    return relative_path


def _generate_term_number(db: Session) -> str:
    """Gera número sequencial no formato TR-YYYY-XXXX (ex: TR-2026-0001)."""
    current_year = datetime.now().year
    prefix = f"TR-{current_year}-"

    latest_term = (
        db.query(EquipmentTerm)
        .filter(EquipmentTerm.term_number.like(f"{prefix}%"))
        .order_by(desc(EquipmentTerm.id))
        .first()
    )

    if not latest_term:
        seq = 1
    else:
        try:
            parts = latest_term.term_number.split("-")
            seq = int(parts[-1]) + 1
        except Exception:
            seq = db.query(EquipmentTerm).count() + 1

    return f"{prefix}{seq:04d}"


# ==========================================================
# ENDPOINTS
# ==========================================================

@router.get("/stats", response_model=EquipmentTermStats)
def get_terms_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
    _: User = Depends(require_module("terms")),
):
    """Retorna contadores de termos para os cards de estatísticas."""
    total = db.query(EquipmentTerm).count()
    pending = db.query(EquipmentTerm).filter(EquipmentTerm.status == "pending_signature").count()
    signed = db.query(EquipmentTerm).filter(EquipmentTerm.status == "signed").count()
    returned = db.query(EquipmentTerm).filter(EquipmentTerm.status == "returned").count()
    cancelled = db.query(EquipmentTerm).filter(EquipmentTerm.status == "cancelled").count()

    return EquipmentTermStats(
        total=total,
        pending_signature=pending,
        signed=signed,
        returned=returned,
        cancelled=cancelled,
    )


@router.get("", response_model=List[EquipmentTermResponse])
def list_terms(
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    department_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
    _: User = Depends(require_module("terms")),
):
    """
    Lista termos com filtros de status, setor e pesquisa textual por nome, documento ou número.
    """
    query = db.query(EquipmentTerm)

    if status_filter:
        query = query.filter(EquipmentTerm.status == status_filter)

    if department_id:
        query = query.filter(EquipmentTerm.department_id == department_id)

    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                EquipmentTerm.term_number.ilike(search_pattern),
                EquipmentTerm.beneficiary_name.ilike(search_pattern),
                EquipmentTerm.beneficiary_document.ilike(search_pattern),
                EquipmentTerm.department_name.ilike(search_pattern),
                EquipmentTerm.technician_name.ilike(search_pattern),
            )
        )

    terms = query.order_by(desc(EquipmentTerm.id)).offset(skip).limit(limit).all()
    return terms


@router.get("/{term_id}", response_model=EquipmentTermResponse)
def get_term_detail(
    term_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
    _: User = Depends(require_module("terms")),
):
    """Retorna detalhes completos de um termo específico."""
    term = db.query(EquipmentTerm).filter(EquipmentTerm.id == term_id).first()
    if not term:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Termo não encontrado")
    return term


@router.post("", response_model=EquipmentTermResponse, status_code=status.HTTP_201_CREATED)
def create_term(
    term_in: EquipmentTermCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
    _: User = Depends(require_module("terms")),
):
    """
    Cria um novo termo de retirada de equipamentos.
    Suporta colaborador com conta de rede (AD) ou colaborador sem conta de rede (terceiro/novo).
    """
    term_number = _generate_term_number(db)
    technician_name = current_user.display_name or current_user.ad_username

    beneficiary_name = term_in.beneficiary_name.strip()
    department_name = term_in.department_name
    department_id = term_in.department_id
    user_id = term_in.user_id
    has_ad_account = term_in.has_ad_account

    # Se selecionado usuário de rede (AD)
    if term_in.beneficiary_type == "ad_user" and user_id:
        ad_user = db.query(User).filter(User.id == user_id).first()
        if not ad_user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário de rede não encontrado")
        beneficiary_name = ad_user.display_name or ad_user.ad_username
        has_ad_account = True
        if ad_user.department_id and not department_id:
            department_id = ad_user.department_id
            if ad_user.department:
                department_name = ad_user.department.name

    # Se informado department_id mas sem department_name, buscar no banco
    if department_id and not department_name:
        dept = db.query(Department).filter(Department.id == department_id).first()
        if dept:
            department_name = dept.name

    legal_text = (term_in.legal_text or "").strip() or DEFAULT_TERMS_LEGAL_TEXT

    new_term = EquipmentTerm(
        term_number=term_number,
        status="pending_signature",
        term_type=term_in.term_type,
        beneficiary_type=term_in.beneficiary_type,
        user_id=user_id,
        beneficiary_name=beneficiary_name,
        beneficiary_document=term_in.beneficiary_document,
        department_id=department_id,
        department_name=department_name,
        beneficiary_email=term_in.beneficiary_email,
        beneficiary_phone=term_in.beneficiary_phone,
        has_ad_account=has_ad_account,
        technician_id=current_user.id,
        technician_name=technician_name,
        expected_return_date=term_in.expected_return_date,
        legal_text=legal_text,
        notes=term_in.notes,
    )
    db.add(new_term)
    db.flush()

    # Adicionar itens vinculados ao termo
    for item_data in term_in.items:
        # Se associado a um ativo de TI (asset_id), verifica se existe
        if item_data.asset_id:
            asset = db.query(Asset).filter(Asset.id == item_data.asset_id).first()
            if asset:
                if not item_data.asset_tag and asset.asset_tag:
                    item_data.asset_tag = asset.asset_tag
                if not item_data.serial_number and asset.serial_number:
                    item_data.serial_number = asset.serial_number

        term_item = EquipmentTermItem(
            term_id=new_term.id,
            asset_id=item_data.asset_id,
            item_name=item_data.item_name.strip(),
            category=item_data.category or "Periférico / Acessório",
            asset_tag=item_data.asset_tag,
            serial_number=item_data.serial_number,
            quantity=item_data.quantity,
            condition=item_data.condition or "Em perfeito estado de funcionamento",
            accessories=item_data.accessories,
            is_returned=False,
            notes=item_data.notes,
        )
        db.add(term_item)

    db.commit()
    db.refresh(new_term)
    return new_term


@router.put("/{term_id}", response_model=EquipmentTermResponse)
def update_term(
    term_id: int,
    term_in: EquipmentTermUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
    _: User = Depends(require_module("terms")),
):
    """Atualiza dados cadastrais de um termo ainda não assinado."""
    term = db.query(EquipmentTerm).filter(EquipmentTerm.id == term_id).first()
    if not term:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Termo não encontrado")

    if term.status in ("signed", "returned"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Termos já assinados ou devolvidos não podem ter dados fundamentais alterados.",
        )

    update_data = term_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(term, field, val)

    db.commit()
    db.refresh(term)
    return term


@router.post("/{term_id}/sign", response_model=EquipmentTermResponse)
def sign_term(
    term_id: int,
    sign_in: EquipmentTermSignRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
    _: User = Depends(require_module("terms")),
):
    """
    Registra a assinatura digital manuscrita (via signature_pad) e a foto biométrica
    facial (via face-api.js) capturadas no tablet no momento da entrega do equipamento.
    """
    term = db.query(EquipmentTerm).filter(EquipmentTerm.id == term_id).first()
    if not term:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Termo não encontrado")

    if term.status == "signed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Este termo já foi assinado anteriormente.")

    # 1. Salvar imagem da assinatura manuscrita
    signature_url = _save_base64_file(sign_in.signature_data, SIGNATURES_DIR, f"sig_{term.term_number}")

    # 2. Salvar foto facial se fornecida
    facial_photo_url = None
    if sign_in.facial_photo_data:
        facial_photo_url = _save_base64_file(
            sign_in.facial_photo_data, FACIAL_PHOTOS_DIR, f"face_{term.term_number}"
        )

    # 3. Metadados de segurança e auditoria
    client_ip = request.client.host if request.client else None

    term.status = "signed"
    term.signed_at = datetime.now(timezone.utc)
    term.signature_url = signature_url
    term.facial_photo_url = facial_photo_url
    term.facial_verified = sign_in.facial_verified
    term.facial_confidence = sign_in.facial_confidence
    term.signer_ip = client_ip
    term.signer_device = sign_in.signer_device or request.headers.get("user-agent", "Tablet / Navegador")

    db.commit()
    db.refresh(term)
    return term


@router.post("/{term_id}/return", response_model=EquipmentTermResponse)
def return_term_equipment(
    term_id: int,
    return_in: EquipmentTermReturnRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
    _: User = Depends(require_module("terms")),
):
    """
    Registra a devolução dos equipamentos e baixa do termo.
    Permite baixa total ou parcial dos itens.
    """
    term = db.query(EquipmentTerm).filter(EquipmentTerm.id == term_id).first()
    if not term:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Termo não encontrado")

    if term.status not in ("signed", "pending_signature"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Termo não está em estado ativo para devolução.")

    # Marca os itens devolvidos
    if return_in.item_ids:
        for item in term.items:
            if item.id in return_in.item_ids:
                item.is_returned = True
    else:
        for item in term.items:
            item.is_returned = True

    # Verifica se todos os itens foram devolvidos
    all_returned = all(item.is_returned for item in term.items)

    technician_name = current_user.display_name or current_user.ad_username

    if all_returned:
        term.status = "returned"
        term.returned_at = datetime.now(timezone.utc)
        term.return_technician_id = current_user.id
        term.return_technician_name = technician_name
        term.return_condition = return_in.return_condition
        term.return_notes = return_in.return_notes

    db.commit()
    db.refresh(term)
    return term


@router.post("/{term_id}/cancel", response_model=EquipmentTermResponse)
def cancel_term(
    term_id: int,
    reason: Optional[str] = Query(None, description="Motivo do cancelamento"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
    _: User = Depends(require_module("terms")),
):
    """Cancela um termo que não foi assinado ou foi emitido por engano."""
    term = db.query(EquipmentTerm).filter(EquipmentTerm.id == term_id).first()
    if not term:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Termo não encontrado")

    if term.status == "returned":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Termos já devolvidos não podem ser cancelados.")

    term.status = "cancelled"
    if reason:
        term.notes = f"CANCELADO: {reason}\n" + (term.notes or "")

    db.commit()
    db.refresh(term)
    return term
