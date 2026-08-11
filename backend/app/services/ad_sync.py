"""
Service AD Sync — sincronização de usuários do Active Directory via LDAP.

Mapeia: sAMAccountName, displayName, mail, department, manager.
Cria/atualiza registros nas tabelas users e departments.
"""
from ldap3 import Server, Connection, ALL, SUBTREE
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User, UserRole
from app.models.department import Department


def sync_active_directory(db: Session) -> dict:
    """
    Sincroniza usuários do AD com o banco local.
    Retorna relatório: {created, updated, deactivated, errors}.
    """
    report = {"created": 0, "updated": 0, "deactivated": 0, "errors": []}

    try:
        server = Server(settings.ldap_host, port=settings.ldap_port, get_info=ALL)
        conn = Connection(
            server,
            user=settings.ldap_bind_user,
            password=settings.ldap_bind_password,
            auto_bind=True,
        )
    except Exception as e:
        report["errors"].append(f"Falha ao conectar no LDAP: {e}")
        return report

    # Buscar todos os usuários na OU configurada
    search_filter = "(&(objectClass=user)(objectCategory=person)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))"
    attributes = [
        "sAMAccountName", "displayName", "mail", "department",
        "manager", "title", "telephoneNumber",
    ]

    conn.search(
        search_base=settings.ldap_base_dn,
        search_filter=search_filter,
        search_scope=SUBTREE,
        attributes=attributes,
    )

    ad_usernames = set()
    ad_users_data = []

    for entry in conn.entries:
        try:
            username = str(entry.sAMAccountName) if entry.sAMAccountName else None
            if not username:
                continue

            ad_usernames.add(username)
            ad_users_data.append({
                "username": username,
                "display_name": str(entry.displayName) if entry.displayName else username,
                "email": str(entry.mail) if entry.mail else None,
                "department": str(entry.department) if entry.department else None,
                "manager_dn": str(entry.manager) if entry.manager else None,
                "phone": str(entry.telephoneNumber) if entry.telephoneNumber else None,
            })
        except Exception as e:
            report["errors"].append(f"Erro ao processar entry: {e}")

    conn.unbind()

    # Mapear departamentos
    dept_names = {u["department"] for u in ad_users_data if u["department"]}
    dept_map = {}
    for dept_name in dept_names:
        dept = db.query(Department).filter(Department.name == dept_name).first()
        if not dept:
            dept = Department(name=dept_name)
            db.add(dept)
            db.flush()
        dept_map[dept_name] = dept.id

    # Criar/atualizar usuários
    username_to_id = {}
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

        username_to_id[data["username"]] = user.id

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

    # Desativar usuários que não estão mais no AD (exceto admin root e rooms)
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
