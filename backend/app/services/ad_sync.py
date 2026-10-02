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


def import_single_user_from_ad(db: Session, username: str, ou_dn: str = None) -> User:
    """
    Importa ou atualiza um único usuário do Active Directory para o banco local.
    Se ou_dn não for informado, pesquisa em toda a base do LDAP e detecta a OU do usuário.
    """
    conn = _get_ldap_connection()
    search_filter = f"(&(objectClass=user)(objectCategory=person)(sAMAccountName={username}))"
    attributes = ["sAMAccountName", "displayName", "mail", "department", "telephoneNumber"]
    
    search_base = ou_dn if ou_dn else settings.ldap_base_dn
    conn.search(search_base=search_base, search_filter=search_filter, search_scope=SUBTREE, attributes=attributes)
    if not conn.entries:
        conn.unbind()
        raise ValueError(f"Usuário {username} não encontrado no AD.")
        
    entry = conn.entries[0]
    
    # 1. Determinar o nome do departamento com precisão
    entry_dn_str = str(entry.entry_dn) if hasattr(entry, "entry_dn") else ""
    ou_name = ""
    for p in (entry_dn_str or search_base).split(","):
        if p.strip().upper().startswith("OU="):
            ou_name = p.split("=", 1)[1].strip()
            break
            
    raw_dept = str(entry.department).strip() if entry.department and str(entry.department).strip() else ""
    dept_name = raw_dept or ou_name or "Geral"
    target_ou_dn = ou_dn or (entry_dn_str.split(",", 1)[1] if "," in entry_dn_str else search_base)
    
    # 2. Garantir departamento correto
    dept = db.query(Department).filter(Department.ad_ou_dn == target_ou_dn).first()
    if not dept and dept_name:
        dept = db.query(Department).filter(func.lower(Department.name) == dept_name.lower()).first()
    if not dept:
        dept = Department(name=dept_name, ad_ou_dn=target_ou_dn, is_active=True)
        db.add(dept)
        db.commit()
    elif not dept.ad_ou_dn and target_ou_dn:
        dept.ad_ou_dn = target_ou_dn
        db.commit()

    # 3. Criar ou atualizar usuário
    user = db.query(User).filter(User.ad_username == username).first()
    if not user:
        user = User(
            ad_username=username,
            display_name=str(entry.displayName) if entry.displayName else username,
            email=str(entry.mail) if entry.mail else None,
            department_id=dept.id if dept else None,
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
        if dept:
            user.department_id = dept.id
        user.is_active = True
        
    db.commit()
    db.refresh(user)
    conn.unbind()
    
    relink_assets_and_checkins_to_users(db)
    return user


def import_ad_departments(db: Session, target_ous: list[str]) -> dict:
    """
    Importa/cadastra apenas os Setores (Departamentos) baseados nas OUs do Active Directory.
    Garante ausência de duplicatas buscando por ad_ou_dn primeiro e por nome em seguida.
    """
    report = {"created": 0, "updated": 0, "errors": []}
    for ou_dn in target_ous:
        try:
            ou_name = ""
            for p in ou_dn.split(","):
                if p.strip().upper().startswith("OU="):
                    ou_name = p.split("=", 1)[1].strip()
                    break
            if not ou_name:
                ou_name = ou_dn.split(",")[0].replace("OU=", "").replace("ou=", "").strip()
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
    Associa cada usuário ao departamento da SUA respectiva OU, evitando contaminação entre grupos.
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

    # 1. Pré-cadastrar e mapear os departamentos específicos de cada OU pesquisada
    ou_dept_map = {}
    for base_dn in bases_to_search:
        ou_name = ""
        for p in base_dn.split(","):
            if p.strip().upper().startswith("OU="):
                ou_name = p.split("=", 1)[1].strip()
                break
        if not ou_name:
            ou_name = base_dn.split(",")[0].replace("OU=", "").replace("ou=", "").strip()

        dept = db.query(Department).filter(Department.ad_ou_dn == base_dn).first()
        if not dept and ou_name:
            dept = db.query(Department).filter(func.lower(Department.name) == ou_name.lower()).first()
        if not dept:
            dept = Department(name=ou_name or "Geral", ad_ou_dn=base_dn, is_active=True)
            db.add(dept)
            db.commit()
        else:
            dept.ad_ou_dn = base_dn
            dept.is_active = True
            db.commit()
        
        ou_dept_map[base_dn] = (dept.id, ou_name)

    # 2. Varrer as OUs no LDAP
    for base_dn in bases_to_search:
        try:
            conn.search(
                search_base=base_dn,
                search_filter=search_filter,
                search_scope=SUBTREE,
                attributes=attributes,
            )
            
            dept_id, default_ou_name = ou_dept_map.get(base_dn, (None, "Geral"))

            for entry in conn.entries:
                try:
                    username = str(entry.sAMAccountName) if entry.sAMAccountName else None
                    if not username:
                        continue

                    ad_usernames.add(username)
                    
                    # Se o usuário possui um atributo department explícito no AD diferente do nome da OU
                    user_dept_id = dept_id
                    raw_dept = str(entry.department).strip() if entry.department and str(entry.department).strip() else ""
                    if raw_dept and raw_dept.lower() != default_ou_name.lower():
                        c_dept = db.query(Department).filter(func.lower(Department.name) == raw_dept.lower()).first()
                        if not c_dept:
                            c_dept = Department(name=raw_dept, is_active=True)
                            db.add(c_dept)
                            db.commit()
                        user_dept_id = c_dept.id

                    ad_users_data.append({
                        "username": username,
                        "display_name": str(entry.displayName) if entry.displayName else username,
                        "email": str(entry.mail) if entry.mail else None,
                        "department_id": user_dept_id,
                        "ou_dn": base_dn,
                        "manager_dn": str(entry.manager) if entry.manager else None,
                        "phone": str(entry.telephoneNumber) if entry.telephoneNumber else None,
                    })
                except Exception as e:
                    report["errors"].append(f"Erro ao processar entry: {e}")
        except Exception as e:
            report["errors"].append(f"Erro ao buscar na OU {base_dn}: {e}")

    conn.unbind()

    # 3. Criar ou atualizar usuários com o seu departamento correto
    for data in ad_users_data:
        user = db.query(User).filter(User.ad_username == data["username"]).first()
        if user:
            user.display_name = data["display_name"]
            user.email = data["email"]
            user.phone = data["phone"]
            if data["department_id"]:
                user.department_id = data["department_id"]
            user.is_active = True
            report["updated"] += 1
        else:
            user = User(
                ad_username=data["username"],
                display_name=data["display_name"],
                email=data["email"],
                phone=data["phone"],
                department_id=data["department_id"],
                role=UserRole.USER,
                is_room=False,
                is_active=True,
            )
            db.add(user)
            db.flush()
            report["created"] += 1

    # 4. Resolver hierarquia de gestores
    for data in ad_users_data:
        if data["manager_dn"]:
            manager_cn = data["manager_dn"].split(",")[0].replace("CN=", "")
            manager = db.query(User).filter(User.display_name == manager_cn).first()
            if manager:
                user = db.query(User).filter(User.ad_username == data["username"]).first()
                if user:
                    user.manager_id = manager.id
                    if manager.role == UserRole.USER:
                        manager.role = UserRole.MANAGER

    # 5. Se a sincronização for total, desativar usuários que não existem mais no AD
    if not target_ous:
        db_users = db.query(User).filter(
            User.ad_username.isnot(None),
            User.is_room == False,
            User.ad_username != settings.admin_username,
        ).all()

        for user in db_users:
            if user.ad_username not in ad_usernames:
                user.is_active = False
                report["deactivated"] += 1

    db.commit()

    # 6. Reatribui automaticamente os usuários aos seus ativos no CMDB
    relink_assets_and_checkins_to_users(db)

    return report


def relink_assets_and_checkins_to_users(db: Session) -> int:
    """
    Varre os ativos e checkins do Sentinel Agent e vincula automaticamente
    os usuários aos ativos correspondentes com base no último logged_user.
    Garante que se os usuários forem resetados ou reimportados, o CMDB
    restaura o vínculo imediatamente.
    """
    from app.models.asset import Asset
    from app.models.monitoring import AgentCheckin
    import re
    from sqlalchemy import or_

    relinked = 0
    blacklisted = {
        "system", "local service", "network service", "administrator",
        "administrador", "root", "defaultuser0", "guest", "convidado"
    }

    # 1. Pega checkins com usuário logado
    checkins = db.query(AgentCheckin).filter(AgentCheckin.logged_user.isnot(None)).all()
    for chk in checkins:
        raw_user = chk.logged_user
        if not raw_user:
            continue
        clean_user = re.sub(r"^.*?\\", "", raw_user).strip().lower().split("@")[0].strip()
        if clean_user in blacklisted or clean_user.startswith(("adm_", "adm-", "suporte", "admin")):
            continue

        user = db.query(User).filter(
            or_(
                User.ad_username.ilike(clean_user),
                User.email.ilike(f"{clean_user}@%"),
            )
        ).first()

        if user:
            # Localiza o ativo por hostname ou ip
            asset = db.query(Asset).filter(Asset.name.ilike(chk.hostname.strip())).first()
            if not asset and chk.ip_address and chk.ip_address not in ("unknown", "127.0.0.1", ""):
                asset = db.query(Asset).filter(Asset.ip_address == chk.ip_address.strip()).first()

            if asset:
                asset.is_active = True
                if not asset.assigned_user_id or asset.assigned_user_id != user.id:
                    asset.assigned_user_id = user.id
                    relinked += 1

    # 2. Pega ativos que tenham logged_user registrado no specs
    assets_with_specs = db.query(Asset).filter(Asset.specs.isnot(None)).all()
    for ast in assets_with_specs:
        raw_user = ast.specs.get("logged_user") if isinstance(ast.specs, dict) else None
        if not raw_user:
            continue
        clean_user = re.sub(r"^.*?\\", "", raw_user).strip().lower().split("@")[0].strip()
        if clean_user in blacklisted or clean_user.startswith(("adm_", "adm-", "suporte", "admin")):
            continue

        user = db.query(User).filter(
            or_(
                User.ad_username.ilike(clean_user),
                User.email.ilike(f"{clean_user}@%"),
            )
        ).first()

        if user and not ast.assigned_user_id:
            ast.assigned_user_id = user.id
            ast.is_active = True
            relinked += 1

    db.commit()
    return relinked

