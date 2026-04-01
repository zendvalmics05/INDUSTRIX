"""
services/sales.py
=================
Sales resolution engine.

resolve_sales(db, team, cycle, rng)
    Reads MemorySales, classifies drone_stock into quality tiers,
    applies per-tier actions, runs market simulation, updates
    Inventory.drone_stock and funds.

seed_sales_memory(db, team)
    Creates MemorySales row for a new team with safe defaults.
"""
import math
import random
from typing import Dict, List, Optional, Tuple

import numpy as np
from sqlalchemy.orm import Session

from core.config import (
    BASE_MARKET_CAPACITY, BLACK_MKT_DISCOVERY_BASE, BLACK_MKT_FINE_MULTIPLIER,
    BRAND_DECAY, BRAND_DELTA_BLACK_MKT_FOUND, BRAND_DELTA_BLACK_MKT_HIDDEN,
    BRAND_DELTA_PREMIUM_SELL, BRAND_DELTA_STANDARD_SELL,
    BRAND_DELTA_SUBSTANDARD_SELL, BRAND_DEMAND_EXPONENT, BRAND_TIERS,
    HOLDING_COST_PER_UNIT, MAX_BRAND_LENIENCY, MAX_MARKET_SHARE,
    PRICE_ELASTICITY, PRICE_PREMIUM_NORMAL, PRICE_PREMIUM_SELL,
    PRICE_REJECT_BLACK_MKT, PRICE_REJECT_SCRAP, PRICE_STANDARD,
    PRICE_SUBSTANDARD,
)
from core.enums import BrandTier, QualityTier, SalesAction
from models.procurement import Inventory
from models.sales import MemorySales


# ── Seeding ───────────────────────────────────────────────────────────────────

DEFAULT_SALES_DECISIONS = {
    "reject":      {"action": "scrap",           "price_override": None},
    "substandard": {"action": "sell_discounted",  "price_override": None},
    "standard":    {"action": "sell_market",      "price_override": None},
    "premium":     {"action": "sell_premium",     "price_override": None},
}


def seed_sales_memory(db: Session, team) -> MemorySales:
    mem = MemorySales(team_id=team.id, decisions=DEFAULT_SALES_DECISIONS.copy())
    db.add(mem)
    db.flush()
    return mem


# ── Tier classification ───────────────────────────────────────────────────────

def classify_drones(
    drone_stock: List[int],
    qr_hard: float,
    qr_soft: float,
    qr_premium: float,
) -> Dict[str, int]:
    """
    Split drone_stock into quality tier counts.
    Returns {"reject": N, "substandard": N, "standard": N, "premium": N}
    """
    counts = {"reject": 0, "substandard": 0, "standard": 0, "premium": 0}
    for g in range(1, 101):
        n = drone_stock[g]
        if n == 0:
            continue
        if g < qr_hard:
            counts["reject"] += n
        elif g < qr_soft:
            counts["substandard"] += n
        elif g < qr_premium:
            counts["standard"] += n
        else:
            counts["premium"] += n
    return counts


# ── Brand ─────────────────────────────────────────────────────────────────────

def compute_brand_tier(score: float) -> BrandTier:
    tier = BrandTier.POOR
    for t, threshold in sorted(BRAND_TIERS.items(), key=lambda x: x[1]):
        if score >= threshold:
            tier = BrandTier(t)
    return tier


def _update_brand(inventory: Inventory, tier_sold: Dict[str, int],
                   black_mkt_found: bool, black_mkt_hidden: bool) -> None:
    delta = 0.0
    if tier_sold.get("premium", 0) > 0:
        delta += BRAND_DELTA_PREMIUM_SELL
    if tier_sold.get("standard", 0) > 0:
        delta += BRAND_DELTA_STANDARD_SELL
    if tier_sold.get("substandard", 0) > 0:
        delta += BRAND_DELTA_SUBSTANDARD_SELL
    if black_mkt_found:
        delta += BRAND_DELTA_BLACK_MKT_FOUND
    elif black_mkt_hidden:
        delta += BRAND_DELTA_BLACK_MKT_HIDDEN

    inventory.brand_score *= BRAND_DECAY
    inventory.brand_score  = max(0.0, min(100.0, inventory.brand_score + delta))
    inventory.brand_tier   = compute_brand_tier(inventory.brand_score)


# ── Market simulation ─────────────────────────────────────────────────────────

def _market_allocation(
    team_inputs: List[Dict],
    market_capacity: int,
) -> Dict[int, int]:
    """
    Allocate market demand across teams proportionally by brand weight.
    Returns {team_id: units_can_sell}.
    """
    if not team_inputs:
        return {}

    # Brand weights
    weights = {}
    for inp in team_inputs:
        w = (inp["brand_score"] ** BRAND_DEMAND_EXPONENT) * inp.get("demand_mult", 1.0)
        weights[inp["team_id"]] = max(0.0, w)

    total_weight = sum(weights.values()) or 1.0
    allocation   = {}

    for inp in team_inputs:
        share      = weights[inp["team_id"]] / total_weight
        share      = min(share, MAX_MARKET_SHARE)
        cap        = int(market_capacity * share)
        allocation[inp["team_id"]] = min(cap, inp["units_offered"])

    return allocation


# ── Main resolution ───────────────────────────────────────────────────────────

def resolve_sales(
    db:        Session,
    team,
    cycle,
    all_teams: List,
    rng:       Optional[np.random.Generator] = None,
) -> Dict:
    """
    Full sales resolution for one team.

    all_teams is the list of all active teams in the game — needed for
    the market allocation which is cross-team.

    Returns a per-tier summary dict.
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

    drone_stock = inventory.drone_stock or [0] * 101
    tier_counts = classify_drones(
        drone_stock,
        cycle.qr_hard,
        cycle.qr_soft,
        cycle.qr_premium,
    )

    # Count units offered to market (not HOLD, SCRAP, or BLACK_MARKET)
    units_offered = sum(
        count for tier, count in tier_counts.items()
        if decisions.get(tier, {}).get("action") in (
            "sell_market", "sell_premium", "sell_discounted"
        )
    )

    # Market allocation (simplified: allocate for this team based on all teams)
    # Build minimal inputs for all teams
    all_inputs = []
    for t in all_teams:
        inv_t = db.query(Inventory).filter(Inventory.team_id == t.id).first()
        mem_t = db.query(MemorySales).filter(MemorySales.team_id == t.id).first()
        if not inv_t:
            continue
        stock_t = inv_t.drone_stock or [0] * 101
        tiers_t = classify_drones(stock_t, cycle.qr_hard,
                                   cycle.qr_soft, cycle.qr_premium)
        dec_t   = mem_t.decisions if mem_t else DEFAULT_SALES_DECISIONS.copy()
        offered_t = sum(
            cnt for tier, cnt in tiers_t.items()
            if dec_t.get(tier, {}).get("action") in (
                "sell_market", "sell_premium", "sell_discounted"
            )
        )
        all_inputs.append({
            "team_id":      t.id,
            "brand_score":  inv_t.brand_score,
            "units_offered": offered_t,
            "demand_mult":  1.0,  # backroom deals modify this via EventLedger
        })

    market_capacity = int(
        BASE_MARKET_CAPACITY * cycle.market_demand_multiplier
    )
    allocation = _market_allocation(all_inputs, market_capacity)
    can_sell   = allocation.get(team.id, 0)

    # ── Per-tier resolution ───────────────────────────────────────────────────
    total_revenue   = 0.0
    total_held      = 0
    total_scrapped  = 0
    black_mkt_units = 0
    black_mkt_rev   = 0.0
    tier_sold       = {}
    new_drone_stock = [0] * 101

    sold_so_far = 0
    # Walk grades from highest to lowest, assigning to tiers
    grade_ptr = list(drone_stock)  # working copy

    for tier_val in ["premium", "standard", "substandard", "reject"]:
        count   = tier_counts[tier_val]
        dec     = decisions.get(tier_val, {})
        action  = dec.get("action", "scrap")
        p_over  = dec.get("price_override")

        if count == 0:
            continue

        if action == "scrap" or (tier_val == "reject" and action == "scrap"):
            total_revenue  += count * PRICE_REJECT_SCRAP
            total_scrapped += count

        elif action == "black_market":
            black_mkt_units += count
            black_mkt_rev   += count * PRICE_REJECT_BLACK_MKT

        elif action == "hold":
            total_held += count
            # Put back into new_drone_stock (by grade)
            remaining = count
            for g in range(100, 0, -1):
                if remaining <= 0:
                    break
                take = min(grade_ptr[g], remaining)
                new_drone_stock[g] += take
                grade_ptr[g]       -= take
                remaining          -= take

        else:
            # Sell actions: sell_market, sell_premium, sell_discounted
            can_take  = min(count, max(0, can_sell - sold_so_far))
            unsold    = count - can_take

            if can_take > 0:
                if action == "sell_premium" and tier_val == "premium":
                    price = p_over or PRICE_PREMIUM_SELL
                elif action == "sell_discounted":
                    price = p_over or PRICE_SUBSTANDARD
                elif tier_val == "standard":
                    price = p_over or PRICE_STANDARD
                elif tier_val == "premium":
                    price = p_over or PRICE_PREMIUM_NORMAL
                elif tier_val == "substandard":
                    price = p_over or PRICE_SUBSTANDARD
                else:
                    price = PRICE_REJECT_SCRAP

                total_revenue     += can_take * price
                sold_so_far       += can_take
                tier_sold[tier_val] = can_take

            # Unsold units — hold automatically
            if unsold > 0:
                total_held += unsold
                remaining   = unsold
                for g in range(100, 0, -1):
                    if remaining <= 0:
                        break
                    take = min(grade_ptr[g], remaining)
                    new_drone_stock[g] += take
                    grade_ptr[g]       -= take
                    remaining          -= take

    # ── Black market discovery ────────────────────────────────────────────────
    black_mkt_found  = False
    black_mkt_hidden = False
    black_mkt_fine   = 0.0

    if black_mkt_units > 0:
        total_produced = sum(drone_stock[1:]) or 1
        p_discover     = (
            BLACK_MKT_DISCOVERY_BASE
            * (black_mkt_units / total_produced)
        )
        if random.random() < p_discover:
            black_mkt_fine  = black_mkt_rev * BLACK_MKT_FINE_MULTIPLIER
            black_mkt_found = True
        else:
            total_revenue  += black_mkt_rev
            black_mkt_hidden = True

    # ── Holding cost ──────────────────────────────────────────────────────────
    holding_cost = total_held * HOLDING_COST_PER_UNIT
    total_revenue -= holding_cost + black_mkt_fine

    # ── Brand update ──────────────────────────────────────────────────────────
    _update_brand(inventory, tier_sold, black_mkt_found, black_mkt_hidden)

    # ── Update inventory ──────────────────────────────────────────────────────
    inventory.drone_stock  = new_drone_stock
    inventory.funds        = round(inventory.funds + total_revenue, 2)
    inventory.cumulative_profit = round(
        inventory.cumulative_profit + total_revenue, 2
    )

    db.flush()

    return {
        "units_sold":       sold_so_far,
        "units_held":       total_held,
        "units_scrapped":   total_scrapped,
        "black_mkt_units":  black_mkt_units,
        "black_mkt_found":  black_mkt_found,
        "black_mkt_fine":   round(black_mkt_fine, 2),
        "total_revenue":    round(total_revenue, 2),
        "holding_cost":     round(holding_cost, 2),
        "brand_score":      round(inventory.brand_score, 2),
        "closing_funds":    round(inventory.funds, 2),
        "tier_sold":        tier_sold,
    }