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
    # Parâmetros de Cobrança / Resumo Periódico
    summary_reminder_active = Column(Boolean, default=True)
    summary_reminder_times = Column(String, default="09:00,14:00,18:00")
    summary_reminder_whatsapp = Column(Boolean, default=True)
    summary_reminder_email = Column(Boolean, default=True)

class UnifiConfig(Base):
    __tablename__ = "unifi_config"

    id = Column(Integer, primary_key=True, index=True)
    api_url = Column(String, nullable=True) # e.g. https://192.168.1.1:8443
    username = Column(String, nullable=True)
    password = Column(String, nullable=True)
    site_id = Column(String, default="default") # default site is usually "default"
    is_active = Column(Boolean, default=False)

class ZabbixConfig(Base):
    __tablename__ = "zabbix_config"

    id = Column(Integer, primary_key=True, index=True)
    min_severity = Column(Integer, default=3) # 1=Info, 2=Warning, 3=Average, 4=High, 5=Disaster
    ignored_patterns = Column(String, default="System time is out of sync,Failed to fetch info data,has just been restarted")
    auto_ticket_enabled = Column(Boolean, default=True)
    auto_notify_whatsapp = Column(Boolean, default=True)
    auto_notify_email = Column(Boolean, default=True)
