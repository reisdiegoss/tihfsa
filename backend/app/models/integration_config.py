from sqlalchemy import Column, Integer, String, Boolean
from app.database import Base

class EvolutionConfig(Base):
    __tablename__ = "evolution_config"

    id = Column(Integer, primary_key=True, index=True)
    api_url = Column(String, nullable=True)
    instance_name = Column(String, nullable=True)
    api_key = Column(String, nullable=True)
    ti_group_jid = Column(String, nullable=True)
    is_active = Column(Boolean, default=False)

class UnifiConfig(Base):
    __tablename__ = "unifi_config"

    id = Column(Integer, primary_key=True, index=True)
    api_url = Column(String, nullable=True) # e.g. https://192.168.1.1:8443
    username = Column(String, nullable=True)
    password = Column(String, nullable=True)
    site_id = Column(String, default="default") # default site is usually "default"
    is_active = Column(Boolean, default=False)
