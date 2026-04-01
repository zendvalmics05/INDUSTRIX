"""
schemas/deals.py
================
Organiser-side schemas for deals, events, and game control.
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, validator

from core.enums import EventType, GovDealType


# ── Government deals ──────────────────────────────────────────────────────────

class GovDealCreate(BaseModel):
    buyer_team_id:   int         = Field(..., gt=0)
    deal_type:       GovDealType
    bribe_amount:    float       = Field(..., gt=0)
    target_team_id:  Optional[int] = Field(None, gt=0,
        description="Required for RED_* offensive deals.")
    override_params: Optional[Dict[str, Any]] = Field(None,
        description="Override specific effect payload keys.")
    notes:           Optional[str] = None


class GovDealOut(BaseModel):
    id:                   int
    buyer_team_id:        int
    target_team_id:       Optional[int]
    deal_type:            str
    status:               str
    bribe_amount:         float
    effect_scale:         float
    effect_payload:       dict
    discovery_probability: float
    notes:                Optional[str]
    created_at:           Any

    model_config = {
        "from_attributes": True
    }


# ── Event ledger entries ──────────────────────────────────────────────────────

class EventCreate(BaseModel):
    team_id:         Optional[int] = Field(None,
        description="Null for global events that affect all teams.")
    event_type:      EventType
    cycles_duration: int           = Field(1, ge=1,
        description="How many cycles this event is active.")
    payload:         Dict[str, Any] = Field(default_factory=dict)
    notes:           Optional[str]  = None


class EventOut(BaseModel):
    id:               int
    team_id:          Optional[int]
    event_type:       str
    status:           str
    cycles_remaining: int
    payload:          dict
    notes:            Optional[str]

    model_config = {
        "from_attributes": True
    }


# ── Game control ──────────────────────────────────────────────────────────────

class AdvancePhaseOut(BaseModel):
    previous_phase: str
    current_phase:  str
    cycle_number:   int


class GameUpdateSettings(BaseModel):
    """Organiser can tweak these during the backroom phase for the next cycle."""
    qr_hard:                  Optional[float] = Field(None, ge=0, le=100)
    qr_soft:                  Optional[float] = Field(None, ge=0, le=100)
    qr_premium:               Optional[float] = Field(None, ge=0, le=100)
    market_demand_multiplier: Optional[float] = Field(None, gt=0)