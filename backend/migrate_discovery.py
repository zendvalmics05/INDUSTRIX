import os
from sqlalchemy import create_engine, text
from core.config import settings

def migrate():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        print("Checking for discovery_code in event table...")
        # Check if column exists in event table
        res = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='event' AND column_name='discovery_code'"
        )).fetchone()
        
        if not res:
            print("Adding discovery_code to event table...")
            conn.execute(text("ALTER TABLE event ADD COLUMN discovery_code VARCHAR(12)"))
        else:
            print("discovery_code already exists in event table.")

        print("Checking for discovery_boost_active in inventory table...")
        res = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='inventory' AND column_name='discovery_boost_active'"
        )).fetchone()
        
        if not res:
            print("Adding discovery_boost_active to inventory table...")
            conn.execute(text("ALTER TABLE inventory ADD COLUMN discovery_boost_active BOOLEAN DEFAULT FALSE NOT NULL"))
        else:
            print("discovery_boost_active already exists in inventory table.")
            
        conn.commit()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
