"""
services/deals.py
=================
Responsible ONLY for:
  1. Recording GovDeals (backroom negotiations).
  2. Generating Event rows from those deals.
  3. Creating Event rows for loans and global events.
  4. Rolling discovery at the end of the backroom phase.

Resolution of event effects lives in the service that owns each phase:
  - procurement events → services/procurement.py
  - production events  → services/production.py
  - sales events       → services/sales.py
  - financial events   → services/sales.py (end of sales resolution)

Public API
----------
record_gov_deal(db, game, cycle, buyer, target, deal_type, bribe, ...)
    Validate, deduct bribe, persist GovDeal, generate Event rows
    for the NEXT cycle.

create_loan_events(db, game, next_cycle_number, borrower_team_id,
                   lender_team_id, amount_per_cycle, num_cycles, notes)
    Pre-generate one LOAN_INTEREST Event per cycle.

create_global_event(db, game, next_cycle_number, payload, notes)
    Create a GLOBAL_MARKET_SHIFT Event for each affected cycle.

create_rnd_event(db, game, team, target_cycle_id, component, focus, levels)
    Called by production service when a team invests in R&D.

roll_discovery(db, cycle)
    Roll discovery for all PENDING GovDeals.
    Cancel the corresponding pending Event rows on discovery.
"""
import math
import random
import secrets
import string
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy.orm import Session
from core.config import (
    BRAND_DELTA_DEAL_FOUND, DEAL_BASE_DISCOVERY, DEAL_BRIBE_FLOOR,
    DEAL_DISCOVERY_DECAY, DEAL_EFFECT_CAP, DEAL_FINE_MULTIPLIER,
    DEAL_LOG_SCALE_DIVISOR, DEAL_REPEAT_STACK_RATE, DEAL_SIZE_DISCOVERY_RATE,
    GOV_LOAN_INTEREST_RATE, BRAND_DELTA_GOV_LOAN,
    DISCOVERY_BOOST_PROBABILITY, DISCOVERY_BOOST_COST,
)
from core.enums import (
    EventPhase, EventStatus, EventType,
    GovDealStatus, GovDealType,
)
from models.deals import Event, GovDeal
from models.game import Cycle
from models.procurement import Inventory


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _generate_discovery_code() -> str:
    """Generate a random 7-character trace ID (XXX-XXXX)."""
    p1 = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(3))
    p2 = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(4))
    return f"{p1}-{p2}"


def _effect_scale(bribe: float, floor: float) -> float:
    if floor <= 0 or bribe <= floor:
        return 1.0
    return min(DEAL_EFFECT_CAP,
               1.0 + math.log(bribe / floor) / DEAL_LOG_SCALE_DIVISOR)


def _discovery_prob(deal_type: str, bribe: float, floor: float,
                    repeat: int) -> float:
    base      = DEAL_BASE_DISCOVERY.get(deal_type, 0.10)
    size_add  = (math.log(bribe / floor) * DEAL_SIZE_DISCOVERY_RATE
                 if floor > 0 and bribe > floor else 0.0)
    stack_add = (repeat - 1) * DEAL_REPEAT_STACK_RATE
    return min(1.0, max(0.0, base + size_add + stack_add))


def _next_cycle(db: Session, game_id: int, current_cycle: Cycle) -> Optional[Cycle]:
    """Return the cycle immediately after current_cycle, if it exists."""
    return (
        db.query(Cycle)
        .filter(
            Cycle.game_id      == game_id,
            Cycle.cycle_number == current_cycle.cycle_number + 1,
        )
        .first()
    )


def _make_event(
    db:             Session,
    game_id:        int,
    cycle_id:       int,
    phase:          EventPhase,
    event_type:     EventType,
    payload:        Dict,
    target_team_id: Optional[int] = None,
    source_team_id: Optional[int] = None,
    gov_deal_id:    Optional[int] = None,
    discovery_code: Optional[str] = None,
    notes:          Optional[str] = None,
) -> Event:
    ev = Event(
        game_id        = game_id,
        cycle_id       = cycle_id,
        target_team_id = target_team_id,
        source_team_id = source_team_id,
        phase          = phase,
        event_type     = event_type,
        payload        = payload,
        status         = EventStatus.PENDING,
        gov_deal_id    = gov_deal_id,
        discovery_code = discovery_code,
        notes          = notes,
    )
    db.add(ev)
    return ev


# ─────────────────────────────────────────────────────────────────────────────
# Deal type → (EventPhase, EventType, payload builder)
# ─────────────────────────────────────────────────────────────────────────────

def _deal_to_events(
    deal_type:      str,
    scale:          float,
    override:       Optional[Dict],
    buyer_team_id:  int,
    target_team_id: Optional[int],
    target_component: Optional[str] = None,
) -> List[Dict]:
    """
    Map a GovDealType to one or more (phase, event_type, payload,
    target_team_id) tuples. Returns a list of dicts ready to be
    passed to _make_event.

    For self-buff (GREEN_*) deals, target = buyer.
    For offensive (RED_*) deals, target = the rival.
    """
    # Defensive: self-buff target is the buyer
    self_id   = buyer_team_id
    rival_id  = target_team_id  # may be None for GREEN deals

    def p(d): 
        if target_component:
            d["component"] = target_component
        return {**d, **(override or {})}

    mapping = {
        # ── Procurement ───────────────────────────────────────────────────────
        "red_supply_sabotage": [(
            EventPhase.PROCUREMENT, EventType.SUPPLY_SABOTAGE,
            p({"loss_fraction": min(0.90, 0.25 * scale)}), rival_id,
        )],
        "red_price_inflation": [(
            EventPhase.PROCUREMENT, EventType.PRICE_INFLATION,
            p({"cost_multiplier": 1.0 + 0.30 * scale}), rival_id,
        )],
        "green_priority_supply": [(
            EventPhase.PROCUREMENT, EventType.PRIORITY_SUPPLY,
            p({"mean_bonus": 5.0 * scale}), self_id,
        )],
        "green_subsidised_inputs": [(
            EventPhase.PROCUREMENT, EventType.SUBSIDISED_INPUTS,
            p({"cost_multiplier": max(0.50, 1.0 - 0.20 * scale)}), self_id,
        )],

        # ── Production ────────────────────────────────────────────────────────
        "red_machine_sabotage": [(
            EventPhase.PRODUCTION, EventType.MACHINE_SABOTAGE,
            p({"condition_hit": min(90.0, 30.0 * scale)}), rival_id,
        )],
        "red_infra_delay": [(
            EventPhase.PRODUCTION, EventType.INFRA_DELAY,
            p({}), rival_id,
        )],
        "green_fast_track_infra": [(
            EventPhase.PRODUCTION, EventType.FAST_TRACK_INFRA,
            p({"condition_bonus": 10.0 * scale, "quality_bonus": 5.0 * scale}),
            self_id,
        )],
        "red_labour_strike": [(
            EventPhase.PRODUCTION, EventType.LABOUR_STRIKE, p({}), rival_id,
        )],
        "red_labour_poach": [(
            EventPhase.PRODUCTION, EventType.LABOUR_POACH,
            p({"skill_hit": min(40.0, 12.0 * scale)}), rival_id,
        )],
        "red_rnd_sabotage": [(
            EventPhase.PRODUCTION, EventType.RND_SABOTAGE,
            p({"levels_stolen": 1 if scale < 1.5 else 2}), rival_id,
        )],
        "green_skilled_labour": [(
            EventPhase.PRODUCTION, EventType.SKILLED_LABOUR,
            p({"skill_bonus": min(30.0, 8.0 * scale)}), self_id,
        )],
        # green_research_grant → generates an RND_INVESTMENT event
        # (arrives immediately — 0-cycle delay for a grant)
        "green_research_grant": [(
            EventPhase.PRODUCTION, EventType.RND_INVESTMENT,
            p({"level_arriving": 1,
               "bonus_prob": max(0.0, (scale - 1.0) / (DEAL_EFFECT_CAP - 1.0))}),
            self_id,
        )],

        # ── Sales ─────────────────────────────────────────────────────────────
        "red_market_limit": [(
            EventPhase.SALES, EventType.MARKET_LIMIT,
            p({"block_fraction": min(0.80, 0.30 * scale)}), rival_id,
        )],
        "red_demand_suppression": [(
            EventPhase.SALES, EventType.DEMAND_SUPPRESSION,
            p({"demand_multiplier": max(0.25, 1.0 - 0.35 * scale)}), rival_id,
        )],
        "red_price_pressure": [(
            EventPhase.SALES, EventType.PRICE_PRESSURE, p({}), rival_id,
        )],
        "green_demand_boost": [(
            EventPhase.SALES, EventType.DEMAND_BOOST,
            p({"demand_multiplier": 1.0 + 0.35 * scale}), self_id,
        )],
        "green_gov_purchase": [(
            EventPhase.SALES, EventType.GOV_PURCHASE,
            p({"units": 0, "price_per_unit": 2_800.0}), self_id,
        )],
        "green_quality_waiver": [(
            EventPhase.SALES, EventType.QUALITY_WAIVER,
            p({"threshold_reduction": min(20.0, 5.0 * scale)}), self_id,
        )],
        "green_audit_immunity": [(
            EventPhase.SALES, EventType.AUDIT_IMMUNITY, p({}), self_id,
        )],

        # ── Financial ─────────────────────────────────────────────────────────
        "red_targeted_audit": [],   # handled by organiser offline; no Event
        "red_arbitrary_fine": [(
            EventPhase.FINANCIAL, EventType.ARBITRARY_FINE,
            p({"fine_amount": 5_000.0 * scale}), rival_id,
        )],
        "green_tax_evasion": [(
            EventPhase.FINANCIAL, EventType.TAX_EVASION_REFUND,
            p({"refund_fraction": min(0.25, 0.08 * scale)}), self_id,
        )],

        # --- Blue (Intelligence/Manipulation) ---
        "blue_espionage": [(
            # Espionage resolves immediately or in Financial
            EventPhase.FINANCIAL, EventType.ESPIONAGE_DATA,
            p({"intel_scope": "full" if scale > 1.2 else "partial"}), self_id,
        )],
        "blue_talent_poaching": [(
            EventPhase.PRODUCTION, EventType.TALENT_THEFT,
            p({"workforce_stolen": int(5 * scale), "stolen_rnd": True if scale > 1.5 else False}), rival_id,
        )],
        "blue_resource_blockade": [(
            EventPhase.PROCUREMENT, EventType.RESOURCE_BLOCKADE,
            p({"cost_multiplier": 1.0 + 0.50 * scale}), rival_id,
        )],
    }

    return [
        {"phase": ph, "event_type": et, "payload": pl, "target_team_id": tgt}
        for ph, et, pl, tgt in mapping.get(deal_type, [])
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Record a government deal
# ─────────────────────────────────────────────────────────────────────────────

def record_gov_deal(
    db:              Session,
    game,
    cycle,
    buyer_team,
    deal_type:       GovDealType,
    bribe_amount:    float,
    target_team=None,
    target_component: Optional[str] = None,
    override_params: Optional[Dict] = None,
    notes:           Optional[str]  = None,
) -> GovDeal:
    """
    Validate and record a backroom deal.
    Deducts bribe immediately.
    Generates Event rows for the NEXT cycle.
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
            f"Insufficient funds ({inv.funds:.0f}) "
            f"for bribe {bribe_amount:.0f}."
        )

    is_offensive = deal_type.value.startswith("red_")
    if is_offensive and target_team is None:
        raise ValueError(f"'{deal_type.value}' requires a target team.")
    if not is_offensive and target_team is not None:
        raise ValueError(f"'{deal_type.value}' is a self-buff — no target needed.")
    if target_team and target_team.id == buyer_team.id:
        raise ValueError("Cannot target yourself.")

    scale  = _effect_scale(bribe_amount, floor)
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

    disc_prob = _discovery_prob(
        deal_type.value, bribe_amount, floor, repeat
    )

    # Build effect snapshot for the GovDeal record
    event_specs = _deal_to_events(
        deal_type.value, scale, override_params,
        buyer_team.id,
        target_team.id if target_team else None,
        target_component,
    )
    effect_payload = event_specs[0]["payload"] if event_specs else {}

    inv.funds -= bribe_amount

    deal = GovDeal(
        game_id               = game.id,
        buyer_team_id         = buyer_team.id,
        target_team_id        = target_team.id if target_team else None,
        deal_type             = deal_type,
        status                = GovDealStatus.PENDING,
        bribe_amount          = bribe_amount,
        effect_scale          = scale,
        effect_payload        = effect_payload,
        discovery_probability = disc_prob,
        cycles_active         = 0,
        repeat_count          = repeat,
        negotiated_cycle_id   = cycle.id,
        notes                 = notes,
    )
    db.add(deal)
    db.flush()   # get deal.id before creating Event rows

    # Find the next cycle to attach events to
    next_cyc = _next_cycle(db, game.id, cycle)
    
    # Special case: Espionage and Security Protocol might need immediate action
    if deal_type == GovDealType.BLUE_ESPIONAGE:
        # Espionage reveal happens NOW in the negotiated cycle
        _create_event_rows_for_deal(db, game, cycle, deal, event_specs, buyer_team.id)
    elif deal_type == GovDealType.GREEN_SECURITY_PROTOCOL:
        # Security protocol active IMMEDIATELY for this backroom's discovery roll
        inv.block_probability = override_params.get("block_prob", 0.90) if override_params else 0.90
    else:
        if next_cyc:
            _create_event_rows_for_deal(db, game, next_cyc, deal, event_specs, buyer_team.id)

    return deal


def _create_event_rows_for_deal(
    db:            Session,
    game,
    target_cycle:  Cycle,
    deal:          GovDeal,
    event_specs:   List[Dict],
    buyer_team_id: int,
) -> None:
    """Generate Event rows for a deal into the given cycle."""
    for spec in event_specs:
        # Generate a discovery code only for offensive (RED) deals
        # (where source != target)
        code = None
        if spec["target_team_id"] and spec["target_team_id"] != buyer_team_id:
            code = _generate_discovery_code()

        _make_event(
            db             = db,
            game_id        = game.id,
            cycle_id       = target_cycle.id,
            phase          = spec["phase"],
            event_type     = spec["event_type"],
            payload        = spec["payload"],
            target_team_id = spec["target_team_id"],
            source_team_id = buyer_team_id,
            gov_deal_id    = deal.id,
            discovery_code = code,
            notes          = deal.notes,
        )


def create_events_for_pending_deals(
    db: Session, game, new_cycle: Cycle
) -> int:
    """
    Called when a new cycle is created.
    Finds all GovDeals that are PENDING and have no Event rows yet
    (because the next cycle didn't exist when they were recorded),
    and creates their Event rows now.
    """
    pending_deals: List[GovDeal] = (
        db.query(GovDeal)
        .filter(
            GovDeal.game_id == game.id,
            GovDeal.status  == GovDealStatus.PENDING,
        )
        .all()
    )

    count = 0
    for deal in pending_deals:
        # Check if Event rows already exist for this deal
        existing = (
            db.query(Event)
            .filter(Event.gov_deal_id == deal.id)
            .count()
        )
        if existing > 0:
            continue

        event_specs = _deal_to_events(
            deal.deal_type.value,
            deal.effect_scale,
            None,
            deal.buyer_team_id,
            deal.target_team_id,
            deal.effect_payload.get("component"), # Preserve targeting
        )
        _create_event_rows_for_deal(db, game, new_cycle, deal, event_specs,
                                     deal.buyer_team_id)
        count += 1

    db.flush()
    return count


# ─────────────────────────────────────────────────────────────────────────────
# Loan events
# ─────────────────────────────────────────────────────────────────────────────

def create_loan_events(
    db:               Session,
    game,
    db_cycles:        List[Cycle],   # the cycles this loan covers, in order
    borrower_team_id: int,
    lender_team_id:   Optional[int],  # None = government
    amount_per_cycle: float,
    principal:        float,          # Added principal
    notes:            Optional[str] = None,
) -> List[Event]:
    """
    Pre-generate one LOAN_INTEREST Event per cycle.
    db_cycles must be the actual Cycle ORM objects for the cycles
    during which interest is due.
    """
    events = []
    # Interest cycles
    for cyc in db_cycles:
        ev = _make_event(
            db             = db,
            game_id        = game.id,
            cycle_id       = cyc.id,
            phase          = EventPhase.FINANCIAL,
            event_type     = EventType.LOAN_INTEREST,
            payload        = {
                "amount":          round(amount_per_cycle, 2),
                "lender_team_id":  lender_team_id,
            },
            target_team_id = borrower_team_id,
            source_team_id = lender_team_id,
            notes          = notes,
        )
        events.append(ev)
    
    # Final repayment cycle (last cycle of interest + 1 or same if duration=1?)
    # Usually principal is repaid in the LAST cycle of interest.
    if db_cycles:
        last_cyc = db_cycles[-1]
        ev_rep = _make_event(
            db             = db,
            game_id        = game.id,
            cycle_id       = last_cyc.id,
            phase          = EventPhase.FINANCIAL,
            event_type     = EventType.LOAN_REPAYMENT,
            payload        = {
                "amount":          round(principal, 2),
                "lender_team_id":  lender_team_id,
            },
            target_team_id = borrower_team_id,
            source_team_id = lender_team_id,
            notes          = f"Principal Repayment: {notes}" if notes else "Principal Repayment",
        )
        events.append(ev_rep)

    db.flush()
    return events


# ─────────────────────────────────────────────────────────────────────────────
# Global market shift events
# ─────────────────────────────────────────────────────────────────────────────

def create_global_event(
    db:             Session,
    game,
    db_cycles:      List[Cycle],
    payload:        Dict,
    notes:          Optional[str] = None,
) -> List[Event]:
    """
    Create a GLOBAL_MARKET_SHIFT Event for each cycle in db_cycles.
    target_team_id is NULL — the financial service applies this to
    the Game record, not to any specific team.
    """
    events = []
    for cyc in db_cycles:
        ev = _make_event(
            db             = db,
            game_id        = game.id,
            cycle_id       = cyc.id,
            phase          = EventPhase.FINANCIAL,
            event_type     = EventType.GLOBAL_MARKET_SHIFT,
            payload        = payload,
            target_team_id = None,
            source_team_id = None,
            notes          = notes,
        )
        events.append(ev)
    db.flush()
    return events


# ─────────────────────────────────────────────────────────────────────────────
# R&D investment events (called by production service)
# ─────────────────────────────────────────────────────────────────────────────

def create_rnd_event(
    db:        Session,
    game,
    team,
    target_cycle: Cycle,   # the cycle in which R&D arrives
    component: str,
    focus:     str,
    levels:    int,
    cost:      float,
) -> Event:
    """
    Create an RND_INVESTMENT event targeting the cycle when research matures.
    Cost is deducted by the caller before calling this.
    """
    ev = _make_event(
        db             = db,
        game_id        = game.id,
        cycle_id       = target_cycle.id,
        phase          = EventPhase.PRODUCTION,
        event_type     = EventType.RND_INVESTMENT,
        payload        = {
            "component":     component,
            "focus":         focus,
            "level_arriving": levels,
        },
        target_team_id = team.id,
        source_team_id = None,
        notes          = f"R&D: {component} {focus} +{levels} (cost {cost:.0f} CU)",
    )
    db.flush()
    return ev


# ─────────────────────────────────────────────────────────────────────────────
# Discovery roll
# ─────────────────────────────────────────────────────────────────────────────

def roll_discovery(db: Session, cycle) -> Dict:
    """
    Roll discovery for all PENDING GovDeals.
    Called when the organiser closes the backroom phase (/next or /end-game).

    On discovery:
      - GovDeal status → DISCOVERED
      - Fine deducted from buyer's funds
      - Brand hit applied
      - All PENDING Event rows generated from this deal → APPLIED
        (they are cancelled, not executed — nullifying the effect)
    """
    pending: List[GovDeal] = (
        db.query(GovDeal)
        .filter(GovDeal.status == GovDealStatus.PENDING)
        .all()
    )

    discovered_count = 0
    safe_count       = 0

    for deal in pending:
        # Get target team's inventory to check for discovery boost
        target_inv = None
        if deal.target_team_id:
            target_inv = (
                db.query(Inventory)
                .filter(Inventory.team_id == deal.target_team_id)
                .first()
            )

        deal.cycles_active += 1
        
        if target_inv and target_inv.block_probability > 0:
            effective_p = DISCOVERY_BOOST_PROBABILITY
        else:
            effective_p = deal.discovery_probability * (
                DEAL_DISCOVERY_DECAY ** deal.cycles_active
            )
        
        effective_p = min(1.0, max(0.0, effective_p))

        if random.random() < effective_p:
            # Check if target has a Security Protocol blocking this
            if target_inv and target_inv.block_probability > 0:
                if random.random() < target_inv.block_probability:
                    # BLOCKED - deal is cancelled/neutralized, source safe
                    discovered_count += 0 # not discovered
                    safe_count += 1
                    # We still flip the deal status so it doesn't fire next cycle
                    deal.status = GovDealStatus.CANCELLED
                    cancel_pending_events(db, deal)
                    continue

            apply_discovery(db, deal)
            discovered_count += 1
        else:
            safe_count += 1

    # Reset security protocols for all teams
    db.query(Inventory).update({"block_probability": 0.0})
    
    db.flush()
    return {
        "discovered": discovered_count,
        "safe":       safe_count,
    }


def cancel_pending_events(db: Session, deal: GovDeal) -> None:
    """Cancel all pending events for a deal (neutralization)."""
    db.query(Event).filter(
        Event.gov_deal_id == deal.id,
        Event.status == EventStatus.PENDING
    ).update(
        {"status": EventStatus.APPLIED, "applied_at": datetime.utcnow()},
        synchronize_session=False
    )

def apply_discovery(db: Session, deal: GovDeal) -> None:
    """
    Apply the consequences of a deal discovery.
    Works for both PENDING deals (effect not yet fired) and
    APPLIED deals (effect already fired — post-hoc discovery via code submission).
    """
    if deal.status in (GovDealStatus.DISCOVERED, GovDealStatus.CANCELLED):
        return

    fine = round(deal.bribe_amount * DEAL_FINE_MULTIPLIER, 2)
    buyer_inv = (
        db.query(Inventory)
        .filter(Inventory.team_id == deal.buyer_team_id)
        .first()
    )
    if buyer_inv:
        buyer_inv.funds -= fine
        buyer_inv.brand_score = max(0.0, buyer_inv.brand_score + BRAND_DELTA_DEAL_FOUND)

    # Cancel any still-PENDING Event rows for this deal (pre-effect discovery)
    (
        db.query(Event)
        .filter(
            Event.gov_deal_id == deal.id,
            Event.status == EventStatus.PENDING,
        )
        .update(
            {"status": EventStatus.APPLIED, "applied_at": datetime.utcnow()},
            synchronize_session=False,
        )
    )

    # ── Victim restitution (Option A: 1× bribe returned to victim) ────────────
    if deal.target_team_id:
        victim_inv = (
            db.query(Inventory)
            .filter(Inventory.team_id == deal.target_team_id)
            .first()
        )
        if victim_inv:
            victim_inv.funds = round(victim_inv.funds + deal.bribe_amount, 2)

        # Create a notification event for the victim so it shows in frontend
        latest_cycle = (
            db.query(Cycle)
            .filter(Cycle.game_id == deal.game_id)
            .order_by(Cycle.cycle_number.desc())
            .first()
        )
        if latest_cycle:
            restitution_note = (
                f"Ministry investigation confirmed hostile interference by "
                f"an external entity. Restitution of {deal.bribe_amount:,.0f} CU "
                f"has been credited to your accounts."
            )
            ev_restitution = Event(
                game_id        = deal.game_id,
                cycle_id       = latest_cycle.id,
                phase          = EventPhase.FINANCIAL,
                event_type     = EventType.ASSET_EXCHANGE,
                payload        = {
                    "notes":     restitution_note,
                    "direction": "inbound",
                    "from":      "Ministry Directorate — Restitution",
                },
                target_team_id = deal.target_team_id,
                source_team_id = None,
                status         = EventStatus.APPLIED,
                notes          = "Restitution following confirmed discovery of hostile deal.",
            )
            db.add(ev_restitution)

    deal.status = GovDealStatus.DISCOVERED
    deal.applied_at = datetime.utcnow()
    db.flush()


def check_discovery_code(db: Session, game_id: int, code: str) -> Optional[Event]:
    """Helper for organiser to verify a guess code."""
    return (
        db.query(Event)
        .filter(
            Event.game_id == game_id,
            Event.discovery_code == code
        )
        .first()
    )


# ─────────────────────────────────────────────────────────────────────────────
# Inter-Team Generic Exchange
# ─────────────────────────────────────────────────────────────────────────────

def execute_inter_team_exchange(
    db: Session,
    team_a,
    team_b,
    team_a_to_b_assets: Dict,
    team_b_to_a_assets: Dict,
    notes: Optional[str] = None,
):
    """
    Executes a bidirectional swap of any assets between A and B.
    Validates ownership and handles machine slot remapping.
    """
    from models.procurement import Inventory, ComponentSlot, Machine
    
    inv_a: Inventory = db.query(Inventory).filter(Inventory.team_id == team_a.id).one()
    inv_b: Inventory = db.query(Inventory).filter(Inventory.team_id == team_b.id).one()

    def transfer_assets(src_inv, dst_inv, assets, src_team_name, dst_team_name):
        # 1. Generic Resources
        for res in ["funds", "minerals", "chemicals", "power"]:
            val = assets.get(res, 0)
            if val > 0:
                setattr(src_inv, res, round(getattr(src_inv, res) - val, 2))
                setattr(dst_inv, res, round(getattr(dst_inv, res) + val, 2))

        # 2. Drone Stock (array swap)
        drone_transfer = assets.get("drone_stock", [0]*101)
        if sum(drone_transfer) > 0:
            src_stock = list(src_inv.drone_stock)
            dst_stock = list(dst_inv.drone_stock)
            for g in range(101):
                take = min(src_stock[g], drone_transfer[g])
                src_stock[g] -= take
                dst_stock[g] += take
            src_inv.drone_stock = src_stock
            dst_inv.drone_stock = dst_stock

        # 3. Component Slots (raw/finished)
        comp_stock = assets.get("component_stock", {})
        for comp_type, values in comp_stock.items():
            src_slot = db.query(ComponentSlot).filter(
                ComponentSlot.team_id == src_inv.team_id,
                ComponentSlot.component == comp_type
            ).one()
            dst_slot = db.query(ComponentSlot).filter(
                ComponentSlot.team_id == dst_inv.team_id,
                ComponentSlot.component == comp_type
            ).one()
            
            raw_t = values.get("raw", [0]*101)
            fin_t = values.get("finished", [0]*101)
            
            # Raw
            s_raw = list(src_slot.raw_stock)
            d_raw = list(dst_slot.raw_stock)
            for g in range(101):
                take = min(s_raw[g], raw_t[g])
                s_raw[g] -= take
                d_raw[g] += take
            src_slot.raw_stock = s_raw
            dst_slot.raw_stock = d_raw
            
            # Finished
            s_fin = list(src_slot.finished_stock)
            d_fin = list(dst_slot.finished_stock)
            for g in range(101):
                take = min(s_fin[g], fin_t[g])
                s_fin[g] -= take
                d_fin[g] += take
            src_slot.finished_stock = s_fin
            dst_slot.finished_stock = d_fin

        # 4. R&D Levels
        rnd_data = assets.get("rnd_levels", {})
        for comp_type, focus_deltas in rnd_data.items():
            dst_slot = db.query(ComponentSlot).filter(
                ComponentSlot.team_id == dst_inv.team_id,
                ComponentSlot.component == comp_type
            ).one()
            # Simple increment, src doesn't "lose" bytes usually in knowledge trade
            # but user said "exchange", so we might decrement src or just grant to dst.
            # Usually R&D levels are non-destructive grants.
            for focus, delta in focus_deltas.items():
                attr = f"rnd_{focus}"
                if hasattr(dst_slot, attr):
                    setattr(dst_slot, attr, max(0, getattr(dst_slot, attr) + delta))

        # 5. Machines
        machine_ids = assets.get("machines", [])
        for mid in machine_ids:
            m = db.query(Machine).filter(Machine.id == mid, Machine.team_id == src_inv.team_id).first()
            if m:
                # Find target slot for this component
                target_slot = db.query(ComponentSlot).filter(
                    ComponentSlot.team_id == dst_inv.team_id,
                    ComponentSlot.component == m.component
                ).one()
                m.team_id = dst_inv.team_id
                m.slot_id = target_slot.id
                # Condition is carried over as per user requirement

    # Execute both directions
    transfer_assets(inv_a, inv_b, team_a_to_b_assets, team_a.name, team_b.name)
    transfer_assets(inv_b, inv_a, team_b_to_a_assets, team_b.name, team_a.name)

    # Create Notifications/Events for both teams
    # We use source_team_id = OTHER team, target_team_id = THIS team
    # so they see who they traded with.
    from models.game import Cycle
    
    # Use the game's current cycle for the event record
    cycle_id = team_a.game.current_cycle.id if hasattr(team_a.game, "current_cycle") else None
    if not cycle_id:
        # Fallback to the latest cycle in the game
        latest_cycle = db.query(Cycle).filter(Cycle.game_id == team_a.game_id).order_by(Cycle.cycle_number.desc()).first()
        cycle_id = latest_cycle.id if latest_cycle else None

    if cycle_id:
        _make_event(
            db=db, game_id=team_a.game_id, cycle_id=cycle_id,
            phase=EventPhase.FINANCIAL, event_type=EventType.ASSET_EXCHANGE,
            payload={"notes": notes, "direction": "inbound", "from": team_a.name},
            target_team_id=team_b.id, source_team_id=team_a.id,
            notes=notes
        )
        _make_event(
            db=db, game_id=team_a.game_id, cycle_id=cycle_id,
            phase=EventPhase.FINANCIAL, event_type=EventType.ASSET_EXCHANGE,
            payload={"notes": notes, "direction": "inbound", "from": team_b.name},
            target_team_id=team_a.id, source_team_id=team_b.id,
            notes=notes
        )

    db.flush()
