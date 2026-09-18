"""
Router QRCodes — Emissão e gerenciamento de QR Codes para Equipamentos e redes Wi-Fi de eventos.
"""
import os
import uuid
import shutil
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.qrcode import QRCodeItem, QRCodeConfig
from app.models.asset import Asset

router = APIRouter(prefix="/api/v1/qrcodes", tags=["QR Codes"])

UPLOAD_LOGOS_DIR = os.path.join("uploads", "qrcodes", "logos")
os.makedirs(UPLOAD_LOGOS_DIR, exist_ok=True)


# ==========================================
# Pydantic Schemas
# ==========================================

class QRCodeCreate(BaseModel):
    type: str = "equipment"  # "equipment" | "wifi"
    encode_mode: Optional[str] = "text"  # "text" (Bloco de Notas/Texto puro) | "url" (Link Web)
    title: str
    company: Optional[str] = "Hotel Fasano Salvador"

    # Wi-Fi
    ssid: Optional[str] = None
    password: Optional[str] = None
    security_type: Optional[str] = "WPA"  # WPA, WEP, nopass
    is_hidden: Optional[bool] = False

    # Equipamento
    collaborator: Optional[str] = None
    asset_name: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    address: Optional[str] = None
    message: Optional[str] = None
    asset_id: Optional[int] = None

    # Visual
    logo_url: Optional[str] = None
    include_logo: Optional[bool] = True


class QRCodeUpdate(BaseModel):
    title: Optional[str] = None
    encode_mode: Optional[str] = None
    company: Optional[str] = None

    # Wi-Fi
    ssid: Optional[str] = None
    password: Optional[str] = None
    security_type: Optional[str] = None
    is_hidden: Optional[bool] = None

    # Equipamento
    collaborator: Optional[str] = None
    asset_name: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    address: Optional[str] = None
    message: Optional[str] = None
    asset_id: Optional[int] = None

    # Visual
    logo_url: Optional[str] = None
    include_logo: Optional[bool] = None


class QRCodeResponse(BaseModel):
    id: int
    code: str
    type: str
    encode_mode: Optional[str] = "text"
    title: str
    company: Optional[str] = None

    ssid: Optional[str] = None
    password: Optional[str] = None
    security_type: Optional[str] = "WPA"
    is_hidden: Optional[bool] = False

    collaborator: Optional[str] = None
    asset_name: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    address: Optional[str] = None
    message: Optional[str] = None
    asset_id: Optional[int] = None

    logo_url: Optional[str] = None
    include_logo: bool = True

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None

    class Config:
        from_attributes = True


def _format_item(item: QRCodeItem) -> dict:
    return {
        "id": item.id,
        "code": item.code,
        "type": item.type,
        "encode_mode": getattr(item, "encode_mode", "text") or "text",
        "title": item.title,
        "company": item.company,
        "ssid": item.ssid,
        "password": item.password,
        "security_type": item.security_type,
        "is_hidden": item.is_hidden,
        "collaborator": item.collaborator,
        "asset_name": item.asset_name,
        "brand": item.brand,
        "model": item.model,
        "address": item.address,
        "message": item.message,
        "asset_id": item.asset_id,
        "logo_url": item.logo_url,
        "include_logo": item.include_logo if item.include_logo is not None else True,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "created_by_id": item.created_by_id,
        "created_by_name": item.created_by.display_name if item.created_by else None,
    }


# ==========================================
# Endpoints de Gestão (Requer Autenticação)
# ==========================================

@router.get("/", summary="Listar todos os QR Codes cadastrados")
def list_qrcodes(
    type: Optional[str] = Query(None, description="Filtrar por tipo: equipment ou wifi"),
    search: Optional[str] = Query(None, description="Termo de busca"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(QRCodeItem)

    if type and type in ["equipment", "wifi"]:
        query = query.filter(QRCodeItem.type == type)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (QRCodeItem.title.ilike(search_pattern)) |
            (QRCodeItem.company.ilike(search_pattern)) |
            (QRCodeItem.collaborator.ilike(search_pattern)) |
            (QRCodeItem.asset_name.ilike(search_pattern)) |
            (QRCodeItem.ssid.ilike(search_pattern)) |
            (QRCodeItem.code.ilike(search_pattern))
        )

    total = query.count()
    items = query.order_by(QRCodeItem.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "total": total,
        "items": [_format_item(i) for i in items]
    }


@router.post("/", summary="Cadastrar novo QR Code")
def create_qrcode(
    payload: QRCodeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Gerar código único curto e amigável
    code = f"QR-{uuid.uuid4().hex[:6].upper()}"
    while db.query(QRCodeItem).filter(QRCodeItem.code == code).first():
        code = f"QR-{uuid.uuid4().hex[:6].upper()}"

    # Se logo_url não foi informada, buscar logo padrão se configurada
    logo_url = payload.logo_url
    if not logo_url and payload.include_logo:
        cfg = db.query(QRCodeConfig).first()
        if cfg and cfg.default_logo_url:
            logo_url = cfg.default_logo_url

    item = QRCodeItem(
        code=code,
        type=payload.type,
        encode_mode=payload.encode_mode or "text",
        title=payload.title,
        company=payload.company or "Hotel Fasano Salvador",
        ssid=payload.ssid,
        password=payload.password,
        security_type=payload.security_type or "WPA",
        is_hidden=payload.is_hidden or False,
        collaborator=payload.collaborator,
        asset_name=payload.asset_name,
        brand=payload.brand,
        model=payload.model,
        address=payload.address,
        message=payload.message,
        asset_id=payload.asset_id,
        logo_url=logo_url,
        include_logo=payload.include_logo if payload.include_logo is not None else True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        created_by_id=current_user.id,
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return _format_item(item)


@router.get("/logo", summary="Obter logo central padrão ativa")
def get_qrcode_logo(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cfg = db.query(QRCodeConfig).first()
    return {
        "default_logo_url": cfg.default_logo_url if cfg else None
    }


@router.post("/logo", summary="Upload de PNG da logo da empresa para o centro do QR Code")
async def upload_qrcode_logo(
    file: UploadFile = File(...),
    set_as_default: bool = Query(True, description="Definir esta logo como padrão para novos QR Codes"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    valid_extensions = [".png", ".jpg", ".jpeg", ".webp", ".svg"]
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in valid_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato inválido. Por favor envie uma imagem PNG transparente, JPEG, WebP ou SVG."
        )

    unique_filename = f"logo_{uuid.uuid4().hex[:8]}{ext}"
    dest_path = os.path.join(UPLOAD_LOGOS_DIR, unique_filename)

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    web_path = f"/uploads/qrcodes/logos/{unique_filename}"

    if set_as_default:
        cfg = db.query(QRCodeConfig).first()
        if not cfg:
            cfg = QRCodeConfig(default_logo_url=web_path)
            db.add(cfg)
        else:
            cfg.default_logo_url = web_path
            cfg.updated_at = datetime.now(timezone.utc)
        db.commit()

    return {
        "message": "Logo cadastrada com sucesso",
        "logo_url": web_path,
        "is_default": set_as_default
    }


@router.get("/{id}", summary="Obter dados de um QR Code")
def get_qrcode(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(QRCodeItem).filter(QRCodeItem.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="QR Code não encontrado")
    return _format_item(item)


@router.put("/{id}", summary="Editar/Alterar dados de um QR Code")
def update_qrcode(
    id: int,
    payload: QRCodeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(QRCodeItem).filter(QRCodeItem.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="QR Code não encontrado")

    data = payload.dict(exclude_unset=True)
    for field, val in data.items():
        setattr(item, field, val)

    item.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)

    return _format_item(item)


@router.delete("/{id}", summary="Excluir QR Code")
def delete_qrcode(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(QRCodeItem).filter(QRCodeItem.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="QR Code não encontrado")

    db.delete(item)
    db.commit()

    return {"message": "QR Code excluído com sucesso", "id": id}


# ==========================================
# Endpoint Público (Câmera de Celular / iOS / Android)
# Sem necessidade de login!
# ==========================================

@router.get("/public/{code}", summary="Consulta pública da ficha do equipamento via QR Code")
def get_public_qrcode(
    code: str,
    db: Session = Depends(get_db),
):
    item = db.query(QRCodeItem).filter(QRCodeItem.code == code).first()
    if not item:
        raise HTTPException(status_code=404, detail="Registro de equipamento ou QR Code não localizado")

    # Retorna apenas dados públicos seguros para exibição
    return {
        "code": item.code,
        "type": item.type,
        "title": item.title,
        "company": item.company or "Hotel Fasano Salvador",
        "collaborator": item.collaborator,
        "asset_name": item.asset_name,
        "brand": item.brand,
        "model": item.model,
        "address": item.address,
        "message": item.message,
        "logo_url": item.logo_url,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }
