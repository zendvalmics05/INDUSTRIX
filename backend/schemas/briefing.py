from typing import List, Optional
from pydantic import BaseModel

class LastCycleStats(BaseModel):
    cycle_number: int
    revenue:      float
    expenses:     float
    net_profit:   float
    units_sold:   int
    brand_delta:  float
    brand_score:  float

class OperationalUpdate(BaseModel):
    title:       str
    description: str
    type:        str  # e.g., 'rnd', 'infra', 'staffing'

class MarketIntel(BaseModel):
    title:       str
    message:     str
    severity:    str  # 'info', 'warning', 'success'

class CycleBriefingOut(BaseModel):
    cycle_number:      int
    last_cycle_stats:  Optional[LastCycleStats] = None
    operational_updates: List[OperationalUpdate] = []
    market_intelligence: List[MarketIntel] = []
