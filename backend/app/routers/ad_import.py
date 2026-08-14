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


class SingleUserImportRequest(BaseModel):
    username: str
    ou_dn: str


@router.get("/ous")
def get_ous(_: User = Depends(require_technician)):
    """Lista as OUs disponíveis no AD."""
    return list_ad_ous()


@router.get("/ous/users")
def get_ou_users(
    ou_dn: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Lista os usuários contidos em uma OU específica do AD com flag de importado."""
    from app.services.ad_sync import list_ad_users_in_ou
    return list_ad_users_in_ou(db, ou_dn)


@router.post("/import-user")
def import_single_user(
    data: SingleUserImportRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Importa ou atualiza um único usuário do Active Directory."""
    from app.services.ad_sync import import_single_user_from_ad
    user = import_single_user_from_ad(db, username=data.username, ou_dn=data.ou_dn)
    return {
        "message": f"Usuário {user.display_name} importado com sucesso!",
        "user": {
            "id": user.id,
            "username": user.ad_username,
            "display_name": user.display_name,
            "email": user.email,
        }
    }


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


@router.post("/reset")
def reset_ad_data(
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Zera e limpa setores e usuários importados do AD para permitir re-testar do zero."""
    from app.models.department import Department
    from app.models.asset import Asset
    from app.models.ticket import Ticket
    from app.config import settings

    # 1. Obter usuário admin root
    admin = db.query(User).filter(User.ad_username == settings.admin_username).first()
    admin_id = admin.id if admin else 1

    # 2. Desvincular ativos de usuários
    db.query(Asset).update({Asset.assigned_user_id: None})

    # 3. Reatribuir chamados de requisições para o admin root para não quebrar FKs
    db.query(Ticket).filter(Ticket.requester_id != admin_id).update({Ticket.requester_id: admin_id})
    db.query(Ticket).filter(Ticket.technician_id != admin_id).update({Ticket.technician_id: None})

    # 4. Desvincular departamentos e gestores dos usuários
    db.query(User).update({User.department_id: None, User.manager_id: None})
    
    # 5. Remover usuários importados do AD (mantendo o admin root local e apartamentos)
    deleted_users = db.query(User).filter(
        User.ad_username.isnot(None),
        User.id != admin_id,
        User.is_room == False
    ).delete(synchronize_session=False)

    # 6. Remover todos os setores
    depts_deleted = db.query(Department).delete(synchronize_session=False)
    
    db.commit()
    return {
        "message": "Dados do AD resetados com sucesso! Você pode iniciar a importação do zero.", 
        "departments_deleted": depts_deleted,
        "users_deleted": deleted_users
    }
