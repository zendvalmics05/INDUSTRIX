"""
schemas/production.py
=====================
Request and response schemas for production decisions.
"""
from typing import Dict, Optional
from pydantic import BaseModel, Field, validator

from core.enums import (
    AutomationLevel, ComponentType, MachineTier,
    MaintenanceLevel, RndFocus, WageLevel,
)


class RndInvestDecision(BaseModel):
    focus:  RndFocus = Field(...)
    levels: int      = Field(1, ge=1, le=5)


class ComponentProductionDecision(BaseModel):
    maintenance: MaintenanceLevel          = Field(MaintenanceLevel.NONE)
    rnd_invest:  Optional[RndInvestDecision] = Field(None)
    upgrade_to:  Optional[MachineTier]     = Field(None,
        description="Buy a new machine of this tier (replaces current).")


class ProductionPatch(BaseModel):
    """
    PATCH body. Send only what changed.
    component_decisions: map of component value → decision.
    Labour fields are top-level because they apply to the whole team.
    """
    component_decisions: Dict[str, ComponentProductionDecision] = Field(
        default_factory=dict,
    )
    wage_level:          Optional[WageLevel]       = None
    target_headcount:    Optional[int]             = Field(None, ge=0, le=500)
    upgrade_automation:  Optional[AutomationLevel] = None

    @validator("component_decisions")
    def valid_components(cls, v):
        valid = {c.value for c in ComponentType}
        for key in v:
            if key not in valid:
                raise ValueError(f"Unknown component: {key}")
        return v


class ProductionMemoryOut(BaseModel):
    decisions: dict

    model_config = {
        "from_attributes": True
    }