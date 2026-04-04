from core.database import SessionLocal
from models.team import Team

db = SessionLocal()

teams = db.query(Team).all()

for t in teams:
    print(f"ID: {t.id}, Name: {t.name}, PIN: {t.pin}")