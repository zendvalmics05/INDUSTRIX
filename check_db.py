
from sqlalchemy import create_engine, text
from core.config import settings

engine = create_engine(settings.DATABASE_URL)

with engine.connect() as conn:
    print("--- INVENTORY ---")
    res = conn.execute(text("SELECT id, team_id, funds, drone_stock FROM inventory"))
    for row in res:
        print(f"ID: {row.id}, Team: {row.team_id}, Funds: {row.funds}, DroneStockSum: {sum(row.drone_stock[1:]) if row.drone_stock else 0}")
        print(f"DroneStockArray: {row.drone_stock[:10]}...")

    print("\n--- COMPONENT SLOTS ---")
    res = conn.execute(text("SELECT id, team_id, component, raw_stock, finished_stock FROM component_slot"))
    for row in res:
        raw_sum = sum(row.raw_stock[1:]) if row.raw_stock else 0
        fin_sum = sum(row.finished_stock[1:]) if row.finished_stock else 0
        print(f"ID: {row.id}, Team: {row.team_id}, Comp: {row.component}, RawSum: {raw_sum}, FinSum: {fin_sum}")
        if raw_sum > 0:
            print(f"  RawStockArray: {row.raw_stock[:10]}...")
        if fin_sum > 0:
            print(f"  FinStockArray: {row.finished_stock[:10]}...")
