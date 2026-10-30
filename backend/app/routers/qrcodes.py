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
from app.config import get_app_base_url
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
    type: str = "equipment"  # "equipment" | "wifi" | "url"
    encode_mode: Optional[str] = "url"  # "url" (Página Web Pública fassa29) | "vcard" (Offline)
    title: str
    company: Optional[str] = "Hotel Fasano Salvador"
    url: Optional[str] = None  # URL direta

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
    url: Optional[str] = None

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
    encode_mode: Optional[str] = "vcard"
    title: str
    company: Optional[str] = None
    url: Optional[str] = None

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
    canonical_url = item.url
    if item.type == "equipment" and not canonical_url:
        canonical_url = f"{get_app_base_url()}/qr/{item.code}"

    return {
        "id": item.id,
        "code": item.code,
        "type": item.type,
        "encode_mode": getattr(item, "encode_mode", "url") or "url",
        "title": item.title,
        "company": item.company,
        "url": canonical_url,
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

    if type and type in ["equipment", "wifi", "url"]:
        query = query.filter(QRCodeItem.type == type)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (QRCodeItem.title.ilike(search_pattern)) |
            (QRCodeItem.company.ilike(search_pattern)) |
            (QRCodeItem.collaborator.ilike(search_pattern)) |
            (QRCodeItem.asset_name.ilike(search_pattern)) |
            (QRCodeItem.ssid.ilike(search_pattern)) |
            (QRCodeItem.url.ilike(search_pattern)) |
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

    # Se for QR Code de equipamento e URL não foi informada, vincula à URL pública do fassa29
    url_to_save = payload.url
    if payload.type == "equipment" and not url_to_save:
        url_to_save = f"{get_app_base_url()}/qr/{code}"

    item = QRCodeItem(
        code=code,
        type=payload.type,
        encode_mode=payload.encode_mode or "url",
        title=payload.title,
        company=payload.company or "Hotel Fasano Salvador",
        url=url_to_save,
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

    if item.type == "equipment" and not item.url:
        item.url = f"{get_app_base_url()}/qr/{item.code}"

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
    clean_code = (code or "").strip()
    item = db.query(QRCodeItem).filter(QRCodeItem.code == clean_code).first()

    # Se não encontrar pelo código do QR Code, busca no CMDB por asset_tag ou id
    if not item:
        asset = db.query(Asset).filter(
            (Asset.asset_tag == clean_code) | (Asset.asset_tag.ilike(clean_code))
        ).first()
        if not asset and clean_code.isdigit():
            asset = db.query(Asset).filter(Asset.id == int(clean_code)).first()

        if asset:
            loc_name = asset.location.name if getattr(asset, "location", None) else None
            user_name = asset.assigned_user.display_name if getattr(asset, "assigned_user", None) else None
            return {
                "code": asset.asset_tag or f"AST-{asset.id}",
                "type": "equipment",
                "title": asset.name,
                "company": "Hotel Fasano Salvador",
                "collaborator": user_name,
                "asset_name": asset.name,
                "brand": asset.brand,
                "model": asset.model,
                "address": loc_name,
                "message": "Equipamento cadastrado e monitorado pelo setor de Tecnologia da Informação do Hotel Fasano Salvador.",
                "url": f"{get_app_base_url()}/qr/{asset.asset_tag or asset.id}",
                "logo_url": None,
                "created_at": asset.created_at,
                "updated_at": asset.updated_at,
                "asset_id": asset.id,
                "serial_number": asset.serial_number,
                "ip_address": asset.ip_address,
                "mac_address": asset.mac_address,
                "asset_type": asset.type,
            }

        raise HTTPException(status_code=404, detail="Registro de equipamento ou QR Code não localizado")

    # Se o item possui um ativo associado, enriquece com dados técnicos do CMDB
    asset_obj = item.asset
    serial_number = asset_obj.serial_number if asset_obj else None
    ip_address = asset_obj.ip_address if asset_obj else None
    mac_address = asset_obj.mac_address if asset_obj else None
    asset_type = asset_obj.type if asset_obj else None
    location_name = (asset_obj.location.name if asset_obj and getattr(asset_obj, "location", None) else None) or item.address
    collaborator_name = (asset_obj.assigned_user.display_name if asset_obj and getattr(asset_obj, "assigned_user", None) else None) or item.collaborator

    public_url = item.url or f"{get_app_base_url()}/qr/{item.code}"

    # Retorna ficha técnica completa e segura para exibição pública
    return {
        "code": item.code,
        "type": item.type,
        "title": item.title,
        "company": item.company or "Hotel Fasano Salvador",
        "collaborator": collaborator_name,
        "asset_name": item.asset_name or item.title,
        "brand": item.brand or (asset_obj.brand if asset_obj else None),
        "model": item.model or (asset_obj.model if asset_obj else None),
        "address": location_name,
        "message": item.message or "Em caso de dúvidas, avaria ou perda deste equipamento, contate o Suporte de TI.",
        "url": public_url,
        "logo_url": item.logo_url,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "asset_id": item.asset_id,
        "serial_number": serial_number,
        "ip_address": ip_address,
        "mac_address": mac_address,
        "asset_type": asset_type,
    }
