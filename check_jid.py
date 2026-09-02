import os
import sys

sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import SessionLocal
from app.models.integration_config import EvolutionConfig

db = SessionLocal()
config = db.query(EvolutionConfig).first()

if config:
    print("SAVED JID:", config.ti_group_jid)
else:
    print("No config")
