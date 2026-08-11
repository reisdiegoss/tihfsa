"""
Router Sync — sincronização com Active Directory.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import require_admin
from app.models.user import User
from app.services.ad_sync import sync_active_directory

router = APIRouter(prefix="/api/v1/sync", tags=["Sincronização AD"])


@router.post("/ad")
def sync_ad(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Executa sincronização completa com o Active Directory.
    Importa usuários, setores e hierarquia de gestores.
    Requer role ADMIN.
    """
    report = sync_active_directory(db)
    return {
        "message": "Sincronização concluída",
        "report": report,
    }
