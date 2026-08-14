"""
Router para Gerenciamento Dinâmico de Tipos de Equipamento e Campos Personalizados.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.asset_type import AssetTypeModel
from app.models.user import User
from app.auth.dependencies import require_admin, require_technician
from app.schemas.asset_type import (
    AssetTypeCreate,
    AssetTypeResponse,
    AssetTypeUpdate,
)

router = APIRouter(prefix="/api/v1/asset-types", tags=["Asset Types"])


@router.get("", response_model=list[AssetTypeResponse])
@router.get("/", response_model=list[AssetTypeResponse])
def list_asset_types(
    active_only: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Lista todos os tipos de equipamentos ativos e seus campos personalizados."""
    query = db.query(AssetTypeModel)
    if active_only:
        query = query.filter(AssetTypeModel.is_active == True)  # noqa: E712
    return query.order_by(AssetTypeModel.name).all()


@router.post("", response_model=AssetTypeResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=AssetTypeResponse, status_code=status.HTTP_201_CREATED)
def create_asset_type(
    type_data: AssetTypeCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Cria um novo tipo de equipamento com campos personalizados."""
    existing = db.query(AssetTypeModel).filter(
        AssetTypeModel.name.ilocate(type_data.name) if hasattr(AssetTypeModel.name, "ilocate")
        else AssetTypeModel.name.ilike(type_data.name)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de equipamento '{type_data.name}' já está cadastrado."
        )

    # Converter pydantic models para dicts
    fields_list = [f.model_dump() for f in type_data.custom_fields]

    new_type = AssetTypeModel(
        name=type_data.name.strip(),
        icon=type_data.icon or "Server",
        description=type_data.description,
        custom_fields=fields_list,
        is_active=True
    )
    db.add(new_type)
    db.commit()
    db.refresh(new_type)
    return new_type


@router.put("/{type_id}", response_model=AssetTypeResponse)
def update_asset_type(
    type_id: int,
    type_data: AssetTypeUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Atualiza um tipo de equipamento existente."""
    asset_type = db.query(AssetTypeModel).filter(AssetTypeModel.id == type_id).first()
    if not asset_type:
        raise HTTPException(status_code=404, detail="Tipo de equipamento não encontrado.")

    if type_data.name and type_data.name.strip().lower() != asset_type.name.lower():
        dup = db.query(AssetTypeModel).filter(
            AssetTypeModel.name.ilike(type_data.name.strip()),
            AssetTypeModel.id != type_id
        ).first()
        if dup:
            raise HTTPException(status_code=400, detail=f"Já existe outro tipo de equipamento chamado '{type_data.name}'.")
        asset_type.name = type_data.name.strip()

    if type_data.icon is not None:
        asset_type.icon = type_data.icon
    if type_data.description is not None:
        asset_type.description = type_data.description
    if type_data.is_active is not None:
        asset_type.is_active = type_data.is_active
    if type_data.custom_fields is not None:
        asset_type.custom_fields = [f.model_dump() for f in type_data.custom_fields]

    db.commit()
    db.refresh(asset_type)
    return asset_type


@router.post("/{type_id}/duplicate", response_model=AssetTypeResponse, status_code=status.HTTP_201_CREATED)
def duplicate_asset_type(
    type_id: int,
    new_name: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Duplica um tipo de equipamento existente com todos os seus campos personalizados."""
    original = db.query(AssetTypeModel).filter(AssetTypeModel.id == type_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Tipo de equipamento original não encontrado.")

    target_name = (new_name or f"{original.name} (Cópia)").strip()
    
    # Garantir nome único
    counter = 1
    final_name = target_name
    while db.query(AssetTypeModel).filter(AssetTypeModel.name.ilike(final_name)).first():
        counter += 1
        final_name = f"{target_name} ({counter})"

    # Copiar profundamente a lista de campos personalizados
    copied_fields = []
    if original.custom_fields:
        for f in original.custom_fields:
            if isinstance(f, dict):
                copied_fields.append(dict(f))

    duplicated_type = AssetTypeModel(
        name=final_name,
        icon=original.icon or "Server",
        description=f"Cópia de {original.name}",
        custom_fields=copied_fields,
        is_active=True
    )
    db.add(duplicated_type)
    db.commit()
    db.refresh(duplicated_type)
    return duplicated_type


@router.delete("/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset_type(
    type_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Desativa um tipo de equipamento."""
    asset_type = db.query(AssetTypeModel).filter(AssetTypeModel.id == type_id).first()
    if not asset_type:
        raise HTTPException(status_code=404, detail="Tipo de equipamento não encontrado.")

    asset_type.is_active = False
    db.commit()
    return None
