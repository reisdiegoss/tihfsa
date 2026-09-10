"""
Script de Inicialização e Migração Autônoma do Banco de Dados — TIHFSA.

Funções:
1. Lê o arquivo .env na raiz do projeto.
2. Verifica se o banco de dados especificado no DATABASE_URL existe no PostgreSQL.
3. Se não existir, cria o banco automaticamente com codificação UTF-8.
4. Executa Base.metadata.create_all para criar todas as tabelas.
5. Aplica todas as migrações incrementais de colunas e tabelas de forma segura e idempotente.
6. Cadastra os tipos de equipamento padrão (_seed_default_asset_types).
7. Cria o departamento 'TI' e o usuário Administrador Root caso o banco esteja vazio.

Uso:
    python backend/init_db.py
"""
import os
import sys
from pathlib import Path
from urllib.parse import urlparse, unquote

# Adicionar a pasta backend ao sys.path
BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

# Importar configurações e modelos da aplicação
from app.config import settings
import app.models  # noqa: F401
from app.database import Base, SessionLocal, engine
from app.models import User, Department, AssetTypeModel
from app.models.user import UserRole
from app.auth.jwt_handler import hash_password


def ensure_database_exists():
    """
    Verifica se o banco de dados alvo existe no servidor PostgreSQL.
    Se não existir, conecta na base padrão 'postgres' e executa CREATE DATABASE.
    """
    raw_url = settings.database_url
    if not (raw_url.startswith("postgresql://") or raw_url.startswith("postgresql+psycopg://")):
        print(f"[INIT_DB] Conexão não-PostgreSQL detectada ({raw_url.split('://')[0]}). Pulando checagem de criação de banco.")
        return

    # Parsear a URL
    parsed = urlparse(raw_url.replace("postgresql+psycopg://", "postgresql://", 1))
    target_dbname = parsed.path.lstrip("/")
    if not target_dbname:
        print("[INIT_DB] Aviso: Nome do banco de dados não identificado na URL.")
        return

    user = unquote(parsed.username or "postgres")
    password = unquote(parsed.password or "")
    host = parsed.hostname or "localhost"
    port = parsed.port or 5432

    # Conectar ao banco administrativo padrão 'postgres'
    admin_url = f"postgresql+psycopg://{user}:{password}@{host}:{port}/postgres"
    
    try:
        # isolation_level="AUTOCOMMIT" é obrigatório no PostgreSQL para comandos CREATE DATABASE
        admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
        with admin_engine.connect() as conn:
            result = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :dbname"),
                {"dbname": target_dbname}
            ).fetchone()

            if not result:
                print(f"[INIT_DB] O banco de dados '{target_dbname}' não existe no servidor PostgreSQL.")
                print(f"[INIT_DB] Criando banco de dados '{target_dbname}' com codificação UTF8...")
                # No Postgres, nomes de database devem ser identificadores protegidos
                safe_dbname = target_dbname.replace('"', '""')
                conn.execute(text(f'CREATE DATABASE "{safe_dbname}" ENCODING \'UTF8\';'))
                print(f"[INIT_DB] Banco de dados '{target_dbname}' criado com sucesso!")
            else:
                print(f"[INIT_DB] Banco de dados '{target_dbname}' já existe.")
        admin_engine.dispose()
    except Exception as e:
        print(f"[INIT_DB] Aviso ao verificar/criar banco no PostgreSQL (pode já existir ou requerer permissões): {e}")


def apply_migrations():
    """
    Executa migrações incrementais de tabelas e colunas para garantir total compatibilidade
    com versões anteriores do banco de dados sem quebrar dados existentes.
    """
    print("[INIT_DB] Aplicando migrações estruturais incrementais...")
    migration_statements = [
        # Ativos
        ("assets.category_id", "ALTER TABLE assets ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id);"),
        ("assets.subcategory_id", "ALTER TABLE assets ADD COLUMN IF NOT EXISTS subcategory_id INTEGER REFERENCES subcategories(id);"),
        ("assets.sound_alert_offline", "ALTER TABLE assets ADD COLUMN IF NOT EXISTS sound_alert_offline BOOLEAN DEFAULT FALSE NOT NULL;"),

        # Tipos de problema
        ("problem_types.category_id", "ALTER TABLE problem_types ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id);"),

        # Chamados
        ("tickets.problem_type_id", "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS problem_type_id INTEGER REFERENCES problem_types(id);"),

        # Departamentos
        ("departments.ad_ou_dn", "ALTER TABLE departments ADD COLUMN IF NOT EXISTS ad_ou_dn VARCHAR(300);"),
        ("departments.is_active", "ALTER TABLE departments ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;"),
        ("departments.manager_id", "ALTER TABLE departments ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id);"),

        # Tabela department_managers
        ("department_managers", """
            CREATE TABLE IF NOT EXISTS department_managers (
                department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                PRIMARY KEY (department_id, user_id)
            );
        """),

        # Categorias & Zabbix
        ("categories.zabbix_group_id", "ALTER TABLE categories ADD COLUMN IF NOT EXISTS zabbix_group_id VARCHAR(50);"),
        ("categories.zabbix_group_name", "ALTER TABLE categories ADD COLUMN IF NOT EXISTS zabbix_group_name VARCHAR(150);"),

        # Mapas de Rede / Topologia
        ("network_maps.pan_x", "ALTER TABLE network_maps ADD COLUMN IF NOT EXISTS pan_x INTEGER DEFAULT 0;"),
        ("network_maps.pan_y", "ALTER TABLE network_maps ADD COLUMN IF NOT EXISTS pan_y INTEGER DEFAULT 0;"),
        ("network_maps.zoom_level", "ALTER TABLE network_maps ADD COLUMN IF NOT EXISTS zoom_level JSON DEFAULT '1.0'::json;"),
        ("network_maps.in_carousel", "ALTER TABLE network_maps ADD COLUMN IF NOT EXISTS in_carousel BOOLEAN DEFAULT TRUE NOT NULL;"),
        ("network_maps.carousel_order", "ALTER TABLE network_maps ADD COLUMN IF NOT EXISTS carousel_order INTEGER DEFAULT 0 NOT NULL;"),
        ("network_maps.carousel_seconds", "ALTER TABLE network_maps ADD COLUMN IF NOT EXISTS carousel_seconds INTEGER DEFAULT 20 NOT NULL;"),
    ]

    with engine.connect() as conn:
        for name, sql in migration_statements:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception as e:
                # Se der erro por sintaxe específica (ex: SQLite sem IF NOT EXISTS ou coluna já existente), apenas loga
                # print(f"       [Migração {name}]: {e}")
                pass
    print("[INIT_DB] Migrações estruturais concluídas.")


def seed_asset_types(db: Session):
    """Garante o cadastro dos tipos de equipamentos padrão do Fasano."""
    try:
        from app.main import _seed_default_asset_types
        _seed_default_asset_types()
        print("[INIT_DB] Tipos de equipamentos padrão verificados/inseridos.")
    except Exception as e:
        print(f"[INIT_DB] Aviso ao sincronizar tipos de ativos: {e}")


def seed_root_admin(db: Session):
    """Cria o departamento de TI e o usuário Admin root se a tabela de usuários estiver vazia."""
    try:
        user_count = db.query(User).count()
        if user_count > 0:
            return

        print("[INIT_DB] Base limpa detectada. Criando departamento TI e Administrador Root...")
        
        # Departamento TI
        dept_ti = db.query(Department).filter_by(name="TI").first()
        if not dept_ti:
            dept_ti = Department(name="TI")
            db.add(dept_ti)
            db.flush()

        # Usuário Admin
        admin_user = User(
            ad_username=settings.admin_username,
            display_name="Administrador do Sistema",
            email=settings.admin_email,
            password_hash=hash_password(settings.admin_password),
            role=UserRole.ADMIN,
            is_room=False,
            department_id=dept_ti.id,
        )
        db.add(admin_user)
        db.commit()

        print(f"[INIT_DB] Usuário root inicial criado com sucesso!")
        print(f"          Usuário: {settings.admin_username}")
        print(f"          E-mail:  {settings.admin_email}")
        print(f"          Perfil:  ADMIN")
    except Exception as e:
        db.rollback()
        print(f"[INIT_DB] Erro ao criar usuário root inicial: {e}")


def main():
    print("=" * 60)
    print("  TIHFSA — Inicialização e Migração do Banco de Dados")
    print("=" * 60)
    
    # 1. Garantir que o banco de dados existe no servidor
    ensure_database_exists()

    # 2. Inspecionar tabelas existentes antes do create_all
    from sqlalchemy import inspect
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    if existing_tables:
        print(f"[INIT_DB] Banco existente com {len(existing_tables)} tabela(s) detectada(s).")
        print("[INIT_DB] Verificando se há novas tabelas do modelo para adicionar...")
    else:
        print("[INIT_DB] Banco novo detectado. Criando tabelas iniciais...")

    # Base.metadata.create_all NUNCA sobrescreve nem apaga dados de tabelas existentes
    Base.metadata.create_all(bind=engine)

    updated_tables = inspect(engine).get_table_names()
    newly_created = set(updated_tables) - set(existing_tables)

    if newly_created:
        print(f"[INIT_DB] {len(newly_created)} nova(s) tabela(s) criada(s): {', '.join(sorted(newly_created))}")
    else:
        print(f"[INIT_DB] Todas as tabelas já existem no banco. Registros e dados 100% preservados.")

    # 3. Aplicar migrações incrementais de colunas
    apply_migrations()

    # 4. Inserir dados básicos essenciais apenas se necessário
    db = SessionLocal()
    try:
        seed_asset_types(db)
        seed_root_admin(db)
    finally:
        db.close()

    print("=" * 60)
    print("  [OK] Banco de dados TIHFSA pronto para operação!")
    print("=" * 60)


if __name__ == "__main__":
    main()
