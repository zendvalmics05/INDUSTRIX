"""
models/deals.py
===============
EventLedger — every multi-cycle obligation: loans, R&D investments,
              global events, active backroom effects.
GovDeal     — every backroom deal with its discovery lifecycle.

These are the only tables that grow over time.
EventLedger rows are deleted (or marked resolved) once
cycles_remaining hits 0.
"""
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum as SAEnum,
    Float, ForeignKey, Integer, String, Text,
    UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from core.database import Base
from core.enums import EventStatus, EventType, GovDealStatus, GovDealType


class EventLedger(Base):
    """
    One row per active multi-cycle obligation.

    event_type determines the structure of payload:

    GOV_LOAN:
        {"principal": F, "rate": F, "interest_due_this_cycle": F}

    INTER_TEAM_LOAN:
        {"principal": F, "rate": F, "lender_team_id": N,
         "interest_due_this_cycle": F}

    RND_INVESTMENT:
        {"component": str, "focus": str, "level_arriving": N,
         "cycles_until_arrival": N}

    GLOBAL_EVENT:
        {"description": str, "effects": {...}}
        effects keys depend on what the event does — the service layer
        reads these and applies them at cycle start.

    BACKROOM_EFFECT:
        {... deal-type-specific payload as in GovDeal.effect_payload ...}
    """
    __tablename__ = "event_ledger"

    id         = Column(Integer, primary_key=True, index=True)
    game_id    = Column(Integer, ForeignKey("game.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    team_id    = Column(Integer, ForeignKey("team.id", ondelete="CASCADE"),
                        nullable=True, index=True)
    # team_id is NULL for GLOBAL_EVENT (affects all teams).

    event_type       = Column(SAEnum(EventType), nullable=False)
    status           = Column(SAEnum(EventStatus), nullable=False,
                               default=EventStatus.ACTIVE)
    cycles_remaining = Column(Integer, nullable=False, default=1)
    payload          = Column(JSONB,   nullable=False, default=dict)

    # Human-readable note from the organiser.
    notes      = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class GovDeal(Base):
    """
    One backroom deal recorded by the organiser.

    Lifecycle:
      PENDING  → recorded, bribe deducted, deal queued for next cycle
      APPLIED  → effect injected at cycle start
      DISCOVERED → found during backroom phase; fine applied, effect nullified
      CANCELLED  → organiser cancelled before application

    discovery_probability is computed at record time and decays each cycle.
    cycles_active tracks how many cycles have elapsed since creation
    (used for the decay calculation).
    """
    __tablename__ = "gov_deal"

    id      = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("game.id", ondelete="CASCADE"),
                     nullable=False, index=True)

    buyer_team_id  = Column(Integer, ForeignKey("team.id"), nullable=False,
                             index=True)
    target_team_id = Column(Integer, ForeignKey("team.id"), nullable=True,
                             index=True)
    # target is NULL for GREEN_* self-buff deals

    deal_type = Column(SAEnum(GovDealType), nullable=False)
    status    = Column(SAEnum(GovDealStatus), nullable=False,
                        default=GovDealStatus.PENDING)

    bribe_amount   = Column(Float, nullable=False)
    effect_scale   = Column(Float, nullable=False, default=1.0)
    effect_payload = Column(JSONB, nullable=False, default=dict)

    discovery_probability = Column(Float, nullable=False)
    cycles_active         = Column(Integer, nullable=False, default=0)
    repeat_count          = Column(Integer, nullable=False, default=1)

    # Which cycle this deal was negotiated in.
    negotiated_cycle_id = Column(Integer, ForeignKey("cycle.id"),
                                  nullable=False, index=True)

    notes      = Column(Text,    nullable=True)
    applied_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())