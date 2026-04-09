"""
scripts/seed_teams.py
=====================
Add all teams from seed_data/teams.json to the active game.
Seeds Inventory, ComponentSlot × 6, and all three Memory tables.

Run AFTER seed_game.py.

Usage:
    python -m scripts.seed_teams
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from core.database import SessionLocal
from models.game import Game, TeamMember
from models.procurement import Inventory, MemoryProcurement
from models.production import MemoryProduction
from models.sales import MemorySales
from core.enums import ComponentType
from services.cycle import add_team

SEED_DIR = os.path.join(os.path.dirname(__file__), "seed_data")


def load_json(filename: str):
    with open(os.path.join(SEED_DIR, filename)) as f:
        return json.load(f)


def seed():
    db = SessionLocal()
    try:
        game = db.query(Game).filter(Game.is_active == True).first()
        if not game:
            print("No active game found. Run seed_game.py first.")
            sys.exit(1)

        teams_data = load_json("teams.json")

        from models.game import TeamMember

        for entry in teams_data:
            team = add_team(db, game, entry["name"], entry["pin"])
            db.flush()
            print(f"  Team created: id={team.id}  name='{team.name}'")

            # 0. Starting Stock
            starting = entry.get("starting_stock")
            if starting:
                inv = db.query(Inventory).filter(Inventory.team_id == team.id).first()
                if inv:
                    stock = [0] * 101
                    g = starting["grade"]
                    c = starting["count"]
                    stock[g] = c
                    inv.drone_stock = stock
            
            # 1. Members
            members = entry.get("members", [])
            for m in members:
                new_member = TeamMember(team_id=team.id, name=m["name"], role=m.get("role", "Executive"))
                db.add(new_member)

            # 2. Memory Defaults
            defaults = entry.get("defaults")
            if defaults:
                # Procurement
                proc_mem = db.query(MemoryProcurement).filter(MemoryProcurement.team_id == team.id).first()
                if proc_mem:
                    proc_mem.decisions = defaults.get("procurement", {})
                
                # Production
                prod_mem = db.query(MemoryProduction).filter(MemoryProduction.team_id == team.id).first()
                if prod_mem:
                    d = defaults.get("production", {})
                    # Expand component-specific maintenance
                    prod_decisions = {
                        "wage_level": d.get("wage_level", "market"),
                        "target_headcount": d.get("target_headcount", 50),
                        "upgrade_automation": d.get("automation_level")
                    }
                    for comp in ComponentType:
                        prod_decisions[comp.value] = {
                            "maintenance": d.get("maintenance", "basic"),
                            "rnd_invest": None,
                            "upgrade_to": None
                        }
                    prod_mem.decisions = prod_decisions
                
                # Sales
                sales_mem = db.query(MemorySales).filter(MemorySales.team_id == team.id).first()
                if sales_mem:
                    sales_mem.decisions = defaults.get("sales", {})

            db.commit()

        print(f"\n{len(teams_data)} teams seeded successfully.")

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed()
