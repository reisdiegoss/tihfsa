"""
Router SLA — Parametrização e regras de SLA do Helpdesk.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.sla import SLAConfig, SLACategoryRule
from app.services.sla_service import get_or_create_sla_config

router = APIRouter(prefix="/api/v1/sla", tags=["SLA"])


class SLACategoryRuleSchema(BaseModel):
    id: Optional[int] = None
    category_id: int
    category_name: Optional[str] = None
    response_min: Optional[int] = None
    resolution_min: int


class SLAConfigUpdate(BaseModel):
    calc_business_hours: bool = False
    business_start_time: str = Field(default="08:00", pattern=r"^\d{2}:\d{2}$")
    business_end_time: str = Field(default="18:00", pattern=r"^\d{2}:\d{2}$")
    business_days: str = "mon,tue,wed,thu,fri"
    enable_category_sla: bool = False

    critical_response_min: int = Field(default=15, ge=1)
    critical_resolution_min: int = Field(default=120, ge=1)
    high_response_min: int = Field(default=60, ge=1)
    high_resolution_min: int = Field(default=240, ge=1)
    medium_response_min: int = Field(default=120, ge=1)
    medium_resolution_min: int = Field(default=480, ge=1)
    low_response_min: int = Field(default=240, ge=1)
    low_resolution_min: int = Field(default=1440, ge=1)
    warning_threshold_percent: int = Field(default=75, ge=10, le=95)


@router.get("/config", summary="Obter parâmetros de SLA ativos")
def get_sla_config_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = get_or_create_sla_config(db)
    category_rules = db.query(SLACategoryRule).all()

    rules_data = [
        {
            "id": r.id,
            "category_id": r.category_id,
            "category_name": r.category.name if r.category else "—",
            "response_min": r.response_min,
            "resolution_min": r.resolution_min,
        }
        for r in category_rules
    ]

    return {
        "config": {
            "calc_business_hours": config.calc_business_hours,
            "business_start_time": config.business_start_time,
            "business_end_time": config.business_end_time,
            "business_days": config.business_days,
            "enable_category_sla": config.enable_category_sla,
            "critical_response_min": config.critical_response_min,
            "critical_resolution_min": config.critical_resolution_min,
            "high_response_min": config.high_response_min,
            "high_resolution_min": config.high_resolution_min,
            "medium_response_min": config.medium_response_min,
            "medium_resolution_min": config.medium_resolution_min,
            "low_response_min": config.low_response_min,
            "low_resolution_min": config.low_resolution_min,
            "warning_threshold_percent": config.warning_threshold_percent,
            "updated_at": config.updated_at.isoformat() if config.updated_at else None,
        },
        "category_rules": rules_data,
    }


@router.put("/config", summary="Salvar parâmetros de SLA (Admin apenas)")
def update_sla_config_endpoint(
    payload: SLAConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administradores podem alterar as diretrizes de SLA do sistema."
        )

    config = get_or_create_sla_config(db)
    for field, val in payload.model_dump().items():
        setattr(config, field, val)

    config.updated_by_id = current_user.id
    db.commit()
    db.refresh(config)

    return {"message": "Diretrizes de SLA atualizadas com sucesso.", "success": True}


@router.post("/category-rules", summary="Criar ou atualizar regra de SLA por categoria")
def set_category_sla_rule_endpoint(
    rule_data: SLACategoryRuleSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administradores podem gerenciar regras de SLA por categoria."
        )

    existing = db.query(SLACategoryRule).filter(SLACategoryRule.category_id == rule_data.category_id).first()
    if existing:
        existing.response_min = rule_data.response_min
        existing.resolution_min = rule_data.resolution_min
    else:
        new_rule = SLACategoryRule(
            category_id=rule_data.category_id,
            response_min=rule_data.response_min,
            resolution_min=rule_data.resolution_min,
        )
        db.add(new_rule)

    db.commit()
    return {"message": "Regra de SLA da categoria salva com sucesso.", "success": True}


@router.delete("/category-rules/{rule_id}", summary="Remover regra de SLA de categoria")
def delete_category_sla_rule_endpoint(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito.")

    rule = db.query(SLACategoryRule).filter(SLACategoryRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Regra de SLA não localizada.")

    db.delete(rule)
    db.commit()
    return {"message": "Regra de categoria removida.", "success": True}
