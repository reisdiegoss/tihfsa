import sys
sys.path.insert(0, 'backend')
from app.database import SessionLocal
from app.models.network_map import NetworkMap

db = SessionLocal()
maps = db.query(NetworkMap).all()
for m in maps:
    print(f"=== MAPA {m.id}: {m.name} ===")
    for n in m.nodes_data or []:
        if n.get("icon_type") in ["Rack", "Zone"] or n.get("zone_id"):
            print(f"  Node id={n.get('id')} label={n.get('label')} icon={n.get('icon_type')} zone={n.get('zone_id')} x={n.get('x')} y={n.get('y')} w={n.get('width')} h={n.get('height')}")
