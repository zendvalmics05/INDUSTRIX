
import requests
from sqlalchemy import create_engine, text
from core.config import settings

engine = create_engine(settings.DATABASE_URL)

with engine.connect() as conn:
    # Get the first team's PIN and ID
    res = conn.execute(text("SELECT id, name, pin_hash FROM team LIMIT 1")).fetchone()
    if not res:
        print("No teams found")
        exit()
    
    team_id, team_name, pin_hash = res
    print(f"Testing team: {team_name} (ID: {team_id})")

# We can't easily get the raw PIN from the hash, so we'll just check the backend code 
# and see if there's an internal-only way or we'll just use a direct DB session check 
# on how the router builds the response.

from models.procurement import ComponentSlot, Inventory
from routers.team.inventory import _build_slot
from sqlalchemy.orm import Session

db = Session(engine)
slots = db.query(ComponentSlot).filter(ComponentSlot.team_id == team_id).all()
inv = db.query(Inventory).filter(Inventory.team_id == team_id).first()

print("\n--- EMULATED /team/inventory/components RESPONSE ---")
response = {
    "drone_stock":       inv.drone_stock if inv and inv.drone_stock else [0]*101,
    "drone_stock_total": sum(inv.drone_stock[1:]) if inv and inv.drone_stock else 0,
    "components":        [_build_slot(db, slot) for slot in slots],
}

import json
print(json.dumps(response, indent=2))
