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
    ou_mappings: dict[str, str] | None = None
    mappings: dict[str, str] | None = None


class SingleUserImportRequest(BaseModel):
    username: str
    ou_dn: str
    target_dept_name: str | None = None


@router.get("/ous")
def get_ous(_: User = Depends(require_technician)):
    """Lista as OUs disponíveis no AD com hierarquia e grupo sugerido."""
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
    """Importa ou atualiza um único usuário do Active Directory com suporte a setor personalizado/pai."""
    from app.services.ad_sync import import_single_user_from_ad
    user = import_single_user_from_ad(
        db,
        username=data.username,
        ou_dn=data.ou_dn,
        target_dept_name=data.target_dept_name,
    )
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
    """Importa/cadastra apenas os Setores/OUs selecionados com mapeamento para grupo/setor."""
    from app.services.ad_sync import import_ad_departments
    mappings = data.ou_mappings or data.mappings
    report = import_ad_departments(db, target_ous=data.ous, ou_mappings=mappings)
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
    """Sincroniza setores e usuários das OUs enviadas pelo frontend com suporte a mapeamento de grupos."""
    mappings = data.ou_mappings or data.mappings
    report = sync_active_directory(db, target_ous=data.ous, ou_mappings=mappings)
    return {
        "message": "Importação concluída",
        "report": report,
    }


@router.post("/reset")
def reset_ad_data(
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """
    Zera e limpa setores e usuários importados do AD protegendo chaves estrangeiras.
    Permite importar tudo novamente do zero com segurança total.
    """
    from app.models.department import Department
    from app.models.asset import Asset
    from app.models.ticket import Ticket
    from app.config import settings
    from sqlalchemy import text

    # 1. Obter usuário admin root
    admin = db.query(User).filter(User.ad_username == settings.admin_username).first()
    admin_id = admin.id if admin else 1

    # 2. Desvincular gestores e departamentos
    db.query(Department).update({Department.manager_id: None})
    try:
        db.execute(text("DELETE FROM department_managers"))
    except Exception:
        pass
    db.query(User).update({User.department_id: None, User.manager_id: None})

    # 3. Identificar IDs de usuários protegidos (que possuem chamados ou interações no sistema)
    protected_user_ids = {admin_id}
    for row in db.execute(text("SELECT requester_id FROM tickets WHERE requester_id IS NOT NULL")).fetchall():
        protected_user_ids.add(row[0])
    for row in db.execute(text("SELECT technician_id FROM tickets WHERE technician_id IS NOT NULL")).fetchall():
        protected_user_ids.add(row[0])
    for row in db.execute(text("SELECT user_id FROM ticket_interactions WHERE user_id IS NOT NULL")).fetchall():
        protected_user_ids.add(row[0])

    # 4. Remover com segurança usuários sem vínculos protegidos
    q_del = db.query(User).filter(
        User.ad_username.isnot(None),
        User.id != admin_id,
        User.is_room == False,
        ~User.id.in_(protected_user_ids)
    )
    deleted_users = q_del.delete(synchronize_session=False)

    # 5. Para os usuários protegidos do AD (com histórico), resetar departamento para permitir remapeamento
    db.query(User).filter(
        User.id.in_(protected_user_ids),
        User.id != admin_id,
        User.is_room == False
    ).update({User.department_id: None, User.manager_id: None}, synchronize_session=False)

    # 6. Remover os setores que foram criados/importados do AD
    depts_deleted = db.query(Department).filter(
        Department.ad_ou_dn.isnot(None)
    ).delete(synchronize_session=False)
    
    db.commit()
    return {
        "message": "Dados do AD resetados com sucesso! Você pode iniciar a importação do zero.", 
        "departments_deleted": depts_deleted,
        "users_deleted": deleted_users,
        "users_preserved": len(protected_user_ids) - 1
    }
