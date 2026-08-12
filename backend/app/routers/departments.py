"""
Router Departments — CRUD de departamentos/setores do hotel.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.department import Department


class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    ad_ou_dn: str | None = None
    is_active: bool


router = APIRouter(prefix="/api/v1/departments", tags=["Departamentos"])


@router.get("/", response_model=list[DepartmentResponse])
def list_departments(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lista todos os departamentos ativos."""
    return db.query(Department).filter(Department.is_active == True).order_by(Department.name).all()  # noqa: E712
