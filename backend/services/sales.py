"""
services/sales.py
=================
Sales resolution engine.

Scope (updated):
  Phase 1 — Assembly: pull finished components from stock, assemble drones.
             Player controls units_to_assemble (0 to max possible).
             Max possible = min(finished_stock total) across all six components.
  Phase 2 — Selling: classify assembled + carried drone stock into tiers,
             apply per-tier actions, run market allocation.
  Phase 3 — Financial: loan interest, fines, tax refunds (end of sales).

seed_sales_memory(db, team)
    Seeding helper.
"""
import math
import random
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import numpy as np
from sqlalchemy.orm import Session

from core.config import (
    ASSEMBLY_BETA, ASSEMBLY_LAMBDA, TIER_FALLBACK,
    BASE_MARKET_CAPACITY, BLACK_MKT_DISCOVERY_BASE, BLACK_MKT_FINE_MULTIPLIER,
    BRAND_DECAY, BRAND_DELTA_BLACK_MKT_FOUND, BRAND_DELTA_BLACK_MKT_HIDDEN,
    BRAND_DELTA_PRICE_MAX, BRAND_TIERS,
    HOLDING_COST_PER_UNIT, MAX_MARKET_SHARE, PRICE_ELASTICITY,
    PRICE_PREMIUM_NORMAL, PRICE_PREMIUM_SELL, PRICE_REJECT_BLACK_MKT,
    PRICE_REJECT_REWORK, PRICE_REJECT_SCRAP, PRICE_STANDARD, PRICE_SUBSTANDARD, QUALITY_MAX,
)
from core.enums import (
    BrandTier, ComponentType, EventPhase, EventStatus, EventType,
    QualityTier, SalesAction,
)
from models.deals import Event
from models.game import Game
from models.procurement import ComponentSlot, Inventory
from models.sales import MemorySales
from models.market import MarketFaction


# ── Seeding ───────────────────────────────────────────────────────────────────

DEFAULT_SALES_DECISIONS = {
    "units_to_assemble": None,   # None = assemble maximum possible
    "reject":      {"action": "scrap",          "price_override": None},
    "substandard": {"action": "sell_discounted", "price_override": None},
    "standard":    {"action": "sell_market",     "price_override": None},
    "premium":     {"action": "sell_premium",    "price_override": None},
}


def seed_sales_memory(db: Session, team) -> MemorySales:
    mem = MemorySales(team_id=team.id, decisions=DEFAULT_SALES_DECISIONS.copy())
    db.add(mem)
    db.flush()
    return mem


# ── Event loading ─────────────────────────────────────────────────────────────

def _load_phase_events(
    db: Session, team_id: int, cycle_id: int, phase: EventPhase
) -> List[Event]:
    return (
        db.query(Event)
        .filter(
            Event.cycle_id       == cycle_id,
            Event.target_team_id == team_id,
            Event.phase          == phase,
            Event.status         == EventStatus.PENDING,
        )
        .all()
    )


def _load_global_financial_events(
    db: Session, cycle_id: int
) -> List[Event]:
    return (
        db.query(Event)
        .filter(
            Event.cycle_id       == cycle_id,
            Event.target_team_id == None,
            Event.phase          == EventPhase.SALES,
            Event.event_type     == EventType.GLOBAL_MARKET_SHIFT,
            Event.status         == EventStatus.PENDING,
        )
        .all()
    )


def _mark_applied(events: List[Event]) -> None:
    now = datetime.utcnow()
    for ev in events:
        ev.status     = EventStatus.APPLIED
        ev.applied_at = now


# ── Brand ─────────────────────────────────────────────────────────────────────

def compute_brand_tier(score: float) -> BrandTier:
    tier = BrandTier.POOR
    for t, threshold in sorted(BRAND_TIERS.items(), key=lambda x: x[1]):
        if score >= threshold:
            tier = BrandTier(t)
    return tier


def _update_brand(
    inventory:           Inventory,
    avg_discount_frac:   float,   # (price_ceiling - sell_price) / price_ceiling, averaged over all sold units
    black_mkt_found:     bool,
    black_mkt_hidden:    bool,
) -> float:
    """
    Brand rises when you sell below the faction price ceiling (good value).
    avg_discount_frac = 0  → sold at exactly the ceiling → no gain.
    avg_discount_frac = 1  → sold at free → BRAND_DELTA_PRICE_MAX gain (theoretical).
    Black-market penalties are unchanged.
    """
    old_score = inventory.brand_score
    delta = avg_discount_frac * BRAND_DELTA_PRICE_MAX
    if black_mkt_found:
        delta += BRAND_DELTA_BLACK_MKT_FOUND
    elif black_mkt_hidden:
        delta += BRAND_DELTA_BLACK_MKT_HIDDEN

    inventory.brand_score *= BRAND_DECAY
    inventory.brand_score  = max(0.0, min(100.0, inventory.brand_score + delta))
    inventory.brand_tier   = compute_brand_tier(inventory.brand_score)
    return round(inventory.brand_score - old_score, 2)


# ── Tier classification ───────────────────────────────────────────────────────

def classify_drones(
    drone_stock: List[int],
    qr_hard:     float,
    qr_soft:     float,
    qr_premium:  float,
) -> Dict[str, int]:
    counts = {"reject": 0, "substandard": 0, "standard": 0, "premium": 0}
    for g in range(1, 101):
        n = drone_stock[g]
        if n == 0:
            continue
        if g < qr_hard:
            counts["reject"]      += n
        elif g < qr_soft:
            counts["substandard"] += n
        elif g < qr_premium:
            counts["standard"]    += n
        else:
            counts["premium"]     += n
    return counts


# ── Assembly ──────────────────────────────────────────────────────────────────

def _assemble_drones(
    slots:           Dict[str, ComponentSlot],
    units_requested: int,
    rng:             np.random.Generator,
) -> Tuple[List[int], Dict[str, List[int]]]:
    """
    Assemble up to units_requested drones from finished component stocks.

    Maximum possible = min(total finished stock) across all six components.
    If units_requested > max_possible, clamp to max_possible.

    Uses the weakest-link + simple-average blend formula from config.

    Returns:
        drone_array       : int[101] — newly assembled drones
        updated_fin_stocks: {comp_val: int[101]} — remaining finished stock
                            after assembly consumed components
    """
    all_comps = [c.value for c in ComponentType]

    fin_stocks: Dict[str, List[int]] = {
        comp_val: list(slots[comp_val].finished_stock or [0] * 101)
        for comp_val in all_comps
        if comp_val in slots
    }

    # Max assembleable = constrained by the scarcest component
    max_possible = min(sum(arr[1:]) for arr in fin_stocks.values()) \
                   if fin_stocks else 0
    to_assemble  = max(0, min(units_requested, max_possible))

    drone_array = [0] * 101

    for _ in range(to_assemble):
        grades = []
        for comp_val in all_comps:
            arr   = fin_stocks.get(comp_val, [0] * 101)
            total = sum(arr[1:])
            if total == 0:
                grades.append(0)
                continue
            r = random.randint(1, total)
            cumulative = 0
            for g in range(1, 101):
                cumulative += arr[g]
                if cumulative >= r:
                    arr[g] -= 1   # consume one unit
                    grades.append(g)
                    break

        # Weakest-link blend
        simple_avg = sum(grades) / len(grades)
        min_g      = min(grades)
        weights    = [math.exp(-ASSEMBLY_BETA * (g - min_g)) for g in grades]
        wl_avg     = sum(w * g for w, g in zip(weights, grades)) / sum(weights)
        final      = (1 - ASSEMBLY_LAMBDA) * simple_avg + ASSEMBLY_LAMBDA * wl_avg
        drone_grade = int(np.clip(final, 0, QUALITY_MAX))
        drone_array[drone_grade] += 1

    return drone_array, fin_stocks


def get_assembly_projections(
    slots:           Dict[str, ComponentSlot],
    units_requested: int,
    rng:             Optional[np.random.Generator] = None,
) -> Tuple[List[int], str, int]:
    """
    Project the quality distribution and identify the bottleneck for assembly.
    Does NOT modify slots/database.
    
    Returns:
        drone_distribution: int[101] — projected counts per grade.
        bottleneck:         str — component name that is the tightest constraint.
        max_possible:       int — total drones that can be built.
    """
    if rng is None:
        rng = np.random.default_rng()

    all_comps = [c.value for c in ComponentType]
    
    # Calculate totals and identify bottleneck
    comp_totals = {}
    for cv in all_comps:
        if cv in slots:
            comp_totals[cv] = sum(slots[cv].finished_stock[1:]) if slots[cv].finished_stock else 0
        else:
            comp_totals[cv] = 0
            
    max_possible = min(comp_totals.values()) if comp_totals else 0
    bottleneck   = min(comp_totals, key=comp_totals.get) if comp_totals else "none"
    
    # We only project if units_requested > 0
    to_project = max(0, min(units_requested, max_possible))
    drone_arr  = [0] * 101
    
    if to_project > 0:
        # Create a deep copy for simulation
        sim_stocks = {
            cv: list(slots[cv].finished_stock or [0]*101)
            for cv in all_comps if cv in slots
        }
        
        for _ in range(to_project):
            grades = []
            for cv in all_comps:
                arr   = sim_stocks.get(cv, [0]*101)
                total = sum(arr[1:])
                if total <= 0:
                    grades.append(0)
                    continue
                r = rng.integers(1, total, endpoint=True)
                cum = 0
                for g in range(1, 101):
                    cum += arr[g]
                    if cum >= r:
                        arr[g] = max(0, arr[g] - 1)
                        grades.append(g)
                        break
            
            # Blend formula (weakest link + simple average)
            if grades:
                simple_avg = sum(grades) / len(grades)
                min_g      = min(grades)
                weights    = [math.exp(-ASSEMBLY_BETA * (g - min_g)) for g in grades]
                wl_avg     = sum(w * g for w, g in zip(weights, grades)) / sum(weights)
                final      = (1 - ASSEMBLY_LAMBDA) * simple_avg + ASSEMBLY_LAMBDA * wl_avg
                grade      = int(np.clip(final, 0, QUALITY_MAX))
                drone_arr[grade] += 1
                
    return drone_arr, bottleneck, max_possible


# ── Market allocation — faction-based ────────────────────────────────────────
#
# Replaces the old brand-weight proportional split.
# Each faction is an independent rational buyer with a fixed price ceiling,
# volume target, tier preference, and flexibility to step down one tier.
#
# Algorithm per faction:
#   1. Collect all units on the market that match the faction's tier_preference
#      at or below price_ceiling, from teams whose brand_score >= faction.brand_min.
#   2. Sort candidates: price ascending (cheapest first), then brand descending
#      as a tiebreaker (brand still matters, just not as the primary axis).
#   3. Buy greedily until volume is exhausted or supply runs out.
#   4. If volume not filled and flexibility > 0, step down one tier and repeat
#      with remaining_appetite = remaining_volume × flexibility.
#   5. Faction stops — they will NOT raise their price ceiling.
#
# Returns:
#   allocation: {team_id: units_sold_to_market}   (aggregate across all factions)
#   detail:     list of per-faction purchase records (for debrief display)

def _run_faction_market(
    db:          "Session",
    cycle,
    team_inputs: List[Dict],
    # team_inputs: [{
    #   "team_id":    int,
    #   "brand_score": float,
    #   "offerings":  {tier_val: {"units": int, "price": float}},
    #                  — tier_val: how many units at what price for that tier
    # }]
) -> Tuple[Dict[int, int], List[Dict]]:
    """
    Run the faction-based market simulation.
    Returns (allocation, faction_detail).
    """
    # Load active factions for this game.
    game_id  = cycle.game_id
    factions = (
        db.query(MarketFaction)
        .filter(MarketFaction.game_id == game_id, MarketFaction.is_active == True)
        .all()
    )

    # Allocation accumulator: team_id → total units sold across all factions.
    allocation: Dict[int, int] = {inp["team_id"]: 0 for inp in team_inputs}

    # Discount accumulator: team_id → (total weighted discount, total units)
    # weighted_discount += units_bought * (1 - sell_price / faction.price_ceiling)
    discount_numerator:   Dict[int, float] = {inp["team_id"]: 0.0 for inp in team_inputs}
    discount_denominator: Dict[int, int]   = {inp["team_id"]: 0   for inp in team_inputs}

    # Mutable supply pool: {team_id: {tier_val: remaining_units}}
    supply: Dict[int, Dict[str, int]] = {}
    for inp in team_inputs:
        supply[inp["team_id"]] = {
            tier_val: info["units"]
            for tier_val, info in inp["offerings"].items()
        }

    faction_detail = []

    for faction in factions:
        # Apply global demand multiplier to faction volume.
        effective_volume = int(faction.volume * cycle.market_demand_multiplier)
        remaining        = effective_volume
        faction_purchases: Dict[int, Dict[str, int]] = {} # team_id -> {tier_val: units}
        current_tier     = faction.tier_preference
        first_pass       = True

        while remaining > 0 and current_tier is not None:
            # Build candidate list for this tier.
            candidates = []
            for inp in team_inputs:
                team_id     = inp["team_id"]
                brand_score = inp["brand_score"]

                # Brand minimum check.
                if brand_score < faction.brand_min:
                    continue

                units_avail = supply[team_id].get(current_tier, 0)
                if units_avail <= 0:
                    continue

                price = inp["offerings"].get(current_tier, {}).get("price", 0.0)
                if price > faction.price_ceiling:
                    continue

                candidates.append({
                    "team_id":     team_id,
                    "price":       price,
                    "brand_score": brand_score,
                    "available":   units_avail,
                })

            # Sort: price ascending (primary), brand_score descending (tiebreaker).
            candidates.sort(key=lambda c: (c["price"], -c["brand_score"]))

            # Buy greedily.
            for c in candidates:
                if remaining <= 0:
                    break
                take = min(c["available"], remaining)
                supply[c["team_id"]][current_tier] -= take
                allocation[c["team_id"]]           += take
                # Accumulate discount data for brand calculation
                ceiling = faction.price_ceiling
                if ceiling > 0:
                    disc = (ceiling - c["price"]) / ceiling
                    discount_numerator[c["team_id"]]   += take * disc
                    discount_denominator[c["team_id"]] += take
                if c["team_id"] not in faction_purchases:
                    faction_purchases[c["team_id"]] = {}
                faction_purchases[c["team_id"]][current_tier] = (
                    faction_purchases[c["team_id"]].get(current_tier, 0) + take
                )
                remaining -= take

            # Step down to fallback tier if flexibility allows.
            if remaining > 0:
                if first_pass and faction.flexibility > 0:
                    remaining  = int(remaining * faction.flexibility)
                    current_tier = TIER_FALLBACK.get(current_tier)
                    first_pass   = False
                else:
                    break   # Faction is done — no more buying
            else:
                break

        faction_detail.append({
            "faction":          faction.name,
            "tier_preference":  faction.tier_preference,
            "price_ceiling":    faction.price_ceiling,
            "volume_target":    effective_volume,
            "volume_purchased": effective_volume - remaining,
            "purchases":        faction_purchases,
        })

    # Compute average discount fractions: {team_id: float 0.0-1.0}
    avg_discount: Dict[int, float] = {
        tid: (discount_numerator[tid] / discount_denominator[tid])
             if discount_denominator[tid] > 0 else 0.0
        for tid in allocation
    }

    return allocation, faction_detail, avg_discount


def _market_allocation(
    db:          "Session",
    cycle,
    team_inputs: List[Dict],
    market_capacity: int,
) -> Tuple[Dict[int, int], List[Dict], Dict[int, float]]:
    """
    Facade kept so callers don't need to change.
    Routes to _run_faction_market internally.
    Returns (allocation_dict, faction_detail, avg_discount_by_team).
    """
    return _run_faction_market(db, cycle, team_inputs)


# ── Sales event modifiers ─────────────────────────────────────────────────────

def _aggregate_sales_events(events: List[Event]) -> Dict:
    mods = {
        "block_fraction":     0.0,
        "demand_multiplier":  1.0,
        "price_pressure":     False,
        "threshold_reduction": 0.0,
        "gov_purchase_units": 0,
        "gov_purchase_price": 0.0,
        "audit_immune":       False,
    }
    for ev in events:
        p = ev.payload or {}
        if ev.event_type == EventType.MARKET_LIMIT:
            mods["block_fraction"] = min(
                0.95, mods["block_fraction"] + p.get("block_fraction", 0.0)
            )
        elif ev.event_type == EventType.DEMAND_SUPPRESSION:
            mods["demand_multiplier"] *= p.get("demand_multiplier", 1.0)
        elif ev.event_type == EventType.DEMAND_BOOST:
            mods["demand_multiplier"] *= p.get("demand_multiplier", 1.0)
        elif ev.event_type == EventType.PRICE_PRESSURE:
            mods["price_pressure"] = True
        elif ev.event_type == EventType.QUALITY_WAIVER:
            mods["threshold_reduction"] += p.get("threshold_reduction", 0.0)
        elif ev.event_type == EventType.GOV_PURCHASE:
            mods["gov_purchase_units"] += p.get("units", 0)
            mods["gov_purchase_price"]  = p.get("price_per_unit", 2_800.0)
        elif ev.event_type == EventType.AUDIT_IMMUNITY:
            mods["audit_immune"] = True
    return mods


# ── Financial events ──────────────────────────────────────────────────────────

def _resolve_financial_events(
    db:          Session,
    team,
    cycle,
    inventory:   Inventory,
    total_costs: float,
) -> Tuple[float, List[Event]]:
    fin_events = _load_phase_events(db, team.id, cycle.id, EventPhase.FINANCIAL)
    adjustment = 0.0

    from models.procurement import Transaction

    for ev in fin_events:
        p = ev.payload or {}
        if ev.event_type == EventType.LOAN_INTEREST:
            amount    = p.get("amount", 0.0)
            lender_id = p.get("lender_team_id")
            inventory.funds -= amount
            adjustment      -= amount
            
            # Record Transaction
            db.add(Transaction(
                team_id=inventory.team_id, cycle_number=cycle.cycle_number,
                delta=-amount, balance=inventory.funds,
                type="Event", description=f"Loan Interest Payment ({'Gov' if not lender_id else 'Private'})"
            ))

            if lender_id:
                lender_inv = (
                    db.query(Inventory)
                    .filter(Inventory.team_id == lender_id)
                    .first()
                )
                if lender_inv:
                    lender_inv.funds += amount
                    db.add(Transaction(
                        team_id=lender_id, cycle_number=cycle.cycle_number,
                        delta=amount, balance=lender_inv.funds,
                        type="Event", description=f"Interest Dividend from Team {inventory.team_id}"
                    ))
        elif ev.event_type == EventType.LOAN_REPAYMENT:
            amount    = p.get("amount", 0.0)
            lender_id = p.get("lender_team_id")
            inventory.funds -= amount
            adjustment      -= amount
            
            # Record Transaction
            db.add(Transaction(
                team_id=inventory.team_id, cycle_number=cycle.cycle_number,
                delta=-amount, balance=inventory.funds,
                type="Event", description=f"Loan Principal Repayment ({'Gov' if not lender_id else 'Private'})"
            ))

            # Mark associated contract as APPLIED
            if ev.gov_deal_id:
                from models.deals import GovDeal, GovDealStatus
                contract = db.query(GovDeal).filter(GovDeal.id == ev.gov_deal_id).first()
                if contract:
                    contract.status = GovDealStatus.APPLIED

            if lender_id:
                lender_inv = (
                    db.query(Inventory)
                    .filter(Inventory.team_id == lender_id)
                    .first()
                )
                if lender_inv:
                    lender_inv.funds += amount
                    db.add(Transaction(
                        team_id=lender_id, cycle_number=cycle.cycle_number,
                        delta=amount, balance=lender_inv.funds,
                        type="Event", description=f"Principal Recovery from Team {inventory.team_id}"
                    ))
            else:
                # Government loan: check for any other pending gov loan events
                from core.enums import EventStatus
                remaining_debt = (
                    db.query(Event)
                    .filter(
                        Event.target_team_id == inventory.team_id,
                        Event.event_type.in_(
                            [EventType.LOAN_INTEREST, EventType.LOAN_REPAYMENT]
                        ),
                        Event.source_team_id == None,
                        Event.status == EventStatus.PENDING,
                        Event.id != ev.id,
                    )
                    .count()
                )
                if remaining_debt == 0:
                    inventory.has_gov_loan = False
        elif ev.event_type == EventType.ARBITRARY_FINE:
            fine             = p.get("fine_amount", 0.0)
            inventory.funds -= fine
            adjustment      -= fine
            db.add(Transaction(
                team_id=inventory.team_id, cycle_number=cycle.cycle_number,
                delta=-fine, balance=inventory.funds,
                type="Event", description=f"Ministry Fine: {ev.event_type.replace('_', ' ').title()}"
            ))
        elif ev.event_type == EventType.TAX_EVASION_REFUND:
            refund           = total_costs * p.get("refund_fraction", 0.0)
            inventory.funds += refund
            adjustment      += refund
            db.add(Transaction(
                team_id=inventory.team_id, cycle_number=cycle.cycle_number,
                delta=refund, balance=inventory.funds,
                type="Event", description="Tax Evasion Refund (Fiscal Subsidy)"
            ))

    return adjustment, fin_events


def _resolve_global_financial_events(
    db: Session, game: Game, cycle
) -> List[Event]:
    global_events = _load_global_financial_events(db, cycle.id)
    for ev in global_events:
        p = ev.payload or {}
        if "market_demand_multiplier_delta" in p:
            game.market_demand_multiplier = max(
                0.1,
                game.market_demand_multiplier
                + p["market_demand_multiplier_delta"],
            )
        for field in ("qr_hard", "qr_soft", "qr_premium"):
            delta_key = f"{field}_delta"
            if delta_key in p:
                current = getattr(game, field, 50.0)
                setattr(game, field,
                        max(0.0, min(100.0, current + p[delta_key])))

    # SYNC TO CYCLE SNAPSHOT: Ensure the current cycle uses the new values immediately.
    cycle.market_demand_multiplier = game.market_demand_multiplier
    cycle.qr_hard = game.qr_hard
    cycle.qr_soft = game.qr_soft
    cycle.qr_premium = game.qr_premium
    return global_events


# ── Main resolution ───────────────────────────────────────────────────────────

def resolve_sales(
    db:        Session,
    team,
    cycle,
    all_teams: List,
    rng:       Optional[np.random.Generator] = None,
) -> Dict:
    """
    Full sales + financial resolution for one team.

    Steps:
      1. Load sales-phase events, aggregate modifiers.
      2. Assemble drones from finished_stock (player-controlled quantity).
      3. Classify assembled + carried drone_stock into quality tiers.
      4. Market allocation across all teams.
      5. Per-tier selling actions.
      6. Black market, holding costs, brand update.
      7. Financial events (loans, fines, refunds).
      8. Update inventory, mark events applied.
    """
    if rng is None:
        rng = np.random.default_rng()

    inventory: Inventory = (
        db.query(Inventory).filter(Inventory.team_id == team.id).first()
    )
    mem: MemorySales = (
        db.query(MemorySales).filter(MemorySales.team_id == team.id).first()
    )
    decisions = mem.decisions if mem else DEFAULT_SALES_DECISIONS.copy()

    # ── Sales events ──────────────────────────────────────────────────────────
    sales_events = _load_phase_events(db, team.id, cycle.id, EventPhase.SALES)
    mods         = _aggregate_sales_events(sales_events)

    effective_qr_hard = max(0.0, cycle.qr_hard - mods["threshold_reduction"])

    # ── Load component slots for assembly ─────────────────────────────────────
    slots: Dict[str, ComponentSlot] = {
        s.component.value: s
        for s in db.query(ComponentSlot)
        .filter(ComponentSlot.team_id == team.id)
        .all()
    }

    # ── Assembly ──────────────────────────────────────────────────────────────
    raw_units_to_assemble = decisions.get("units_to_assemble")

    # Max possible = min finished stock across all components
    max_possible = min(
        sum(s.finished_stock[1:]) if s.finished_stock else 0
        for s in slots.values()
    ) if slots else 0

    if raw_units_to_assemble is None:
        units_to_assemble = max_possible       # assemble everything possible
    else:
        units_to_assemble = max(0, min(raw_units_to_assemble, max_possible))

    drone_arr, updated_fin_stocks = _assemble_drones(slots, units_to_assemble, rng)

    # Write updated finished stocks back
    for comp_val, new_stock in updated_fin_stocks.items():
        if comp_val in slots:
            slots[comp_val].finished_stock = new_stock

    drones_assembled = sum(drone_arr[1:])
    inventory.cumulative_units_produced += drones_assembled

    # Merge newly assembled drones into existing drone_stock
    existing_drone_stock = inventory.drone_stock or [0] * 101
    combined_stock = [existing_drone_stock[i] + drone_arr[i] for i in range(101)]

    # ── Classify drones ───────────────────────────────────────────────────────
    tier_counts = classify_drones(
        combined_stock, effective_qr_hard, cycle.qr_soft, cycle.qr_premium
    )

    # ── Market allocation ─────────────────────────────────────────────────────
    sell_actions = {"sell_market", "sell_premium", "sell_discounted"}

    units_offered = sum(
        count for tier, count in tier_counts.items()
        if decisions.get(tier, {}).get("action") in sell_actions
    )
    if mods["block_fraction"] > 0:
        units_offered = max(0, int(units_offered * (1.0 - mods["block_fraction"])))

    # ── Build per-team offerings for the faction market ──────────────────────
    # Each team's offering is structured as {tier_val: {units, price}}
    # so factions can compare price and quality across teams directly.

    TIER_DEFAULT_PRICES = {
        "premium":     PRICE_PREMIUM_NORMAL,
        "standard":    PRICE_STANDARD,
        "substandard": PRICE_SUBSTANDARD,
        "reject":      PRICE_REJECT_SCRAP,
    }

    all_inputs = []
    for t in all_teams:
        inv_t = db.query(Inventory).filter(Inventory.team_id == t.id).first()
        mem_t = db.query(MemorySales).filter(MemorySales.team_id == t.id).first()
        if not inv_t:
            continue

        # CRITICAL FIX: For the current team, use the freshly assembled stock.
        # Otherwise the market simulation sees 0 drones and no sales occur.
        if t.id == team.id:
            stock_t = combined_stock
        else:
            stock_t = inv_t.drone_stock or [0] * 101

        tiers_t = classify_drones(
            stock_t, cycle.qr_hard, cycle.qr_soft, cycle.qr_premium
        )
        dec_t = mem_t.decisions if mem_t else DEFAULT_SALES_DECISIONS.copy()

        # Apply per-team event demand modifiers (block_fraction still relevant).
        t_events = _load_phase_events(db, t.id, cycle.id, EventPhase.SALES)
        t_mods   = _aggregate_sales_events(t_events)

        offerings = {}
        for tier_val, count in tiers_t.items():
            dec_tier = dec_t.get(tier_val, {})
            action   = dec_tier.get("action", "scrap") if isinstance(dec_tier, dict) else "scrap"
            if action not in sell_actions:
                continue
            if count <= 0:
                continue

            # Apply block_fraction from events.
            effective_count = max(0, int(count * (1.0 - t_mods["block_fraction"])))
            if effective_count == 0:
                continue

            # Price: price_override > action-derived > tier default.
            p_over  = dec_tier.get("price_override") if isinstance(dec_tier, dict) else None
            if p_over:
                price = float(p_over)
            elif action == "sell_premium" and tier_val == "premium":
                price = PRICE_PREMIUM_SELL
            elif action == "sell_discounted":
                price = PRICE_SUBSTANDARD
            elif tier_val == "premium":
                price = PRICE_PREMIUM_NORMAL
            else:
                price = TIER_DEFAULT_PRICES.get(tier_val, PRICE_STANDARD)

            # Price pressure event: cap price at PRICE_SUBSTANDARD.
            if t_mods["price_pressure"]:
                price = min(price, PRICE_SUBSTANDARD)

            offerings[tier_val] = {"units": effective_count, "price": price}

        all_inputs.append({
            "team_id":    t.id,
            "brand_score": inv_t.brand_score,
            "offerings":  offerings,
        })

    market_capacity = int(BASE_MARKET_CAPACITY * cycle.market_demand_multiplier)
    allocation, faction_detail, avg_discount_by_team = _market_allocation(db, cycle, all_inputs, market_capacity)
    can_sell        = allocation.get(team.id, 0)
    avg_discount    = avg_discount_by_team.get(team.id, 0.0)

    # ── Government guaranteed purchase ────────────────────────────────────────
    gov_revenue = 0.0
    if mods["gov_purchase_units"] > 0:
        gov_revenue = mods["gov_purchase_units"] * mods["gov_purchase_price"]

    # ── Per-tier resolution ───────────────────────────────────────────────────
    revenue_by_tier = {
        "premium":     0.0,
        "standard":    0.0,
        "substandard": 0.0,
        "reject":      0.0
    }
    total_revenue_gross = gov_revenue  # Track total before costs
    total_held          = 0
    total_scrapped      = 0
    black_mkt_units     = 0
    black_mkt_rev       = 0.0
    tier_sold:      Dict[str, int] = {}
    new_drone_stock = [0] * 101
    sold_so_far     = 0
    grade_ptr       = list(combined_stock)

    # Build price_map for this team from the offerings we already computed.
    # This ensures the per-tier revenue calculation uses the exact same price
    # the faction market used when deciding to buy.
    team_offerings = next(
        (inp["offerings"] for inp in all_inputs if inp["team_id"] == team.id), {}
    )
    price_map = {tier_val: info["price"] for tier_val, info in team_offerings.items()}

    for tier_val in ["premium", "standard", "substandard", "reject"]:
        count  = tier_counts[tier_val]
        dec    = decisions.get(tier_val, {})
        action = dec.get("action", "scrap")
        p_over = dec.get("price_override")

        if count == 0:
            continue

        if action == "scrap":
            rev = count * PRICE_REJECT_SCRAP
            total_revenue_gross += rev
            revenue_by_tier["reject"] += rev
            total_scrapped += count

        elif action == "black_market":
            black_mkt_units += count
            black_mkt_rev   += count * PRICE_REJECT_BLACK_MKT

        elif action == "rework":
            rev = count * PRICE_REJECT_REWORK
            total_revenue_gross += rev
            revenue_by_tier["reject"] += rev
            total_scrapped += count   # treated as scrapped in terms of inventory cleanup

        elif action == "hold":
            total_held += count
            remaining   = count
            for g in range(QUALITY_MAX, 0, -1):
                if remaining <= 0:
                    break
                take = min(grade_ptr[g], remaining)
                new_drone_stock[g] += take
                grade_ptr[g]       -= take
                remaining          -= take

        else:
            can_take = min(count, max(0, can_sell - sold_so_far))
            unsold   = count - can_take

            if can_take > 0:
                # Use price_map (already accounts for price_pressure, overrides, actions).
                price = price_map.get(tier_val, PRICE_REJECT_SCRAP)
                rev   = can_take * price

                total_revenue_gross  += rev
                revenue_by_tier[tier_val] += rev
                sold_so_far         += can_take
                tier_sold[tier_val]  = can_take

            if unsold > 0:
                total_held += unsold
                remaining   = unsold
                for g in range(QUALITY_MAX, 0, -1):
                    if remaining <= 0:
                        break
                    take = min(grade_ptr[g], remaining)
                    new_drone_stock[g] += take
                    grade_ptr[g]       -= take
                    remaining          -= take

    # ── Black market ──────────────────────────────────────────────────────────
    black_mkt_found  = False
    black_mkt_hidden = False
    black_mkt_fine   = 0.0

    if black_mkt_units > 0:
        total_produced = sum(combined_stock[1:]) or 1
        p_discover = BLACK_MKT_DISCOVERY_BASE * (black_mkt_units / total_produced)
        
        # Audit immunity completely blocks discovery
        if not mods["audit_immune"] and random.random() < p_discover:
            black_mkt_fine  = black_mkt_rev * BLACK_MKT_FINE_MULTIPLIER
            black_mkt_found = True
        else:
            total_revenue_gross += black_mkt_rev
            revenue_by_tier["reject"] += black_mkt_rev
            black_mkt_hidden = True

    # ── Costs ─────────────────────────────────────────────────────────────────
    holding_cost           = total_held * HOLDING_COST_PER_UNIT
    sales_costs_this_cycle = holding_cost + black_mkt_fine
    final_net_revenue      = total_revenue_gross - sales_costs_this_cycle

    # ── Mark sales events applied ─────────────────────────────────────────────
    _mark_applied(sales_events)

    # ── Financial events ──────────────────────────────────────────────────────
    fin_adjustment, fin_events = _resolve_financial_events(
        db, team, cycle, inventory, sales_costs_this_cycle
    )
    _mark_applied(fin_events)

    # ── Brand update ──────────────────────────────────────────────────────────
    brand_delta = _update_brand(inventory, avg_discount, black_mkt_found, black_mkt_hidden)

    # ── Update inventory ──────────────────────────────────────────────────────
    inventory.drone_stock      = new_drone_stock
    # Note: final_net_revenue = gross - holding_cost - black_mkt_fine
    # However, financial events (loans/fines) were ALREADY processed inside inventory.funds 
    # within _resolve_financial_events.
    inventory.funds            = round(inventory.funds + final_net_revenue, 2)
    
    # Record Transactions
    from models.procurement import Transaction
    if total_revenue_gross > 0:
        db.add(Transaction(
            team_id=team.id, cycle_number=cycle.cycle_number,
            delta=round(total_revenue_gross, 2), balance=inventory.funds,
            type="Sales", description=f"Drone Sales Revenue ({sold_so_far} units)"
        ))
    if holding_cost > 0:
        db.add(Transaction(
            team_id=team.id, cycle_number=cycle.cycle_number,
            delta=-round(holding_cost, 2), balance=inventory.funds,
            type="Sales", description=f"Inventory Storage Fees ({total_held} units held)"
        ))
    if black_mkt_fine > 0:
        # Note: the fine was already deducted from final_net_revenue, which we just added.
        db.add(Transaction(
            team_id=team.id, cycle_number=cycle.cycle_number,
            delta=-round(black_mkt_fine, 2), balance=inventory.funds,
            type="Sales", description="Black Market Interdiction Penalty"
        ))

    inventory.cumulative_profit = round(
        inventory.cumulative_profit + final_net_revenue, 2
    )
    inventory.cumulative_revenue = round(
        inventory.cumulative_revenue + total_revenue_gross, 2
    )

    db.flush()

    # ── Restructure faction detail for frontend ──────────────────────────────
    faction_sales = []
    for f in faction_detail:
        purchases = f["purchases"].get(team.id, {})
        if not purchases:
            continue
        
        # Calculate precise revenue considering potential tier step-downs
        f_units = 0
        f_rev   = 0.0
        for t_val, t_units in purchases.items():
            f_units += t_units
            f_rev   += t_units * price_map.get(t_val, 0.0)

        faction_sales.append({
            "faction":        f["faction"],
            "tier":           f["tier_preference"],
            "units_sold":     f_units,
            "price_per_unit": round(f_rev / f_units, 2) if f_units > 0 else 0,
            "revenue":        round(f_rev, 2)
        })

    return {
        "cycle_number":      cycle.cycle_number,
        "drones_assembled":  drones_assembled,
        "units_sold":        sold_so_far,
        "units_held":        total_held,
        "units_scrapped":    total_scrapped,
        "revenue":           round(total_revenue_gross, 2), # Frontend uses gross for the main "REVENUE" highlight
        "holding_cost":      round(holding_cost, 2),
        "brand_delta":       brand_delta,
        "brand_score_after": round(inventory.brand_score, 2),
        "closing_funds":     round(inventory.funds, 2),
        "black_market_discovered": black_mkt_found,
        "faction_sales":     faction_sales,
        "revenue_by_tier":   {k: round(v, 2) for k, v in revenue_by_tier.items()},
        # Keep internal metadata
        "gov_purchase_rev":  round(gov_revenue, 2),
        "black_mkt_units":   black_mkt_units,
        "black_mkt_fine":    round(black_mkt_fine, 2),
        "fin_adjustment":    round(fin_adjustment, 2),
        "tier_sold":         tier_sold,
    }


def resolve_global_financial_events(db: Session, game: Game, cycle) -> None:
    events = _resolve_global_financial_events(db, game, cycle)
    _mark_applied(events)
    db.flush()
