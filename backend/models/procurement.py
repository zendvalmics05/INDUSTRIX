"""
models/procurement.py
=====================
Inventory     — persistent company state (one row per team).
ComponentSlot — per-component physical state (six rows per team).
MemoryProcurement — last cycle's procurement decisions (one row per team).
"""
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum as SAEnum,
    Float, ForeignKey, Integer, String, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import relationship

from core.database import Base
from core.enums import AutomationLevel, BrandTier, ComponentType


class Inventory(Base):
    """
    The company's persistent financial and physical top-level state.
    Updated in place at the end of every cycle.

    drone_stock: int[101] — index 0 = scrap, 1-100 = grade counts.
    Carries unsold drones between cycles.
    """
    __tablename__ = "inventory"
    __table_args__ = (
        UniqueConstraint("team_id", name="uq_inventory_team"),
    )

    id      = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("team.id", ondelete="CASCADE"),
                     nullable=False, unique=True, index=True)

    funds       = Column(Float,   nullable=False, default=100_000.0)
    drone_stock = Column(ARRAY(Integer), nullable=False,
                          default=lambda: [0] * 101)

    brand_score = Column(Float,          nullable=False, default=50.0)
    brand_tier  = Column(SAEnum(BrandTier), nullable=False,
                          default=BrandTier.FAIR)

    # Labour state — lives here because it is persistent across cycles.
    workforce_size   = Column(Integer, nullable=False, default=50)
    skill_level      = Column(Float,   nullable=False, default=40.0)
    morale           = Column(Float,   nullable=False, default=60.0)
    automation_level = Column(SAEnum(AutomationLevel), nullable=False,
                               default=AutomationLevel.MANUAL)

    # Running totals for leaderboard.
    cumulative_profit = Column(Float, nullable=False, default=0.0)

    # Flag: True while a government loan is outstanding.
    # Blocks backroom deals while active.
    has_gov_loan = Column(Boolean, nullable=False, default=False)

    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    team = relationship("Team", back_populates="inventory")


class ComponentSlot(Base):
    """
    Everything about one component for one team.
    Six rows per team, one per ComponentType.

    raw_stock      : int[101] — unconsumed raw materials.
    finished_stock : int[101] — produced components not yet assembled into drones.
    rnd_quality/consistency/yield : current R&D levels (0-MAX_RND_LEVEL).
    machine_condition : 0.0–100.0 — degrades each cycle.
    """
    __tablename__ = "component_slot"
    __table_args__ = (
        UniqueConstraint("team_id", "component", name="uq_slot_team_component"),
    )

    id        = Column(Integer, primary_key=True, index=True)
    team_id   = Column(Integer, ForeignKey("team.id", ondelete="CASCADE"),
                       nullable=False, index=True)
    component = Column(SAEnum(ComponentType), nullable=False)

    # Physical stock
    raw_stock      = Column(ARRAY(Integer), nullable=False,
                             default=lambda: [0] * 101)
    finished_stock = Column(ARRAY(Integer), nullable=False,
                             default=lambda: [0] * 101)

    # Machine state
    machine_tier      = Column(SAEnum(AutomationLevel), nullable=True)
    # NOTE: machine_tier stores the MachineTier enum value as a string.
    #       Using String here for flexibility (avoids a second Enum import).
    machine_tier_str  = Column(String(20), nullable=False, default="standard")
    machine_condition = Column(Float, nullable=False, default=100.0)

    # R&D levels
    rnd_quality     = Column(Integer, nullable=False, default=0)
    rnd_consistency = Column(Integer, nullable=False, default=0)
    rnd_yield       = Column(Integer, nullable=False, default=0)

    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    team = relationship("Team", back_populates="component_slots")


class MemoryProcurement(Base):
    """
    Last cycle's procurement decisions for one team.
    PATCH semantics — only changed fields are sent; rest carry forward.

    decisions: {
        "airframe": {
            "source_id": 3,
            "quantity": 500,
            "transport": "rail"
        },
        ... (one entry per component)
    }
    """
    __tablename__ = "memory_procurement"
    __table_args__ = (
        UniqueConstraint("team_id", name="uq_mem_proc_team"),
    )

    id      = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("team.id", ondelete="CASCADE"),
                     nullable=False, unique=True, index=True)

    decisions  = Column(JSONB, nullable=False, default=dict)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    team = relationship("Team", back_populates="memory_procurement")