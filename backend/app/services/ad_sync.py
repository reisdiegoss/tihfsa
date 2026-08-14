"""
Service AD Sync — sincronização de usuários do Active Directory via LDAP.

Permite listar OUs e importar usuários por OU seletivamente.
"""
from ldap3 import Server, Connection, ALL, SUBTREE, LEVEL
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User, UserRole
from app.models.department import Department


def _get_ldap_connection():
    server = Server(settings.ldap_host, port=settings.ldap_port, get_info=ALL)
    conn = Connection(
        server,
        user=settings.ldap_bind_user,
        password=settings.ldap_bind_password,
        auto_bind=True,
    )
    return conn


def list_ad_ous() -> list[dict]:
    """
    Conecta ao AD e retorna uma lista de OUs sob a Base DN.
    """
    try:
        conn = _get_ldap_connection()
    except Exception as e:
        raise ValueError(f"Falha ao conectar no LDAP: {e}")

    search_filter = "(objectClass=organizationalUnit)"
    
    conn.search(
        search_base=settings.ldap_base_dn,
        search_filter=search_filter,
        search_scope=SUBTREE,
        attributes=["ou", "distinguishedName"]
    )

    ous = []
    for entry in conn.entries:
        ous.append({
            "name": str(entry.ou) if entry.ou else str(entry.distinguishedName),
            "dn": str(entry.distinguishedName)
        })

    conn.unbind()
    return ous


def list_ad_users_in_ou(db: Session, ou_dn: str) -> list[dict]:
    """
    Lista os usuários pertencentes a uma OU do Active Directory e indica se já foram importados.
    """
    try:
        conn = _get_ldap_connection()
    except Exception as e:
        raise ValueError(f"Falha ao conectar no LDAP: {e}")

    search_filter = "(&(objectClass=user)(objectCategory=person)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))"
    attributes = [
        "sAMAccountName", "displayName", "mail", "department",
        "title", "telephoneNumber",
    ]

    try:
        conn.search(
            search_base=ou_dn,
            search_filter=search_filter,
            search_scope=SUBTREE,
            attributes=attributes,
        )
        
        imported_usernames = set(
            r[0] for r in db.query(User.ad_username).filter(User.ad_username.isnot(None)).all()
        )

        users = []
        for entry in conn.entries:
            username = str(entry.sAMAccountName) if entry.sAMAccountName else None
            if not username:
                continue
            users.append({
                "username": username,
                "display_name": str(entry.displayName) if entry.displayName else username,
                "email": str(entry.mail) if entry.mail else None,
                "department": str(entry.department) if entry.department else "Geral",
                "title": str(entry.title) if entry.title else None,
                "phone": str(entry.telephoneNumber) if entry.telephoneNumber else None,
                "ou_dn": ou_dn,
                "imported": username in imported_usernames
            })
        conn.unbind()
        return users
    except Exception as e:
        conn.unbind()
        raise ValueError(f"Erro ao buscar usuários da OU {ou_dn}: {e}")


def import_single_user_from_ad(db: Session, username: str, ou_dn: str) -> User:
    """
    Importa ou atualiza um único usuário do Active Directory para o banco local.
    """
    conn = _get_ldap_connection()
    search_filter = f"(&(objectClass=user)(objectCategory=person)(sAMAccountName={username}))"
    attributes = ["sAMAccountName", "displayName", "mail", "department", "telephoneNumber"]
    
    conn.search(search_base=ou_dn, search_filter=search_filter, search_scope=SUBTREE, attributes=attributes)
    if not conn.entries:
        conn.unbind()
        raise ValueError(f"Usuário {username} não encontrado no AD.")
        
    entry = conn.entries[0]
    dept_name = str(entry.department) if entry.department else "Geral"
    
    # 1. Garantir departamento
    dept = db.query(Department).filter(Department.ad_ou_dn == ou_dn).first()
    if not dept:
        dept = db.query(Department).filter(func.lower(Department.name) == dept_name.lower()).first()
    if not dept:
        dept = Department(name=dept_name, ad_ou_dn=ou_dn, is_active=True)
        db.add(dept)
        db.commit()

    # 2. Criar ou atualizar usuário
    user = db.query(User).filter(User.ad_username == username).first()
    if not user:
        user = User(
            ad_username=username,
            display_name=str(entry.displayName) if entry.displayName else username,
            email=str(entry.mail) if entry.mail else None,
            department_id=dept.id,
            is_room=False,
            role=UserRole.USER,
            phone=str(entry.telephoneNumber) if entry.telephoneNumber else None,
            is_active=True
        )
        db.add(user)
    else:
        user.display_name = str(entry.displayName) if entry.displayName else username
        if entry.mail:
            user.email = str(entry.mail)
        user.department_id = dept.id
        user.is_active = True
        
    db.commit()
    db.refresh(user)
    conn.unbind()
    return user


def import_ad_departments(db: Session, target_ous: list[str]) -> dict:
    """
    Importa/cadastra apenas os Setores (Departamentos) baseados nas OUs do Active Directory.
    Garante ausência de duplicatas buscando por ad_ou_dn primeiro e por nome em seguida.
    """
    report = {"created": 0, "updated": 0, "errors": []}
    for ou_dn in target_ous:
        try:
            ou_name = ou_dn.split(",")[0].replace("OU=", "").strip()
            if not ou_name:
                continue

            # 1. Buscar por ad_ou_dn
            dept = db.query(Department).filter(Department.ad_ou_dn == ou_dn).first()

            # 2. Se não achou por DN, buscar por nome (insensível a maiúsculas/minúsculas)
            if not dept:
                dept = db.query(Department).filter(
                    func.lower(Department.name) == ou_name.lower()
                ).first()

            if not dept:
                dept = Department(name=ou_name, ad_ou_dn=ou_dn, is_active=True)
                db.add(dept)
                db.commit()
                report["created"] += 1
            else:
                dept.ad_ou_dn = ou_dn
                dept.is_active = True
                db.commit()
                report["updated"] += 1
        except Exception as e:
            db.rollback()
            report["errors"].append(f"Erro ao importar OU {ou_dn}: {e}")
            
    return report


def sync_active_directory(db: Session, target_ous: list[str] = None) -> dict:
    """
    Sincroniza usuários e setores do AD com o banco local.
    Se target_ous for fornecido, importa apenas dessas OUs.
    Retorna relatório: {created, updated, deactivated, errors}.
    """
    report = {"created": 0, "updated": 0, "deactivated": 0, "errors": []}

    try:
        conn = _get_ldap_connection()
    except Exception as e:
        report["errors"].append(f"Falha ao conectar no LDAP: {e}")
        return report

    search_filter = "(&(objectClass=user)(objectCategory=person)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))"
    attributes = [
        "sAMAccountName", "displayName", "mail", "department",
        "manager", "title", "telephoneNumber",
    ]

    bases_to_search = target_ous if target_ous else [settings.ldap_base_dn]
    
    ad_usernames = set()
    ad_users_data = []

    for base_dn in bases_to_search:
        try:
            conn.search(
                search_base=base_dn,
                search_filter=search_filter,
                search_scope=SUBTREE,
                attributes=attributes,
            )
            
            for entry in conn.entries:
                try:
                    username = str(entry.sAMAccountName) if entry.sAMAccountName else None
                    if not username:
                        continue

                    ad_usernames.add(username)
                    dept_name = str(entry.department) if entry.department else "Geral"
                    
                    ad_users_data.append({
                        "username": username,
                        "display_name": str(entry.displayName) if entry.displayName else username,
                        "email": str(entry.mail) if entry.mail else None,
                        "department": dept_name,
                        "ou_dn": base_dn,
                        "manager_dn": str(entry.manager) if entry.manager else None,
                        "phone": str(entry.telephoneNumber) if entry.telephoneNumber else None,
                    })
                except Exception as e:
                    report["errors"].append(f"Erro ao processar entry: {e}")
        except Exception as e:
            report["errors"].append(f"Erro ao buscar na OU {base_dn}: {e}")

    conn.unbind()

    # Mapear departamentos (sem criar duplicatas)
    dept_map = {}
    for data in ad_users_data:
        dept_name = data["department"]
        ou_dn = data["ou_dn"]
        
        dept = db.query(Department).filter(Department.ad_ou_dn == ou_dn).first()
        if not dept:
            dept = db.query(Department).filter(
                func.lower(Department.name) == dept_name.lower()
            ).first()
            
        if not dept:
            dept = Department(name=dept_name, ad_ou_dn=ou_dn, is_active=True)
            db.add(dept)
            db.commit()
        else:
            dept.ad_ou_dn = ou_dn
            dept.is_active = True
            db.commit()
        
        dept_map[dept_name] = dept.id

    # Criar/atualizar usuários
    for data in ad_users_data:
        user = db.query(User).filter(User.ad_username == data["username"]).first()
        if user:
            user.display_name = data["display_name"]
            user.email = data["email"]
            user.phone = data["phone"]
            user.department_id = dept_map.get(data["department"])
            user.is_active = True
            report["updated"] += 1
        else:
            user = User(
                ad_username=data["username"],
                display_name=data["display_name"],
                email=data["email"],
                phone=data["phone"],
                department_id=dept_map.get(data["department"]),
                role=UserRole.USER,
                is_room=False,
                is_active=True,
            )
            db.add(user)
            db.flush()
            report["created"] += 1

    # Resolver hierarquia de gestores (segunda passada)
    for data in ad_users_data:
        if data["manager_dn"]:
            # Extrair sAMAccountName do DN do manager (CN=Nome,OU=...)
            manager_cn = data["manager_dn"].split(",")[0].replace("CN=", "")
            # Buscar pelo display_name que corresponda
            manager = db.query(User).filter(User.display_name == manager_cn).first()
            if manager:
                user = db.query(User).filter(User.ad_username == data["username"]).first()
                if user:
                    user.manager_id = manager.id

                    # Se é gestor de alguém, atualizar role
                    if manager.role == UserRole.USER:
                        manager.role = UserRole.MANAGER

    # Se a sincronização for parcial (target_ous), não desativamos os outros usuários
    if not target_ous:
        db_users = db.query(User).filter(
            User.ad_username.isnot(None),
            User.is_room == False,  # noqa: E712
            User.ad_username != settings.admin_username,
        ).all()

        for user in db_users:
            if user.ad_username not in ad_usernames:
                user.is_active = False
                report["deactivated"] += 1

    db.commit()
    return report
