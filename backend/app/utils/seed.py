"""
Seed Data — dados realistas do Hotel Fasano Salvador.

Cria: departamentos, usuários, apartamentos, ativos, categorias e chamados de exemplo.
Executar: py backend/app/utils/seed.py
"""
from sqlalchemy.orm import Session

from app.database import SessionLocal, engine, Base
from app.models import User, Department, Asset, Ticket, TicketInteraction, Category, Subcategory
from app.models.user import UserRole
from app.models.asset import AssetType
from app.models.ticket import TicketStatus, TicketPriority
from app.auth.jwt_handler import hash_password
from app.config import settings


def seed_all():
    """Popula o banco com dados do Hotel Fasano Salvador."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Verifica se já tem dados
        if db.query(User).count() > 0:
            print("[INFO] Banco já possui dados. Pulando seed.")
            return

        print("[SEED] Criando dados do Hotel Fasano Salvador...")

        # ── DEPARTAMENTOS ──
        departments = {}
        for name in [
            "TI", "Recepção", "Governança", "A&B", "Reservas",
            "Financeiro", "Manutenção", "Gerência Geral", "RH", "Compras",
        ]:
            dept = Department(name=name)
            db.add(dept)
            db.flush()
            departments[name] = dept

        # ── ADMIN ROOT ──
        admin = User(
            ad_username=settings.admin_username,
            display_name="Administrador TI",
            email=settings.admin_email,
            password_hash=hash_password(settings.admin_password),
            role=UserRole.ADMIN,
            is_room=False,
            department_id=departments["TI"].id,
        )
        db.add(admin)
        db.flush()

        # ── GESTORES ──
        managers_data = [
            ("carlos.silva", "Carlos Silva", "carlos.silva@fasanosalvador.com.br", "Gerência Geral", UserRole.MANAGER),
            ("ana.souza", "Ana Souza", "ana.souza@fasanosalvador.com.br", "A&B", UserRole.MANAGER),
            ("fernanda.lima", "Fernanda Lima", "fernanda.lima@fasanosalvador.com.br", "Recepção", UserRole.MANAGER),
            ("roberto.santos", "Roberto Santos", "roberto.santos@fasanosalvador.com.br", "Governança", UserRole.MANAGER),
            ("patricia.costa", "Patricia Costa", "patricia.costa@fasanosalvador.com.br", "Financeiro", UserRole.MANAGER),
            ("marcelo.oliveira", "Marcelo Oliveira", "marcelo.oliveira@fasanosalvador.com.br", "Manutenção", UserRole.MANAGER),
        ]

        managers = {}
        for ad_user, name, email, dept_name, role in managers_data:
            mgr = User(
                ad_username=ad_user,
                display_name=name,
                email=email,
                role=role,
                is_room=False,
                department_id=departments[dept_name].id,
                manager_id=admin.id,  # Todos reportam ao admin inicialmente
            )
            db.add(mgr)
            db.flush()
            managers[dept_name] = mgr

            # Atualizar gestor do departamento
            departments[dept_name].manager_id = mgr.id

        # ── COLABORADORES ──
        users_data = [
            ("diego.reis", "Diego Reis", "diego.reis@fasanosalvador.com.br", "TI", UserRole.TECHNICIAN),
            ("lucas.pereira", "Lucas Pereira", "lucas.pereira@fasanosalvador.com.br", "TI", UserRole.TECHNICIAN),
            ("marcos.lima", "Marcos Lima", "marcos.lima@fasanosalvador.com.br", "Recepção", UserRole.USER),
            ("juliana.rocha", "Juliana Rocha", "juliana.rocha@fasanosalvador.com.br", "Recepção", UserRole.USER),
            ("camila.alves", "Camila Alves", "camila.alves@fasanosalvador.com.br", "A&B", UserRole.USER),
            ("rafael.martins", "Rafael Martins", "rafael.martins@fasanosalvador.com.br", "A&B", UserRole.USER),
            ("beatriz.ferreira", "Beatriz Ferreira", "beatriz.ferreira@fasanosalvador.com.br", "Governança", UserRole.USER),
            ("thiago.moreira", "Thiago Moreira", "thiago.moreira@fasanosalvador.com.br", "Reservas", UserRole.USER),
            ("amanda.ribeiro", "Amanda Ribeiro", "amanda.ribeiro@fasanosalvador.com.br", "RH", UserRole.USER),
            ("gabriel.nunes", "Gabriel Nunes", "gabriel.nunes@fasanosalvador.com.br", "Compras", UserRole.USER),
        ]

        users = {}
        for ad_user, name, email, dept_name, role in users_data:
            # Gestor é o manager do departamento
            mgr = managers.get(dept_name)
            user = User(
                ad_username=ad_user,
                display_name=name,
                email=email,
                role=role,
                is_room=False,
                department_id=departments[dept_name].id,
                manager_id=mgr.id if mgr else admin.id,
            )
            db.add(user)
            db.flush()
            users[ad_user] = user

        # ── APARTAMENTOS (is_room=True) ──
        rooms = {}
        for floor in [1, 2, 3]:
            for num in range(1, 11):
                room_number = f"{floor}0{num}" if num < 10 else f"{floor}{num}"
                room = User(
                    display_name=f"Apt {room_number}",
                    is_room=True,
                    room_number=room_number,
                    role=UserRole.USER,
                )
                db.add(room)
                db.flush()
                rooms[room_number] = room

        # ── ATIVOS DE APARTAMENTOS ──
        apt_asset_types = [
            (AssetType.TV, "Samsung", "Crystal UHD 55\""),
            (AssetType.SKY, "SKY", "Receptor HD"),
            (AssetType.CONTROLE_SKY, "SKY", "Controle Remoto"),
            (AssetType.TELEFONE, "Grandstream", "GXP1625"),
            (AssetType.CAIXA_SOM, "JBL", "Go 3"),
            (AssetType.ANTENA_UNIFI, "Ubiquiti", "U6 Lite"),
        ]

        for room_number, room in rooms.items():
            for asset_type, brand, model in apt_asset_types:
                asset = Asset(
                    name=f"{asset_type.value} - Apt {room_number}",
                    type=asset_type,
                    brand=brand,
                    model=model,
                    assigned_user_id=room.id,
                    asset_tag=f"HFS-{room_number}-{asset_type.name}",
                )
                db.add(asset)

        # ── ATIVOS DE BACKOFFICE ──
        backoffice_assets = [
            ("diego.reis", AssetType.NOTEBOOK, "Dell", "Latitude 5540", "HFS-NB-001"),
            ("diego.reis", AssetType.MONITOR, "LG", "27UK850", "HFS-MN-001"),
            ("lucas.pereira", AssetType.NOTEBOOK, "Dell", "Latitude 5540", "HFS-NB-002"),
            ("marcos.lima", AssetType.DESKTOP, "Dell", "OptiPlex 3080", "HFS-DT-001"),
            ("marcos.lima", AssetType.MONITOR, "Dell", "P2422H", "HFS-MN-002"),
            ("marcos.lima", AssetType.TELEFONE, "Grandstream", "GXP1625", "HFS-TL-001"),
            ("marcos.lima", AssetType.IMPRESSORA, "HP", "LaserJet Pro M404dn", "HFS-IM-001"),
            ("juliana.rocha", AssetType.DESKTOP, "Dell", "OptiPlex 3080", "HFS-DT-002"),
            ("juliana.rocha", AssetType.MONITOR, "Dell", "P2422H", "HFS-MN-003"),
            ("juliana.rocha", AssetType.TELEFONE, "Grandstream", "GXP1625", "HFS-TL-002"),
            ("camila.alves", AssetType.NOTEBOOK, "Lenovo", "ThinkPad E14", "HFS-NB-003"),
            ("amanda.ribeiro", AssetType.NOTEBOOK, "Dell", "Latitude 5540", "HFS-NB-004"),
            ("amanda.ribeiro", AssetType.MONITOR, "LG", "24MK430H", "HFS-MN-004"),
        ]

        for ad_user, asset_type, brand, model, tag in backoffice_assets:
            user = users.get(ad_user)
            if user:
                asset = Asset(
                    name=f"{asset_type.value} {brand} {model}",
                    type=asset_type,
                    brand=brand,
                    model=model,
                    assigned_user_id=user.id,
                    asset_tag=tag,
                )
                db.add(asset)

        # ── CATEGORIAS E SUBCATEGORIAS ──
        categories_data = {
            "Hardware": [
                "PC não liga", "Monitor sem imagem", "Teclado/Mouse com defeito",
                "Impressora não imprime", "Notebook superaquecendo",
            ],
            "Software": [
                "Sistema travado", "Instalação de programa", "Acesso negado",
                "Atualização de sistema", "Erro de aplicação",
            ],
            "Rede": [
                "Sem internet", "WiFi lento", "VPN não conecta",
                "Ponto de rede sem funcionar", "Firewall bloqueando",
            ],
            "Telefonia": [
                "Ramal sem tom", "Transferência de ramal",
                "Telefone não funciona", "Programação de ramal",
            ],
            "TV / Entretenimento": [
                "TV sem sinal", "SKY sem canais", "Controle não funciona",
                "Caixa de som sem áudio", "HDMI sem imagem",
            ],
            "Infraestrutura": [
                "Ponto de rede", "Cabeamento estruturado",
                "Energia/Tomada", "Climatização sala TI",
            ],
        }

        for cat_name, subs in categories_data.items():
            cat = Category(name=cat_name)
            db.add(cat)
            db.flush()
            for sub_name in subs:
                sub = Subcategory(name=sub_name, category_id=cat.id)
                db.add(sub)

        # ── CHAMADOS DE EXEMPLO ──
        diego = users["diego.reis"]
        marcos = users["marcos.lima"]
        camila = users["camila.alves"]
        room_101 = rooms["101"]
        room_204 = rooms["204"]

        example_tickets = [
            Ticket(
                title="PC da recepção não liga",
                description="Desktop Dell OptiPlex da recepção principal não inicia. LED de power pisca âmbar.",
                status=TicketStatus.IN_PROGRESS,
                priority=TicketPriority.HIGH,
                requester_id=marcos.id,
                technician_id=diego.id,
            ),
            Ticket(
                title="Instalar sistema de reservas",
                description="Necessário instalar o novo módulo do sistema de reservas no notebook da Camila.",
                status=TicketStatus.NEW,
                priority=TicketPriority.MEDIUM,
                requester_id=camila.id,
            ),
            Ticket(
                title="TV Apt 101 sem sinal",
                description="Hóspede reporta que a TV do apartamento 101 está sem sinal. Verificar receptor SKY.",
                status=TicketStatus.PENDING_VALIDATION,
                priority=TicketPriority.HIGH,
                requester_id=room_101.id,
                technician_id=diego.id,
            ),
            Ticket(
                title="WiFi lento no Apt 204",
                description="Hóspede reclama de internet lenta no apartamento 204. Verificar AP Unifi.",
                status=TicketStatus.CLOSED,
                priority=TicketPriority.CRITICAL,
                requester_id=room_204.id,
                technician_id=diego.id,
            ),
        ]

        for t in example_tickets:
            db.add(t)

        db.commit()
        print("[SEED] Dados inseridos com sucesso!")
        print(f"       Departamentos: {len(departments)}")
        print(f"       Usuários: {len(users) + len(managers) + 1}")
        print(f"       Apartamentos: {len(rooms)}")
        print(f"       Categorias: {len(categories_data)}")
        print(f"       Chamados exemplo: {len(example_tickets)}")

    except Exception as e:
        db.rollback()
        print(f"[SEED] ERRO: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_all()
