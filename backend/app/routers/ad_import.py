"""
Router AD Import — interface para a tela de importação de OUs.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.auth.dependencies import require_technician
from app.models.user import User
from app.services.ad_sync import list_ad_ous, sync_active_directory

router = APIRouter(prefix="/api/v1/ad", tags=["AD Import"])


class OUSyncRequest(BaseModel):
    ous: list[str]


@router.get("/ous")
def get_ous(_: User = Depends(require_technician)):
    """Lista as OUs disponíveis no AD."""
    return list_ad_ous()


@router.get("/ous/users")
def get_ou_users(ou_dn: str, _: User = Depends(require_technician)):
    """Lista os usuários contidos em uma OU específica do AD."""
    from app.services.ad_sync import list_ad_users_in_ou
    return list_ad_users_in_ou(ou_dn)


@router.post("/import-departments")
def import_departments_only(
    data: OUSyncRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Importa/cadastra apenas os Setores/OUs selecionados."""
    from app.services.ad_sync import import_ad_departments
    report = import_ad_departments(db, target_ous=data.ous)
    return {
        "message": "Setores importados com sucesso",
        "report": report,
    }


@router.post("/import")
def import_from_ous(
    data: OUSyncRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Sincroniza setores e usuários das OUs enviadas pelo frontend."""
    report = sync_active_directory(db, target_ous=data.ous)
    return {
        "message": "Importação concluída",
        "report": report,
    }
