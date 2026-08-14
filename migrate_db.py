import sys
import os

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy import text
from app.database import engine

def run_migration():
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE assets ADD COLUMN category_id INTEGER REFERENCES categories(id)"))
            print("Added category_id to assets")
        except Exception as e:
            print(f"assets.category_id already exists or error: {e}")
            
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE problem_types ADD COLUMN category_id INTEGER REFERENCES categories(id)"))
            print("Added category_id to problem_types")
        except Exception as e:
            print(f"problem_types.category_id already exists or error: {e}")

    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE tickets ADD COLUMN problem_type_id INTEGER REFERENCES problem_types(id)"))
            print("Added problem_type_id to tickets")
        except Exception as e:
            print(f"tickets.problem_type_id already exists or error: {e}")

    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE departments ADD COLUMN ad_ou_dn VARCHAR(300)"))
            print("Added ad_ou_dn to departments")
        except Exception as e:
            print(f"departments.ad_ou_dn already exists or error: {e}")

    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE departments ADD COLUMN is_active BOOLEAN DEFAULT TRUE"))
            print("Added is_active to departments")
        except Exception as e:
            print(f"departments.is_active already exists or error: {e}")

    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE departments ADD COLUMN manager_id INTEGER REFERENCES users(id)"))
            print("Added manager_id to departments")
        except Exception as e:
            print(f"departments.manager_id already exists or error: {e}")

    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE assets ADD COLUMN subcategory_id INTEGER REFERENCES subcategories(id)"))
            print("Added subcategory_id to assets")
        except Exception as e:
            print(f"assets.subcategory_id already exists or error: {e}")

    with engine.begin() as conn:
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS department_managers (
                    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    PRIMARY KEY (department_id, user_id)
                );
            """))
            print("Created department_managers table")
        except Exception as e:
            print(f"department_managers table creation error: {e}")

    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE categories ADD COLUMN zabbix_group_id VARCHAR(50)"))
            print("Added zabbix_group_id to categories")
        except Exception as e:
            print(f"categories.zabbix_group_id already exists or error: {e}")

    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE categories ADD COLUMN zabbix_group_name VARCHAR(150)"))
            print("Added zabbix_group_name to categories")
        except Exception as e:
            print(f"categories.zabbix_group_name already exists or error: {e}")

if __name__ == "__main__":
    run_migration()
