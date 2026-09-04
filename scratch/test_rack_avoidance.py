import sys
import math
sys.path.insert(0, 'backend')
from app.database import SessionLocal
from app.models.network_map import NetworkMap

db = SessionLocal()
m = db.query(NetworkMap).filter(NetworkMap.id == 12).first()

members = [n for n in m.nodes_data if n.get("zone_id") == "zone_1788549233757"]
racks = [n for n in m.nodes_data if n.get("icon_type") == "Rack"]

print(f"Membros da Zona: {len(members)}")
for mem in members:
    print(f"  {mem.get('label')}: x={mem.get('x')}, y={mem.get('y')}")

print(f"\nRacks: {len(racks)}")
for r in racks:
    print(f"  {r.get('label')}: x={r.get('x')}, y={r.get('y')}, w={r.get('width') or 280}, h={r.get('height') or 700}")
