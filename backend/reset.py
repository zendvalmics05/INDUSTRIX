"""
scripts/reset_db.py
===================
Drop all tables and recreate them from scratch.
Run this before the event to start with a clean database.

Usage:
    python -m scripts.reset_db
"""
import sys
import os

from models.game import Game

sys.path.insert(0, os.path.dirname(__file__))

from core.database import Base, engine
import models  # noqa: F401 — triggers all model imports


from sqlalchemy import text
from core.config import settings

def reset():
    print("NOTE: This script will now attempt to forcefully clear other active connections.")
    confirm = input("Type RESET to wipe the entire database: ").strip()
    if confirm != "RESET":
        print("Aborted.")
        sys.exit(0)

    # Nuclear Option for PostgreSQL: Kill other sessions to acquire ACCESS EXCLUSIVE lock
    if "postgresql" in settings.DATABASE_URL:
        # Extract DB name from URL (e.g. postgresql://user:pass@host:port/dbname)
        db_name = settings.DATABASE_URL.split("/")[-1]
        print(f"PostgreSQL detected. Terminating other sessions for database '{db_name}'...")
        try:
            with engine.connect() as conn:
                # We execute out of a transaction to terminate other backends
                conn.execute(text("COMMIT"))
                conn.execute(text(f"""
                    SELECT pg_terminate_backend(pid)
                    FROM pg_stat_activity
                    WHERE datname = '{db_name}'
                      AND pid <> pg_backend_pid();
                """))
                print("Other sessions terminated.")

                print("Performing CASCADE schema wipe (Nuclear Option 2.0)...")
                conn.execute(text("DROP SCHEMA public CASCADE"))
                conn.execute(text("CREATE SCHEMA public"))
                conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
                # Granting to 'postgres' user is standard for local setups
                try:
                    conn.execute(text("GRANT ALL ON SCHEMA public TO postgres"))
                except:
                    pass
                print("Schema wiped and recreated clean.")
        except Exception as e:
            print(f"Warning: Could not perform nuclear reset: {e}")
            print("Falling back to standard drop_all...")

    # For non-Postgres or failed nuclear reset
    if "postgresql" not in settings.DATABASE_URL:
        print("Dropping all tables...")
        Base.metadata.drop_all(bind=engine)

    print("Recreating all tables...")
    Base.metadata.create_all(bind=engine)
    print("Done. Database is empty and ready.")


if __name__ == "__main__":
    reset()