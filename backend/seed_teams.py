from passlib.context import CryptContext
from core.database import engine, SessionLocal, Base
from models.team import Team

Base.metadata.create_all(bind=engine)
pwd_ctx = CryptContext(schemes=['bcrypt'], deprecated='auto')

TEAMS = [
    ('ALPHA-01', 'Alpha Industries',  'Battery', 'alpha123'),
    ('ALPHA-02', 'AlphaTech Corp',    'Battery', 'alpha456'),
    ('BETA-01',  'Beta Systems',      'Chips',   'beta123'),
    ('BETA-02',  'BetaCore Ltd',      'Chips',   'beta456'),
    ('GAMMA-01', 'Gamma Dynamics',    'Display', 'gamma123'),
    ('GAMMA-02', 'Gamma Labs',        'Display', 'gamma456'),
    ('DELTA-01', 'Delta Engineering', 'Camera',  'delta123'),
    ('DELTA-02', 'Delta Works',       'Camera',  'delta456'),
]

db = SessionLocal()
for code, name, domain, password in TEAMS:
    if not db.query(Team).filter(Team.team_code == code).first():
        db.add(Team(team_code=code, name=name, domain=domain, password_hash=pwd_ctx.hash(password)))
        print(f'Created: {code}')
    else:
        print(f'Skipped: {code}')
db.commit()
db.close()
print('Done.')
