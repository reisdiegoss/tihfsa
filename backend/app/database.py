"""
Engine SQLAlchemy + SessionLocal para PostgreSQL.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

# psycopg3: trocar postgresql:// por postgresql+psycopg://
db_url = settings.database_url.replace("postgresql://", "postgresql+psycopg://", 1)
engine = create_engine(db_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency injection: fornece sessão do banco para cada request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
