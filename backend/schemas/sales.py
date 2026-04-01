"""
schemas/sales.py
================
Request and response schemas for sales decisions and leaderboard.
"""
from typing import Dict, List, Optional
from pydantic import BaseModel, Field, validator

from core.enums import QualityTier, SalesAction


class TierSalesDecision(BaseModel):
    action:         SalesAction    = Field(SalesAction.SELL_MARKET)
    price_override: Optional[float] = Field(None, gt=0)


class SalesPatch(BaseModel):
    """
    PATCH body. Send only the tiers you want to change.
    """
    decisions: Dict[str, TierSalesDecision] = Field(default_factory=dict)

    @validator("decisions")
    def valid_tiers(cls, v):
        valid = {t.value for t in QualityTier}
        for key in v:
            if key not in valid:
                raise ValueError(f"Unknown quality tier: {key}")
        return v


class SalesMemoryOut(BaseModel):
    decisions: dict

    model_config = {
        "from_attributes": True
    }


# ── Leaderboard ───────────────────────────────────────────────────────────────

class LeaderboardRow(BaseModel):
    rank:             int
    team_name:        str
    composite_score:  float
    closing_funds:    float
    cumulative_profit: float
    brand_score:      float
    quality_avg:      float
    inventory_penalty: float


class LeaderboardOut(BaseModel):
    cycle_number: int
    is_final:     bool
    rows:         List[LeaderboardRow]


# ── Inventory snapshot (what the team sees about themselves) ──────────────────

class InventoryOut(BaseModel):
    funds:             float
    brand_score:       float
    brand_tier:        str
    drone_stock_total: int      # sum of drone_stock[1:]
    workforce_size:    int
    skill_level:       float
    morale:            float
    automation_level:  str
    has_gov_loan:      bool

    model_config = {
        "from_attributes": True
    }