"""
services/procurement.py
=======================
Procurement resolution engine.

resolve_procurement(db, team, cycle, rng)
    Reads MemoryProcurement decisions, simulates shipment quality draws,
    applies transport events, updates ComponentSlot.raw_stock.
    Returns a summary dict for the organiser dashboard.

seed_procurement_memory(db, team)
    Creates the MemoryProcurement row for a new team with safe defaults.
"""
import math
import random
from typing import Dict, List, Optional

import numpy as np
from sqlalchemy.orm import Session

from core.config import (
    MIN_USABLE_GRADE, PARTIAL_DAMAGE_FRACTION, PARTIAL_DAMAGE_PENALTY,
    QUALITY_MAX, TRANSPORT,
)
from core.enums import ComponentType
from models.game import RawMaterialSource
from models.procurement import ComponentSlot, MemoryProcurement


# ── Seeding ───────────────────────────────────────────────────────────────────

def seed_procurement_memory(db: Session, team) -> MemoryProcurement:
    """Create MemoryProcurement row with empty decisions for a new team."""
    mem = MemoryProcurement(team_id=team.id, decisions={})
    db.add(mem)
    db.flush()
    return mem


def seed_component_slots(db: Session, team) -> List[ComponentSlot]:
    """Create one ComponentSlot per component for a new team."""
    slots = []
    for comp in ComponentType:
        slot = ComponentSlot(
            team_id          = team.id,
            component        = comp,
            raw_stock        = [0] * 101,
            finished_stock   = [0] * 101,
            machine_tier_str = "standard",
            machine_condition = 100.0,
            rnd_quality      = 0,
            rnd_consistency  = 0,
            rnd_yield        = 0,
        )
        db.add(slot)
        slots.append(slot)
    db.flush()
    return slots


# ── Main resolution ───────────────────────────────────────────────────────────

def resolve_procurement(
    db:    Session,
    team,
    cycle,
    rng:   Optional[np.random.Generator] = None,
) -> Dict:
    """
    For each component in MemoryProcurement.decisions:
      1. Load the source.
      2. Draw a quality array from N(mean, sigma+transport_sigma_add).
      3. Apply total loss, then partial damage events.
      4. Merge new array into ComponentSlot.raw_stock.
      5. Deduct cost from Inventory.funds.

    Returns a per-component summary dict.
    """
    if rng is None:
        rng = np.random.default_rng()

    mem: MemoryProcurement = (
        db.query(MemoryProcurement)
        .filter(MemoryProcurement.team_id == team.id)
        .first()
    )
    if not mem or not mem.decisions:
        return {}

    from models.procurement import Inventory
    inventory = db.query(Inventory).filter(Inventory.team_id == team.id).first()

    total_cost = 0.0
    summary    = {}

    for comp_val, decision in mem.decisions.items():
        source_id = decision.get("source_id")
        quantity  = decision.get("quantity", 0)
        transport = decision.get("transport", "road")

        if quantity == 0:
            summary[comp_val] = {"units_ordered": 0, "units_received": 0, "cost": 0.0}
            continue

        source: RawMaterialSource = (
            db.query(RawMaterialSource)
            .filter(
                RawMaterialSource.id      == source_id,
                RawMaterialSource.is_active == True,
            )
            .first()
        )
        if source is None:
            summary[comp_val] = {
                "units_ordered": quantity, "units_received": 0, "cost": 0.0,
                "event": "source_unavailable",
            }
            continue

        t_cfg = TRANSPORT[transport]

        # ── Quality draw ──────────────────────────────────────────────────
        effective_sigma = source.quality_sigma + t_cfg["sigma_add"]
        raw_draws = rng.normal(
            loc   = source.quality_mean,
            scale = effective_sigma,
            size  = quantity,
        )
        # Clip to [0, QUALITY_MAX] and floor to int
        grades = np.clip(raw_draws, 0, QUALITY_MAX).astype(int)
        quality_array = [0] * 101
        for g in grades:
            quality_array[g] += 1
        # Units below MIN_USABLE_GRADE go to scrap bucket (index 0)
        for g in range(1, MIN_USABLE_GRADE):
            quality_array[0] += quality_array[g]
            quality_array[g] = 0

        event = "none"

        # ── Total loss ────────────────────────────────────────────────────
        if random.random() < t_cfg["p_loss"]:
            quality_array = [0] * 101
            event = "total_loss"
        # ── Partial damage ────────────────────────────────────────────────
        elif random.random() < t_cfg["p_damage"]:
            damaged_count = int(quantity * PARTIAL_DAMAGE_FRACTION)
            remaining     = damaged_count
            for g in range(QUALITY_MAX, 0, -1):
                if remaining <= 0:
                    break
                take = min(quality_array[g], remaining)
                quality_array[g] -= take
                new_g = max(0, g - PARTIAL_DAMAGE_PENALTY)
                if new_g < MIN_USABLE_GRADE:
                    new_g = 0
                quality_array[new_g] += take
                remaining -= take
            event = "partial_damage"

        units_received = sum(quality_array[1:])

        # ── Merge into raw_stock ──────────────────────────────────────────
        slot: ComponentSlot = (
            db.query(ComponentSlot)
            .filter(
                ComponentSlot.team_id   == team.id,
                ComponentSlot.component == comp_val,
            )
            .first()
        )
        if slot is None:
            summary[comp_val] = {"error": "component_slot_missing"}
            continue

        existing = slot.raw_stock or [0] * 101
        slot.raw_stock = [existing[i] + quality_array[i] for i in range(101)]

        # ── Cost ──────────────────────────────────────────────────────────
        cost = round(
            quantity * source.base_cost_per_unit * t_cfg["cost_mult"], 2
        )
        total_cost += cost

        summary[comp_val] = {
            "units_ordered":  quantity,
            "units_received": units_received,
            "cost":           cost,
            "event":          event,
            "source":         source.name,
            "transport":      transport,
        }

    # Deduct total procurement cost (allow going negative — dealt with in backroom)
    if inventory:
        inventory.funds = round(inventory.funds - total_cost, 2)

    db.flush()
    return {"per_component": summary, "total_cost": round(total_cost, 2)}