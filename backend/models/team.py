
from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from core.database import Base

class Team(Base):
    __tablename__ = 'teams'
    id             = Column(Integer, primary_key=True, index=True)
    team_code      = Column(String(10), unique=True, nullable=False, index=True)
    name           = Column(String(100), nullable=False)
    domain         = Column(String(50), nullable=False)
    password_hash  = Column(String(200), nullable=False)
    is_active      = Column(Boolean, default=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    cash           = Column(Integer, default=100000)
    revenue        = Column(Integer, default=0)
    market_share   = Column(Integer, default=0)
