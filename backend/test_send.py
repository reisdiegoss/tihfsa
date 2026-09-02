import os
import sys

# Ensure backend path is in sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import SessionLocal
from app.models.integration_config import EvolutionConfig
import httpx

db = SessionLocal()
config = db.query(EvolutionConfig).first()

if config:
    url = f"{config.api_url.rstrip('/')}/send/text"
    headers = { 'apikey': config.api_key, 'Content-Type': 'application/json' }
    
    # Grab the first group JID
    jids = [j.strip() for j in config.ti_group_jid.split(",") if j.strip()]
    if jids:
        jid = jids[0]
        print(f"Testing send to {jid}")
        payload = {
            "number": jid,
            "text": "Teste de disparo automático via script!"
        }
        
        resp = httpx.post(url, json=payload, headers=headers, verify=False)
        print("STATUS:", resp.status_code)
        try:
            print("JSON:", resp.json())
        except:
            print("TEXT:", resp.text)
    else:
        print("No JIDs found in config")
else:
    print("No config found")

db.close()
