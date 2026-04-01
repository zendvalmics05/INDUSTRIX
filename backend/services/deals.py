"""
services/deals.py
=================
Backroom deals and event ledger engine.

record_gov_deal(db, game, cycle, buyer, target, deal_type, bribe, ...)
    Validate, compute effect, deduct bribe, persist GovDeal.

record_event(db, game, team_id, event_type, cycles, payload, notes)
    Create an EventLedger row (loan, global event, backroom effect).

process_event_ledger(db, game)
    Called at the start of each new cycle.
    Ticks cycles_remaining on all active events.
    Applies effects. Marks resolved events.

roll_discovery(db, cycle)
    Called when the organiser closes the backroom phase.
    Rolls discovery for all PENDING GovDeals.
    Applies fines and brand hits on discovery.
"""
import math
import random
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from core.config import (
    BRAND_DELTA_DEAL_FOUND, DEAL_BASE_DISCOVERY, DEAL_BRIBE_FLOOR,
    DEAL_DISCOVERY_DECAY, DEAL_EFFECT_CAP, DEAL_FINE_MULTIPLIER,
    DEAL_LOG_SCALE_DIVISOR, DEAL_REPEAT_STACK_RATE, DEAL_SIZE_DISCOVERY_RATE,
    LEADERBOARD_NORMALISE, LEADERBOARD_WEIGHTS,
)
from core.enums import (
    EventStatus, EventType, GovDealStatus, GovDealType,
)
from models.deals import EventLedger, GovDeal
from models.procurement import Inventory


# ── Effect scale ──────────────────────────────────────────────────────────────

def _effect_scale(bribe: float, floor: float) -> float:
    if floor <= 0 or bribe <= floor:
        return 1.0
    return min(DEAL_EFFECT_CAP, 1.0 + math.log(bribe / floor) / DEAL_LOG_SCALE_DIVISOR)


# ── Discovery probability ─────────────────────────────────────────────────────

def _discovery_prob(deal_type: str, bribe: float, floor: float,
                     repeat: int) -> float:
    base      = DEAL_BASE_DISCOVERY.get(deal_type, 0.10)
    size_add  = math.log(bribe / floor) * DEAL_SIZE_DISCOVERY_RATE \
                if floor > 0 and bribe > floor else 0.0
    stack_add = (repeat - 1) * DEAL_REPEAT_STACK_RATE
    return min(1.0, max(0.0, base + size_add + stack_add))


# ── Record a government deal ──────────────────────────────────────────────────

def record_gov_deal(
    db:              Session,
    game,
    cycle,
    buyer_team,
    deal_type:       GovDealType,
    bribe_amount:    float,
    target_team=None,
    override_params: Optional[Dict] = None,
    notes:           Optional[str]  = None,
) -> GovDeal:
    """
    Validate and record a backroom deal.
    Bribe is deducted immediately. Effect is applied at next cycle start.
    """
    inv: Inventory = (
        db.query(Inventory)
        .filter(Inventory.team_id == buyer_team.id)
        .first()
    )
    if inv is None:
        raise ValueError("Buyer team has no inventory.")
    if inv.has_gov_loan:
        raise ValueError(
            f"Team '{buyer_team.name}' has an active gov loan — "
            "backroom deals are blocked."
        )

    floor = DEAL_BRIBE_FLOOR.get(deal_type.value, 0.0)
    if bribe_amount < floor:
        raise ValueError(
            f"Bribe {bribe_amount} is below the floor {floor} "
            f"for '{deal_type.value}'."
        )
    if inv.funds < bribe_amount:
        raise ValueError(
            f"Insufficient funds ({inv.funds:.0f}) for bribe {bribe_amount:.0f}."
        )

    is_offensive = deal_type.value.startswith("red_")
    if is_offensive and target_team is None:
        raise ValueError(f"'{deal_type.value}' requires a target team.")
    if not is_offensive and target_team is not None:
        raise ValueError(f"'{deal_type.value}' is a self-buff — no target needed.")
    if target_team and target_team.id == buyer_team.id:
        raise ValueError("Cannot target yourself.")

    scale   = _effect_scale(bribe_amount, floor)
    payload = _build_payload(deal_type.value, scale, override_params)

    # Count repeats this phase
    repeat = (
        db.query(GovDeal)
        .filter(
            GovDeal.negotiated_cycle_id == cycle.id,
            GovDeal.buyer_team_id       == buyer_team.id,
            GovDeal.deal_type           == deal_type,
            GovDeal.status.in_([GovDealStatus.PENDING, GovDealStatus.APPLIED]),
        )
        .count()
    ) + 1

    disc_prob = _discovery_prob(deal_type.value, bribe_amount, floor, repeat)

    inv.funds -= bribe_amount

    deal = GovDeal(
        game_id               = game.id,
        buyer_team_id         = buyer_team.id,
        target_team_id        = target_team.id if target_team else None,
        deal_type             = deal_type,
        status                = GovDealStatus.PENDING,
        bribe_amount          = bribe_amount,
        effect_scale          = scale,
        effect_payload        = payload,
        discovery_probability = disc_prob,
        cycles_active         = 0,
        repeat_count          = repeat,
        negotiated_cycle_id   = cycle.id,
        notes                 = notes,
    )
    db.add(deal)
    db.flush()
    return deal


# ── Build effect payload ──────────────────────────────────────────────────────

def _build_payload(deal_type: str, scale: float,
                    override: Optional[Dict]) -> Dict:
    p: Dict[str, Any] = {}

    if deal_type == "red_supply_sabotage":
        p = {"loss_fraction": min(0.90, 0.25 * scale)}
    elif deal_type == "red_price_inflation":
        p = {"cost_multiplier": 1.0 + 0.30 * scale, "duration_cycles": 1}
    elif deal_type == "green_priority_supply":
        p = {"mean_bonus": 5.0 * scale}
    elif deal_type == "green_subsidised_inputs":
        p = {"cost_multiplier": max(0.50, 1.0 - 0.20 * scale)}
    elif deal_type == "red_machine_sabotage":
        p = {"condition_hit": min(90.0, 30.0 * scale)}
    elif deal_type == "red_infra_delay":
        p = {"delay_cycles": max(1, round(1 * scale))}
    elif deal_type == "green_fast_track_infra":
        p = {"condition_bonus": 10.0 * scale, "quality_bonus": 5.0 * scale}
    elif deal_type == "red_labour_strike":
        p = {"force_strike": True}
    elif deal_type == "red_labour_poach":
        p = {"skill_hit": min(40.0, 12.0 * scale)}
    elif deal_type == "red_rnd_sabotage":
        p = {"levels_stolen": 1 if scale < 1.5 else 2}
    elif deal_type == "green_skilled_labour":
        p = {"skill_bonus": min(30.0, 8.0 * scale)}
    elif deal_type == "green_research_grant":
        p = {"levels": 1, "bonus_prob": max(0.0, (scale - 1.0) / (DEAL_EFFECT_CAP - 1.0))}
    elif deal_type == "red_market_limit":
        p = {"block_fraction": min(0.80, 0.30 * scale)}
    elif deal_type == "red_demand_suppression":
        p = {"demand_multiplier": max(0.25, 1.0 - 0.35 * scale)}
    elif deal_type == "red_price_pressure":
        p = {"active": True}
    elif deal_type == "green_demand_boost":
        p = {"demand_multiplier": 1.0 + 0.35 * scale}
    elif deal_type == "green_gov_purchase":
        p = {"units": 0, "price_per_unit": 2_800.0}  # organiser must override
    elif deal_type == "red_targeted_audit":
        p = {"force_audit": True}
    elif deal_type == "red_arbitrary_fine":
        p = {"fine_amount": 5_000.0 * scale}
    elif deal_type == "green_audit_immunity":
        p = {"duration_cycles": max(1, round(1 * scale))}
    elif deal_type == "green_quality_waiver":
        p = {"threshold_reduction": min(20.0, 5.0 * scale)}
    elif deal_type == "green_tax_evasion":
        p = {"refund_fraction": min(0.25, 0.08 * scale)}

    if override:
        p.update(override)
    return p


# ── Record an event ledger entry ──────────────────────────────────────────────

def record_event(
    db:             Session,
    game,
    event_type:     EventType,
    cycles:         int,
    payload:        Dict,
    team_id:        Optional[int] = None,
    notes:          Optional[str] = None,
) -> EventLedger:
    ev = EventLedger(
        game_id          = game.id,
        team_id          = team_id,
        event_type       = event_type,
        status           = EventStatus.ACTIVE,
        cycles_remaining = cycles,
        payload          = payload,
        notes            = notes,
    )
    db.add(ev)
    db.flush()
    return ev


# ── Process event ledger at cycle start ───────────────────────────────────────

def process_event_ledger(db: Session, game) -> Dict:
    """
    Called at the very start of each new cycle (before procurement opens).

    For each ACTIVE event:
      - Apply its effect to the relevant team(s) / game state.
      - Decrement cycles_remaining.
      - If cycles_remaining reaches 0, mark RESOLVED.

    Returns a summary dict for the organiser.
    """
    events: List[EventLedger] = (
        db.query(EventLedger)
        .filter(
            EventLedger.game_id == game.id,
            EventLedger.status  == EventStatus.ACTIVE,
        )
        .all()
    )

    applied = []

    for ev in events:
        p = ev.payload or {}

        if ev.event_type == EventType.GOV_LOAN:
            _apply_loan_interest(db, ev)

        elif ev.event_type == EventType.INTER_TEAM_LOAN:
            _apply_inter_loan_interest(db, ev)

        elif ev.event_type == EventType.GLOBAL_EVENT:
            _apply_global_event(db, game, p)

        elif ev.event_type == EventType.BACKROOM_EFFECT:
            _apply_backroom_effect(db, ev, game)

        # RND_INVESTMENT is ticked inside production_service per team

        ev.cycles_remaining -= 1
        if ev.cycles_remaining <= 0:
            ev.status = EventStatus.RESOLVED

        applied.append({
            "event_type":       ev.event_type.value,
            "team_id":          ev.team_id,
            "cycles_remaining": max(0, ev.cycles_remaining),
        })

    db.flush()
    return {"events_processed": len(applied), "detail": applied}


def _apply_loan_interest(db: Session, ev: EventLedger) -> None:
    p      = ev.payload or {}
    rate   = p.get("rate", 0.15)
    inv    = db.query(Inventory).filter(Inventory.team_id == ev.team_id).first()
    if inv is None:
        return
    interest = round(p.get("principal", 0.0) * rate, 2)
    inv.funds -= interest
    p["interest_paid_this_cycle"] = interest
    ev.payload = p


def _apply_inter_loan_interest(db: Session, ev: EventLedger) -> None:
    p           = ev.payload or {}
    rate        = p.get("rate", 0.05)
    principal   = p.get("principal", 0.0)
    lender_id   = p.get("lender_team_id")
    interest    = round(principal * rate, 2)

    borrower_inv = db.query(Inventory).filter(
        Inventory.team_id == ev.team_id).first()
    if borrower_inv:
        borrower_inv.funds -= interest

    if lender_id:
        lender_inv = db.query(Inventory).filter(
            Inventory.team_id == lender_id).first()
        if lender_inv:
            lender_inv.funds += interest


def _apply_global_event(db: Session, game, payload: Dict) -> None:
    """
    Apply a global event's effects to game state.
    Currently supported effect keys:
      market_demand_multiplier_delta: float
      qr_hard_delta / qr_soft_delta / qr_premium_delta: float
    """
    if "market_demand_multiplier_delta" in payload:
        game.market_demand_multiplier = max(
            0.1,
            game.market_demand_multiplier
            + payload["market_demand_multiplier_delta"],
        )
    for field in ("qr_hard", "qr_soft", "qr_premium"):
        delta_key = f"{field}_delta"
        if delta_key in payload:
            current = getattr(game, field, 50.0)
            setattr(game, field, max(0.0, min(100.0, current + payload[delta_key])))


def _apply_backroom_effect(db: Session, ev: EventLedger, game) -> None:
    """
    Apply a BACKROOM_EFFECT event entry.
    The payload mirrors GovDeal.effect_payload.
    The team_id on the event is the TARGET (for RED deals) or BUYER (GREEN).
    """
    p       = ev.payload or {}
    team_id = ev.team_id
    inv     = db.query(Inventory).filter(Inventory.team_id == team_id).first()
    if inv is None:
        return

    deal_type = p.get("deal_type", "")

    if deal_type == "red_arbitrary_fine":
        inv.funds -= p.get("fine_amount", 0.0)
    elif deal_type == "green_tax_evasion":
        # Refund a fraction of last cycle costs — simplified: refund from funds
        pass  # Applied at sales resolution end
    elif deal_type == "green_skilled_labour":
        inv.skill_level = min(100.0, inv.skill_level + p.get("skill_bonus", 0.0))
    elif deal_type == "red_labour_poach":
        inv.skill_level = max(0.0, inv.skill_level - p.get("skill_hit", 0.0))


# ── Roll discovery ────────────────────────────────────────────────────────────

def roll_discovery(db: Session, cycle) -> Dict:
    """
    Roll discovery for all PENDING GovDeals negotiated in any previous cycle.
    Called when the organiser closes the backroom phase.
    """
    pending: List[GovDeal] = (
        db.query(GovDeal)
        .filter(GovDeal.status == GovDealStatus.PENDING)
        .all()
    )

    discovered_deals = []
    safe_deals       = []

    for deal in pending:
        deal.cycles_active += 1
        effective_p = deal.discovery_probability * (
            DEAL_DISCOVERY_DECAY ** deal.cycles_active
        )
        effective_p = min(1.0, max(0.0, effective_p))

        if random.random() < effective_p:
            # Discovered
            fine = round(deal.bribe_amount * DEAL_FINE_MULTIPLIER, 2)
            inv  = db.query(Inventory).filter(
                Inventory.team_id == deal.buyer_team_id
            ).first()
            if inv:
                inv.funds       -= fine
                inv.brand_score  = max(
                    0.0, inv.brand_score + BRAND_DELTA_DEAL_FOUND
                )
            deal.status = GovDealStatus.DISCOVERED
            discovered_deals.append({
                "deal_id":     deal.id,
                "buyer_team":  deal.buyer_team_id,
                "fine":        fine,
            })
        else:
            safe_deals.append(deal.id)

    db.flush()
    return {
        "discovered": len(discovered_deals),
        "safe":       len(safe_deals),
        "detail":     discovered_deals,
    }


# ── Apply pending deals at cycle start ────────────────────────────────────────

def apply_pending_deals(db: Session, game, cycle) -> int:
    """
    Apply all PENDING GovDeals at the start of a new cycle.
    Creates BACKROOM_EFFECT EventLedger entries for multi-cycle effects.
    One-shot effects are applied immediately.
    """
    from models.game import Team
    from models.procurement import ComponentSlot

    pending: List[GovDeal] = (
        db.query(GovDeal)
        .filter(
            GovDeal.game_id == game.id,
            GovDeal.status  == GovDealStatus.PENDING,
        )
        .all()
    )

    count = 0
    for deal in pending:
        p         = deal.effect_payload or {}
        dt        = deal.deal_type.value
        target_id = deal.target_team_id
        buyer_id  = deal.buyer_team_id

        target_inv = (
            db.query(Inventory).filter(Inventory.team_id == target_id).first()
            if target_id else None
        )
        buyer_inv = db.query(Inventory).filter(
            Inventory.team_id == buyer_id
        ).first()

        # One-shot immediate effects
        if dt == "red_arbitrary_fine" and target_inv:
            target_inv.funds -= p.get("fine_amount", 0.0)

        elif dt == "red_labour_poach" and target_inv:
            target_inv.skill_level = max(
                0.0, target_inv.skill_level - p.get("skill_hit", 0.0)
            )

        elif dt == "green_skilled_labour" and buyer_inv:
            buyer_inv.skill_level = min(
                100.0, buyer_inv.skill_level + p.get("skill_bonus", 0.0)
            )

        elif dt == "red_machine_sabotage" and target_id:
            # Hit the weakest machine (lowest condition) of the target
            slot = (
                db.query(ComponentSlot)
                .filter(ComponentSlot.team_id == target_id)
                .order_by(ComponentSlot.machine_condition)
                .first()
            )
            if slot:
                slot.machine_condition = max(
                    0.0,
                    slot.machine_condition - p.get("condition_hit", 30.0),
                )

        elif dt == "red_rnd_sabotage" and target_id:
            # Reduce a random non-zero R&D level of the target
            slots = (
                db.query(ComponentSlot)
                .filter(ComponentSlot.team_id == target_id)
                .all()
            )
            victims = [(s, f) for s in slots for f in ("quality", "consistency", "yield")
                       if getattr(s, f"rnd_{f}") > 0]
            if victims:
                slot, focus = random.choice(victims)
                attr = f"rnd_{focus}"
                setattr(slot, attr, getattr(slot, attr) - p.get("levels_stolen", 1))

        elif dt == "green_research_grant" and buyer_id:
            comp  = p.get("component")
            focus = p.get("focus")
            if comp and focus:
                slot = (
                    db.query(ComponentSlot)
                    .filter(
                        ComponentSlot.team_id   == buyer_id,
                        ComponentSlot.component == comp,
                    )
                    .first()
                )
                if slot:
                    levels = p.get("levels", 1)
                    if random.random() < p.get("bonus_prob", 0.0):
                        levels += 1
                    attr = f"rnd_{focus}"
                    from core.config import MAX_RND_LEVEL
                    setattr(slot, attr,
                            min(MAX_RND_LEVEL, getattr(slot, attr) + levels))

        deal.status    = GovDealStatus.APPLIED
        deal.applied_at = datetime.utcnow()
        count += 1

    db.flush()
    return count