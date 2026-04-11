"""
routers/team/inventory.py
==========================
Team endpoints for viewing their own factory state, results, and finances.

GET /team/inventory/components          — all six component slots: stock, R&D, machines
GET /team/inventory/machines/{comp}     — machines for one specific component
GET /team/production/summary            — last production resolution result
GET /team/sales/summary                 — last sales resolution result
GET /team/finances                      — funds, cumulative profit, active loans
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.auth import verify_team
from core.config import MACHINE_TIERS
from core.database import get_db
from core.enums import ComponentType
from models.deals import Event, EventPhase, EventStatus, EventType
from models.game import Cycle, CyclePhaseLog, Game, Team
from models.procurement import ComponentSlot, Inventory, Machine

router = APIRouter(prefix="/team", tags=["team"])


# ── Shared helpers ─────────────────────────────────────────────────────────────

def _current_cycle(db: Session, game_id: int) -> Optional[Cycle]:
    return (
        db.query(Cycle)
        .filter(Cycle.game_id == game_id)
        .order_by(Cycle.cycle_number.desc())
        .first()
    )


def _build_machine(m: Machine) -> dict:
    cfg = MACHINE_TIERS.get(m.tier, MACHINE_TIERS["standard"])
    return {
        "id":              m.id,
        "tier":            m.tier,
        "condition":       round(m.condition, 1),
        "is_active":       m.is_active,
        "throughput":      cfg["throughput"] if m.is_active else 0,
        "base_grade":      cfg["grade"],
        "purchased_cycle": m.purchased_cycle,
        "source":          m.source,
    }


def _build_slot(db: Session, slot: ComponentSlot) -> dict:
    machines = (
        db.query(Machine)
        .filter(Machine.slot_id == slot.id)
        .order_by(Machine.id)
        .all()
    )
    active = [m for m in machines if m.is_active]
    total_throughput = sum(
        MACHINE_TIERS.get(m.tier, MACHINE_TIERS["standard"])["throughput"]
        for m in active
    )
    return {
        "component":        slot.component.value,
        "raw_stock":        slot.raw_stock if slot.raw_stock else [0]*101,
        "finished_stock":   slot.finished_stock if slot.finished_stock else [0]*101,
        "raw_stock_total":  sum(slot.raw_stock[1:])       if slot.raw_stock      else 0,
        "fin_stock_total":  sum(slot.finished_stock[1:])  if slot.finished_stock else 0,
        "rnd_quality":      slot.rnd_quality,
        "rnd_consistency":  slot.rnd_consistency,
        "rnd_yield":        slot.rnd_yield,
        "total_throughput": total_throughput,
        "machine_count":    len(active),
        "machines":         [_build_machine(m) for m in machines],
    }


# ── GET /team/inventory/components ───────────────────────────────────────────

@router.get(
    "/inventory/components",
    summary="All six component slots: stock levels, R&D levels, and all machines.",
)
def get_components(
    team: Team    = Depends(verify_team),
    db:   Session = Depends(get_db),
):
    """
    Returns the team's full factory picture:
    - Raw stock totals per component (what arrived from procurement)
    - Finished stock totals (produced but not yet assembled into drones)
    - R&D levels (quality / consistency / yield) per component
    - All machines per component with tier, condition, throughput
    - Total throughput per component (sum of all active machines)

    Available at any phase. Read-only.
    """
    slots = (
        db.query(ComponentSlot)
        .filter(ComponentSlot.team_id == team.id)
        .order_by(ComponentSlot.component)
        .all()
    )
    inv = db.query(Inventory).filter(Inventory.team_id == team.id).first()

    return {
        "drone_stock":       inv.drone_stock if inv and inv.drone_stock else [0]*101,
        "drone_stock_total": sum(inv.drone_stock[1:]) if inv and inv.drone_stock else 0,
        "components":        [_build_slot(db, slot) for slot in slots],
    }


# ── GET /team/inventory/machines/{component} ──────────────────────────────────

@router.get(
    "/inventory/machines/{component}",
    summary="Machines for one specific component.",
)
def get_machines_for_component(
    component: str,
    team: Team    = Depends(verify_team),
    db:   Session = Depends(get_db),
):
    """
    Returns detailed machine info for one component.
    Useful for the production decision screen where teams choose maintenance
    levels and decide whether to buy an additional machine.

    `component` must be one of: airframe, propulsion, avionics,
    fire_suppression, sensing_safety, battery.
    """
    try:
        comp_enum = ComponentType(component)
    except ValueError:
        raise HTTPException(
            400,
            f"Unknown component '{component}'. "
            f"Valid: {[c.value for c in ComponentType]}",
        )

    slot = (
        db.query(ComponentSlot)
        .filter(
            ComponentSlot.team_id   == team.id,
            ComponentSlot.component == comp_enum,
        )
        .first()
    )
    if not slot:
        raise HTTPException(404, f"Component slot '{component}' not found.")

    machines = (
        db.query(Machine)
        .filter(Machine.slot_id == slot.id)
        .order_by(Machine.id)
        .all()
    )
    active = [m for m in machines if m.is_active]
    cfg_list = [MACHINE_TIERS.get(m.tier, MACHINE_TIERS["standard"]) for m in active]
    total_throughput = sum(c["throughput"] for c in cfg_list)

    return {
        "component":        component,
        "raw_stock_total":  sum(slot.raw_stock[1:])       if slot.raw_stock      else 0,
        "fin_stock_total":  sum(slot.finished_stock[1:])  if slot.finished_stock else 0,
        "rnd_quality":      slot.rnd_quality,
        "rnd_consistency":  slot.rnd_consistency,
        "rnd_yield":        slot.rnd_yield,
        "total_throughput": total_throughput,
        "machines":         [_build_machine(m) for m in machines],
        # Pending R&D events (investments in progress for this component)
        "rnd_in_progress":  _pending_rnd(db, team.id, component),
    }


def _pending_rnd(db: Session, team_id: int, component: str) -> list:
    """Return any RND_INVESTMENT events pending for this team/component."""
    rows = (
        db.query(Event)
        .filter(
            Event.target_team_id == team_id,
            Event.event_type     == EventType.RND_INVESTMENT,
            Event.status         == EventStatus.PENDING,
        )
        .all()
    )
    result = []
    for ev in rows:
        p = ev.payload or {}
        if p.get("component") == component:
            result.append({
                "focus":          p.get("focus"),
                "levels":         p.get("levels", 1),
                "arrives_cycle":  ev.cycle_id,   # cycle_id is the arrival cycle
            })
    return result

# ── GET /team/procurement/summary ──────────────────────────────────────────────

@router.get(
    "/procurement/summary",
    summary="Last procurement resolution result for this team.",
)
def get_procurement_summary(
    team: Team    = Depends(verify_team),
    db:   Session = Depends(get_db),
):
    """
    Returns what happened during the most recent procurement resolution.
    Available from PRODUCTION_OPEN onwards (after procurement has resolved).

    Includes:
    - Per-component: units ordered, units received, cost, event, source, transport, distance, raw material quality.
    - Total Cost: total cost for all components combined.
    """
    game = db.query(Game).filter(Game.id == team.game_id).first()
    cycle = _current_cycle(db, game.id)
    if not cycle or not cycle.phase_log:
        raise HTTPException(404, "No active cycle.")

    summary_map = cycle.phase_log.procurement_summary or {}
    summary = summary_map.get(str(team.id))

    if summary is None:
        raise HTTPException(
            404,
            "Procurement summary not available yet. "
            "It becomes available after the organiser advances past PROCUREMENT_OPEN.",
        )

    return {"cycle_number": cycle.cycle_number, **summary}


# ── GET /team/production/summary ──────────────────────────────────────────────

@router.get(
    "/production/summary",
    summary="Last production resolution result for this team.",
)
def get_production_summary(
    team: Team    = Depends(verify_team),
    db:   Session = Depends(get_db),
):
    """
    Returns what happened during the most recent production resolution.
    Available from SALES_OPEN onwards (after production has resolved).

    Includes:
    - Per-component: units produced, machine condition after degradation,
      effective grade, sigma, RM consumed
    - Labour: riot/strike flags, wage cost, maintenance cost
    - Current funds after production costs were deducted
    """
    game = db.query(Game).filter(Game.id == team.game_id).first()
    cycle = _current_cycle(db, game.id)
    if not cycle or not cycle.phase_log:
        raise HTTPException(404, "No active cycle.")

    summary_map = cycle.phase_log.production_summary or {}
    summary = summary_map.get(str(team.id))

    if summary is None:
        raise HTTPException(
            404,
            "Production summary not available yet. "
            "It becomes available after the organiser advances past PRODUCTION_OPEN.",
        )

    return {"cycle_number": cycle.cycle_number, **summary}


# ── GET /team/sales/summary ───────────────────────────────────────────────────

@router.get(
    "/sales/summary",
    summary="Last sales resolution result for this team.",
)
def get_sales_summary(
    team: Team    = Depends(verify_team),
    db:   Session = Depends(get_db),
):
    """
    Returns what happened during the most recent sales resolution.
    Available from BACKROOM onwards (after sales have resolved).

    Includes:
    - Drones assembled this cycle, units sold/held/scrapped
    - Revenue by tier, holding costs, black market events
    - Brand score change
    - Faction-level detail: which faction bought how many of your drones
    - Closing funds
    """
    game = db.query(Game).filter(Game.id == team.game_id).first()
    cycle = _current_cycle(db, game.id)
    if not cycle or not cycle.phase_log:
        raise HTTPException(404, "No active cycle.")

    summary_map = cycle.phase_log.sales_summary or {}
    summary = summary_map.get(str(team.id))

    if summary is None:
        raise HTTPException(
            404,
            "Sales summary not available yet. "
            "It becomes available after the organiser advances past SALES_OPEN.",
        )

    return {"cycle_number": cycle.cycle_number, **summary}


# ── GET /team/finances ────────────────────────────────────────────────────────

@router.get(
    "/finances",
    summary="Running financial picture: funds, profit, active loans.",
)
def get_finances(
    team: Team    = Depends(verify_team),
    db:   Session = Depends(get_db),
):
    """
    Returns the team's financial state:
    - Current funds (can be negative if costs exceeded revenue)
    - Cumulative profit across all cycles
    - Brand score and tier
    - Active loans: amount of interest due each cycle, remaining duration
    - Gov loan flag (blocks backroom deals when True)

    Available at any phase.
    """
    inv = db.query(Inventory).filter(Inventory.team_id == team.id).first()
    if not inv:
        raise HTTPException(404, "Inventory not found.")

    game  = db.query(Game).filter(Game.id == team.game_id).first()
    cycle = _current_cycle(db, game.id)

    # ── Loans & Debt Projections ──────────────────────────────────────────────
    from models.deals import GovDeal
    from core.enums import GovDealStatus, GovDealType
    
    pending_loans_records = (
        db.query(GovDeal)
        .filter(
            GovDeal.buyer_team_id == team.id,
            GovDeal.status == GovDealStatus.PENDING,
            GovDeal.deal_type == GovDealType.GREEN_GOV_LOAN
        )
        .all()
    )
    
    total_remaining_principal = 0.0
    interest_per_cycle_total = 0.0
    for l_rec in pending_loans_records:
        total_remaining_principal += float(l_rec.effect_payload.get("principal", 0))
        interest_per_cycle_total  += float(l_rec.effect_payload.get("interest_per_cycle", 0))

    # Detailed breakdown for the sidebar (using generated events)
    active_loans = []
    if cycle:
        loan_events = (
            db.query(Event)
            .filter(
                Event.target_team_id == team.id,
                Event.event_type.in_([EventType.LOAN_INTEREST, EventType.LOAN_REPAYMENT]),
                Event.status         == EventStatus.PENDING,
            )
            .order_by(Event.cycle_id)
            .all()
        )
        for ev in loan_events:
            p = ev.payload or {}
            amount = float(p.get("amount", 0)) if p.get("amount") is not None else 0.0
            is_repayment = ev.event_type == EventType.LOAN_REPAYMENT
            active_loans.append({
                "type":               "repayment" if is_repayment else "interest",
                "amount":             amount,
                "lender":             "government" if p.get("lender_team_id") is None
                                      else f"Team {p.get('lender_team_id')}",
                "cycle_id":           ev.cycle_id,
                "cycle_num":          ev.cycle.cycle_number if ev.cycle else 0
            })

    return {
        "funds":             round(inv.funds, 2),
        "cumulative_profit": round(inv.cumulative_profit, 2),
        "brand_score":       round(inv.brand_score, 2),
        "brand_tier":        inv.brand_tier.value,
        "has_gov_loan":      inv.has_gov_loan,
        "active_loans":      active_loans,
        "total_principal_remaining":    round(total_remaining_principal, 2),
        "total_interest_due_per_cycle": round(interest_per_cycle_total, 2),
    }


# ── GET /team/market ──────────────────────────────────────────────────────────

@router.get(
    "/market",
    summary="Current market factions and their projected buying parameters.",
)
def get_market(
    team: Team    = Depends(verify_team),
    db:   Session = Depends(get_db),
):
    """
    Returns the active market factions and their intelligence projections.
    Exact values are obfuscated with a ±15% variance to ensure pricing 
    requires strategic risk rather than just copying a flat ceiling.

    Available from any phase.
    """
    from models.market import MarketFaction
    factions = (
        db.query(MarketFaction)
        .filter(
            MarketFaction.game_id  == team.game_id,
            MarketFaction.is_active == True,
        )
        .order_by(MarketFaction.id)
        .all()
    )
    return {
        "factions": [
            {
                "id":             f.id,
                "name":           f.name,
                "tier_preference": f.tier_preference,
                "projected_ceiling_min": int(f.price_ceiling * 0.85),
                "projected_ceiling_max": int(f.price_ceiling * 1.15),
                "projected_volume_min":  int(f.volume * 0.85),
                "projected_volume_max":  int(f.volume * 1.15),
                "last_cycle_price":      f.last_cycle_price,
                "last_cycle_volume":     f.last_cycle_volume,
                "flexibility":           f.flexibility,
                "brand_min":             f.brand_min,
            }
            for f in factions
        ]
    }

# ── GET/POST /team/members ────────────────────────────────────────────────────

from pydantic import BaseModel

class TeamMemberCreate(BaseModel):
    name: str
    role: Optional[str] = None

@router.get("/members", summary="List team members.")
def get_team_members(
    team: Team    = Depends(verify_team),
    db:   Session = Depends(get_db),
):
    from models.game import TeamMember
    members = db.query(TeamMember).filter(TeamMember.team_id == team.id).all()
    return [{"id": m.id, "name": m.name, "role": m.role} for m in members]

@router.post("/members", summary="Add a new team member.")
def add_team_member(
    body: TeamMemberCreate,
    team: Team    = Depends(verify_team),
    db:   Session = Depends(get_db),
):
    from models.game import TeamMember
    new_member = TeamMember(team_id=team.id, name=body.name, role=body.role)
    db.add(new_member)
    db.commit()
    return {"status": "ok"}