"""
services/production.py
======================
Production resolution engine.

resolve_production(db, team, cycle, rng)
    Reads MemoryProduction decisions and current ComponentSlot/Inventory state.
    For each component: applies maintenance, degrades machine, draws component
    quality output from raw_stock, stores in finished_stock.
    Then assembles finished components into drones (drone_stock).
    Deducts wages and maintenance costs from Inventory.funds.
    Returns a summary dict.

seed_production_memory(db, team)
    Creates MemoryProduction row for a new team.
"""
import math
import random
from typing import Dict, List, Optional, Tuple

import numpy as np
from sqlalchemy.orm import Session

from core.config import (
    ASSEMBLY_BETA, ASSEMBLY_LAMBDA, AUTOMATION_LABOUR_MULT,
    AUTOMATION_SIGMA_MULT, BASE_SIGMA, CONDITION_GRADE_EXPONENT,
    MACHINE_DEGRADED_AT, MACHINE_MAX_CONDITION, MACHINE_TIERS,
    MAINTENANCE_COST, MAINTENANCE_DEGRADE_MULT, MAX_RND_LEVEL,
    MORALE_HIGH, MORALE_LOW, MORALE_RIOT, OVERHAUL_RECOVERY_CAP,
    POACH_SKILL_HIT, QUALITY_MAX, RND_CONSISTENCY_BONUS,
    RND_CYCLES_PER_LEVEL, RND_QUALITY_BONUS, RND_YIELD_BONUS,
    RIOT_SURVIVAL, RM_WEIGHT, SKILL_GAIN_HIGH_MORALE,
    SKILL_GAIN_LOW_MORALE, SKILL_SIGMA_REDUCTION, STRIKE_SURVIVAL,
    UNDERSTAFFING_MORALE_PENALTY, WAGE_COST_PER_WORKER, WAGE_MORALE_DELTA,
    AUTOMATION_UPGRADE_COST, MACHINE_TIERS,
)
from core.enums import AutomationLevel, ComponentType, MachineTier
from models.production import MemoryProduction
from models.procurement import ComponentSlot, Inventory


# ── Seeding ───────────────────────────────────────────────────────────────────

def seed_production_memory(db: Session, team) -> MemoryProduction:
    default_decisions = {
        "wage_level":         "market",
        "target_headcount":   50,
        "upgrade_automation": None,
    }
    for comp in ComponentType:
        default_decisions[comp.value] = {
            "maintenance": "none",
            "rnd_invest":  None,
            "upgrade_to":  None,
        }
    mem = MemoryProduction(team_id=team.id, decisions=default_decisions)
    db.add(mem)
    db.flush()
    return mem


# ── Helpers ───────────────────────────────────────────────────────────────────

def _effective_machine_grade(base_grade: float, condition: float) -> float:
    """Apply condition degradation to machine output quality mean."""
    factor = (condition / MACHINE_MAX_CONDITION) ** CONDITION_GRADE_EXPONENT
    return base_grade * factor


def _compute_sigma(
    base_sigma:       float,
    automation_level: str,
    skill:            float,
    rnd_consistency:  int,
    rnd_consistency_bonus: float,
) -> float:
    """Compute effective output sigma after automation, skill, and R&D."""
    sigma = base_sigma * AUTOMATION_SIGMA_MULT.get(automation_level, 1.0)
    skill_factor = max(0.1, min(1.0, skill / 100.0))
    sigma *= (1.0 - skill_factor * SKILL_SIGMA_REDUCTION)
    sigma -= rnd_consistency * rnd_consistency_bonus
    return max(2.0, sigma)


def _draw_component_array(
    mean: float, sigma: float, count: int, rng: np.random.Generator
) -> List[int]:
    """Draw `count` units from N(mean, sigma), return 101-int array."""
    if count <= 0:
        return [0] * 101
    draws = rng.normal(loc=mean, scale=sigma, size=count)
    arr   = [0] * 101
    for v in draws:
        g = int(np.clip(v, 0, QUALITY_MAX))
        arr[g] += 1
    # Sub-grade-1 → scrap
    for g in range(1):
        arr[0] += arr[g]
    return arr


def _consume_raw_stock(
    raw_stock: List[int], units_needed: int, yield_reduction: float
) -> Tuple[List[int], int, float]:
    """
    Pull `units_needed` (adjusted by yield R&D) from raw_stock.
    Returns (updated_raw_stock, units_actually_consumed, rm_grade_weighted_mean).
    """
    effective_needed = max(1, int(units_needed * (1.0 - yield_reduction)))
    total_available  = sum(raw_stock[1:])
    to_consume = min(effective_needed, total_available)

    updated = list(raw_stock)
    consumed = 0
    grade_sum = 0.0

    for g in range(QUALITY_MAX, 0, -1):
        if consumed >= to_consume:
            break
        take = min(updated[g], to_consume - consumed)
        updated[g] -= take
        grade_sum   += take * g
        consumed    += take

    rm_mean = grade_sum / consumed if consumed > 0 else 0.0
    return updated, consumed, rm_mean


def _assemble_drones(component_arrays: Dict[str, List[int]]) -> List[int]:
    """
    Combine six component arrays into a drone quality array.
    Uses weakest-link softmax blended with simple average.

    drone_grade = (1 - LAMBDA) * simple_avg + LAMBDA * softmax_weakest_link_avg
    """
    drone_array = [0] * 101

    # Find the minimum produced across all components
    min_produced = min(sum(arr[1:]) for arr in component_arrays.values())
    if min_produced == 0:
        return drone_array

    for _ in range(min_produced):
        grades = []
        for comp_arr in component_arrays.values():
            # Sample one unit from each component proportionally
            total = sum(comp_arr[1:])
            if total == 0:
                grades.append(0)
                continue
            r = random.randint(1, total)
            cumulative = 0
            for g in range(1, 101):
                cumulative += comp_arr[g]
                if cumulative >= r:
                    grades.append(g)
                    break

        simple_avg = sum(grades) / len(grades)

        # Softmax weakest link
        min_g = min(grades)
        weights = [math.exp(-ASSEMBLY_BETA * (g - min_g)) for g in grades]
        wl_avg  = sum(w * g for w, g in zip(weights, grades)) / sum(weights)

        final = (1 - ASSEMBLY_LAMBDA) * simple_avg + ASSEMBLY_LAMBDA * wl_avg
        drone_grade = int(np.clip(final, 0, QUALITY_MAX))
        drone_array[drone_grade] += 1

    return drone_array


# ── Main resolution ───────────────────────────────────────────────────────────

def resolve_production(
    db:    Session,
    team,
    cycle,
    rng:   Optional[np.random.Generator] = None,
) -> Dict:
    """
    Full production resolution for one team.

    Steps:
    1. Read MemoryProduction decisions.
    2. Apply automation upgrade if requested (deduct cost).
    3. Per component:
       a. Apply machine upgrade if requested.
       b. Apply maintenance (set degradation rate).
       c. Degrade machine condition.
       d. Compute effective machine grade.
       e. Apply R&D quality + consistency bonuses.
       f. Consume raw_stock (with yield R&D bonus).
       g. Draw component output array.
       h. Store in finished_stock.
    4. Process R&D investments from EventLedger.
    5. Assemble drones from finished_stock.
    6. Add drone output to Inventory.drone_stock.
    7. Deduct wages + maintenance costs.
    """
    if rng is None:
        rng = np.random.default_rng()

    mem: MemoryProduction = (
        db.query(MemoryProduction)
        .filter(MemoryProduction.team_id == team.id)
        .first()
    )
    decisions = mem.decisions if mem else {}

    inventory: Inventory = (
        db.query(Inventory).filter(Inventory.team_id == team.id).first()
    )
    if inventory is None:
        return {}

    slots: Dict[str, ComponentSlot] = {
        s.component.value: s
        for s in db.query(ComponentSlot)
        .filter(ComponentSlot.team_id == team.id)
        .all()
    }

    wage_level       = decisions.get("wage_level", "market")
    target_headcount = decisions.get("target_headcount",
                                      inventory.workforce_size)
    automation_level = inventory.automation_level.value \
                       if hasattr(inventory.automation_level, "value") \
                       else str(inventory.automation_level)

    # ── Automation upgrade ────────────────────────────────────────────────────
    upgrade_auto = decisions.get("upgrade_automation")
    if upgrade_auto and upgrade_auto != automation_level:
        upgrade_cost = AUTOMATION_UPGRADE_COST.get(upgrade_auto, 0.0)
        inventory.funds -= upgrade_cost
        inventory.automation_level = AutomationLevel(upgrade_auto)
        automation_level = upgrade_auto

    # ── Labour update ─────────────────────────────────────────────────────────
    # Workforce headcount
    inventory.workforce_size = max(0, target_headcount)

    # Morale from wages
    morale_delta = WAGE_MORALE_DELTA.get(wage_level, 0.0)

    # Morale from understaffing
    required_labour = _compute_required_labour(slots, automation_level)
    actual_labour   = inventory.workforce_size
    if required_labour > 0 and actual_labour < required_labour:
        understaffed_pct = (required_labour - actual_labour) / required_labour * 100
        morale_delta -= understaffed_pct * UNDERSTAFFING_MORALE_PENALTY

    inventory.morale = max(0.0, min(100.0, inventory.morale + morale_delta))

    # Skill update
    if inventory.morale >= MORALE_HIGH:
        inventory.skill_level = min(100.0,
                                     inventory.skill_level + SKILL_GAIN_HIGH_MORALE)
    elif inventory.morale <= MORALE_LOW:
        inventory.skill_level = max(0.0,
                                     inventory.skill_level + SKILL_GAIN_LOW_MORALE)

    # Labour events
    riot   = inventory.morale <= MORALE_RIOT
    strike = False  # can be set by a backroom deal EventLedger entry

    production_survival = 1.0
    if riot:
        production_survival = RIOT_SURVIVAL
    # (strike handled below if flagged in EventLedger)

    # ── Per-component processing ──────────────────────────────────────────────
    component_summaries = {}
    component_arrays    = {}

    for comp_val, slot in slots.items():
        comp_decisions = decisions.get(comp_val, {})
        maintenance  = comp_decisions.get("maintenance", "none")
        upgrade_to   = comp_decisions.get("upgrade_to")
        rnd_invest   = comp_decisions.get("rnd_invest")

        # Machine upgrade
        if upgrade_to:
            tier_cfg = MACHINE_TIERS.get(upgrade_to, {})
            slot.machine_tier_str  = upgrade_to
            slot.machine_condition = MACHINE_MAX_CONDITION
            inventory.funds       -= tier_cfg.get("buy", 0.0)

        # Maintenance & degradation
        maint_cost  = MAINTENANCE_COST.get(maintenance, 0.0)
        degrade_mult = MAINTENANCE_DEGRADE_MULT.get(maintenance, 1.0)
        tier_cfg     = MACHINE_TIERS.get(slot.machine_tier_str, MACHINE_TIERS["standard"])
        degrade_amt  = tier_cfg["degrade"] * degrade_mult

        if maintenance == "overhaul":
            # Recover condition up to overhaul cap
            recovery = min(OVERHAUL_RECOVERY_CAP,
                           MACHINE_MAX_CONDITION - slot.machine_condition)
            slot.machine_condition = min(MACHINE_MAX_CONDITION,
                                          slot.machine_condition + recovery)
        else:
            slot.machine_condition = max(0.0,
                                          slot.machine_condition - degrade_amt)

        inventory.funds -= maint_cost

        # R&D investment → create EventLedger entry
        if rnd_invest:
            _create_rnd_event(db, team, cycle,
                               comp_val,
                               rnd_invest.get("focus"),
                               rnd_invest.get("levels", 1))

        # Tick R&D events and apply arriving levels
        _tick_rnd_events(db, team, slot, comp_val)

        # Effective machine grade
        base_grade = tier_cfg["grade"]
        eff_grade  = _effective_machine_grade(base_grade, slot.machine_condition)
        eff_grade += slot.rnd_quality * RND_QUALITY_BONUS

        # Effective sigma
        sigma = _compute_sigma(
            BASE_SIGMA,
            automation_level,
            inventory.skill_level,
            slot.rnd_consistency,
            RND_CONSISTENCY_BONUS,
        )

        # Yield reduction
        yield_reduction = slot.rnd_yield * RND_YIELD_BONUS

        # Throughput (limited by machine and labour)
        throughput = tier_cfg["throughput"]
        if actual_labour < required_labour:
            labour_fraction = actual_labour / max(required_labour, 1)
            throughput      = int(throughput * labour_fraction)

        # Consume raw stock
        slot.raw_stock, consumed, rm_mean = _consume_raw_stock(
            slot.raw_stock, throughput, yield_reduction
        )

        # Blend RM grade with machine grade
        blended_mean = RM_WEIGHT * rm_mean + (1 - RM_WEIGHT) * eff_grade

        # Draw component output
        comp_arr = _draw_component_array(
            mean  = blended_mean,
            sigma = sigma,
            count = int(consumed * production_survival),
            rng   = rng,
        )

        # Store in finished_stock (carry-over from previous cycles stays there)
        existing_finished  = slot.finished_stock or [0] * 101
        slot.finished_stock = [existing_finished[i] + comp_arr[i]
                                for i in range(101)]

        component_arrays[comp_val] = slot.finished_stock
        component_summaries[comp_val] = {
            "units_produced":     sum(comp_arr[1:]),
            "machine_condition":  round(slot.machine_condition, 1),
            "effective_grade":    round(eff_grade, 1),
            "sigma":              round(sigma, 2),
            "rm_consumed":        consumed,
        }

    # ── Assemble drones ───────────────────────────────────────────────────────
    drone_array   = _assemble_drones(component_arrays)
    drones_built  = sum(drone_array[1:])

    # Subtract the consumed finished_stock
    for comp_val, slot in slots.items():
        built = drones_built
        remaining = list(slot.finished_stock)
        for g in range(QUALITY_MAX, 0, -1):
            if built <= 0:
                break
            take = min(remaining[g], built)
            remaining[g] -= take
            built -= take
        slot.finished_stock = remaining

    # Add to drone_stock
    existing_drones      = inventory.drone_stock or [0] * 101
    inventory.drone_stock = [existing_drones[i] + drone_array[i]
                              for i in range(101)]

    # ── Wages ─────────────────────────────────────────────────────────────────
    wage_total = (
        inventory.workforce_size
        * WAGE_COST_PER_WORKER.get(wage_level, 500.0)
    )
    inventory.funds -= round(wage_total, 2)

    db.flush()

    return {
        "drones_built":      drones_built,
        "riot":              riot,
        "components":        component_summaries,
        "wage_total":        round(wage_total, 2),
        "current_funds":     round(inventory.funds, 2),
    }


def _compute_required_labour(
    slots: Dict[str, ComponentSlot], automation_level: str
) -> int:
    total = 0
    for slot in slots.values():
        tier_cfg    = MACHINE_TIERS.get(slot.machine_tier_str, MACHINE_TIERS["standard"])
        base_labour = tier_cfg["labour"]
        multiplier  = AUTOMATION_LABOUR_MULT.get(automation_level, 1.0)
        total      += int(base_labour * multiplier)
    return total


def _create_rnd_event(db: Session, team, cycle, component: str,
                       focus: str, levels: int) -> None:
    from models.deals import EventLedger
    from core.enums import EventStatus, EventType
    event = EventLedger(
        game_id          = team.game_id,
        team_id          = team.id,
        event_type       = EventType.RND_INVESTMENT,
        status           = EventStatus.ACTIVE,
        cycles_remaining = RND_CYCLES_PER_LEVEL,
        payload          = {
            "component":        component,
            "focus":            focus,
            "level_arriving":   levels,
        },
        notes = f"R&D: {component} {focus} +{levels}",
    )
    cost = levels * 10_000.0
    from industrix.models.procurement import Inventory
    inv = db.query(Inventory).filter(Inventory.team_id == team.id).first()
    if inv:
        inv.funds -= cost
    db.add(event)


def _tick_rnd_events(db: Session, team, slot: ComponentSlot,
                      comp_val: str) -> None:
    """Decrement cycles_remaining on R&D events; apply if arriving."""
    from models.deals import EventLedger
    from core.enums import EventStatus, EventType

    events = (
        db.query(EventLedger)
        .filter(
            EventLedger.team_id    == team.id,
            EventLedger.event_type == EventType.RND_INVESTMENT,
            EventLedger.status     == EventStatus.ACTIVE,
        )
        .all()
    )
    for ev in events:
        p = ev.payload or {}
        if p.get("component") != comp_val:
            continue
        ev.cycles_remaining -= 1
        if ev.cycles_remaining <= 0:
            focus          = p.get("focus", "quality")
            level_arriving = p.get("level_arriving", 1)
            if focus == "quality":
                slot.rnd_quality = min(MAX_RND_LEVEL,
                                        slot.rnd_quality + level_arriving)
            elif focus == "consistency":
                slot.rnd_consistency = min(MAX_RND_LEVEL,
                                            slot.rnd_consistency + level_arriving)
            elif focus == "yield":
                slot.rnd_yield = min(MAX_RND_LEVEL,
                                      slot.rnd_yield + level_arriving)
            ev.status = EventStatus.RESOLVED