"""
routers/organiser/deals.py
==========================
All backroom deal and event endpoints. Only accessible during BACKROOM phase.

POST /organiser/deals/gov          — record a government deal
POST /organiser/deals/inter-team   — record an inter-team loan
POST /organiser/deals/global-event — record a global event
GET  /organiser/deals              — list all deals for current cycle
POST /organiser/deals/discover     — manually trigger discovery roll now
DELETE /organiser/deals/{deal_id}  — cancel a PENDING deal
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from core.auth import verify_organiser
from core.database import get_db
from core.enums import CyclePhase, EventType, GovDealType
from models.game import Cycle, Game, Team
from models.deals import EventLedger, GovDeal
from schemas.common import OkResponse
from schemas.deals import EventCreate, EventOut, GovDealCreate, GovDealOut
from services.deals import (
    record_event, record_gov_deal, roll_discovery,
)
from core.enums import GovDealStatus

router = APIRouter(prefix="/organiser/deals", tags=["organiser"])


def _assert_backroom(game: Game, db: Session) -> Cycle:
    cycle = (
        db.query(Cycle)
        .filter(Cycle.game_id == game.id)
        .order_by(Cycle.cycle_number.desc())
        .first()
    )
    if not cycle or cycle.phase_log.current_phase != CyclePhase.BACKROOM:
        raise HTTPException(
            400,
            "Deal endpoints are only accessible during BACKROOM phase.",
        )
    return cycle


def _get_team(team_id: int, game_id: int, db: Session) -> Team:
    team = db.query(Team).filter(
        Team.id == team_id, Team.game_id == game_id
    ).first()
    if not team:
        raise HTTPException(404, f"Team {team_id} not found.")
    return team


# ── Government deal ───────────────────────────────────────────────────────────

@router.post("/gov", response_model=GovDealOut, status_code=201)
def create_gov_deal(
    body: GovDealCreate,
    game: Game    = Depends(verify_organiser),
    db:   Session = Depends(get_db),
):
    cycle       = _assert_backroom(game, db)
    buyer       = _get_team(body.buyer_team_id, game.id, db)
    target      = _get_team(body.target_team_id, game.id, db) \
                  if body.target_team_id else None

    try:
        deal = record_gov_deal(
            db              = db,
            game            = game,
            cycle           = cycle,
            buyer_team      = buyer,
            deal_type       = body.deal_type,
            bribe_amount    = body.bribe_amount,
            target_team     = target,
            override_params = body.override_params,
            notes           = body.notes,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    db.commit()
    return deal


# ── Inter-team loan ───────────────────────────────────────────────────────────

class InterTeamLoanBody(BaseModel):
    borrower_team_id: int   = Field(..., gt=0)
    lender_team_id:   int   = Field(..., gt=0)
    principal:        float = Field(..., gt=0)
    interest_rate:    float = Field(..., ge=0.02, le=0.12)
    duration_cycles:  int   = Field(1, ge=1)
    notes:            Optional[str] = None


@router.post("/inter-team", response_model=EventOut, status_code=201)
def create_inter_team_loan(
    body: InterTeamLoanBody,
    game: Game    = Depends(verify_organiser),
    db:   Session = Depends(get_db),
):
    _assert_backroom(game, db)
    borrower = _get_team(body.borrower_team_id, game.id, db)
    lender   = _get_team(body.lender_team_id,   game.id, db)

    if borrower.id == lender.id:
        raise HTTPException(400, "Borrower and lender cannot be the same team.")

    from models.procurement import Inventory
    lender_inv = db.query(Inventory).filter(
        Inventory.team_id == lender.id
    ).first()
    if lender_inv and lender_inv.funds < body.principal:
        raise HTTPException(400, "Lender has insufficient funds.")

    # Transfer principal
    if lender_inv:
        lender_inv.funds -= body.principal
    borrower_inv = db.query(Inventory).filter(
        Inventory.team_id == borrower.id
    ).first()
    if borrower_inv:
        borrower_inv.funds += body.principal

    ev = record_event(
        db          = db,
        game        = game,
        event_type  = EventType.INTER_TEAM_LOAN,
        cycles      = body.duration_cycles,
        payload     = {
            "principal":       body.principal,
            "rate":            body.interest_rate,
            "lender_team_id":  lender.id,
        },
        team_id     = borrower.id,
        notes       = body.notes,
    )
    db.commit()
    return ev


# ── Government loan ───────────────────────────────────────────────────────────

class GovLoanBody(BaseModel):
    borrower_team_id: int   = Field(..., gt=0)
    principal:        float = Field(..., gt=0)
    duration_cycles:  int   = Field(1, ge=1)
    notes:            Optional[str] = None


@router.post("/gov-loan", response_model=EventOut, status_code=201)
def create_gov_loan(
    body: GovLoanBody,
    game: Game    = Depends(verify_organiser),
    db:   Session = Depends(get_db),
):
    from core.config import GOV_LOAN_INTEREST_RATE, BRAND_DELTA_GOV_LOAN
    _assert_backroom(game, db)
    borrower = _get_team(body.borrower_team_id, game.id, db)

    from models.procurement import Inventory
    inv = db.query(Inventory).filter(Inventory.team_id == borrower.id).first()
    if inv:
        inv.funds        += body.principal
        inv.has_gov_loan  = True
        inv.brand_score   = max(0.0, inv.brand_score + BRAND_DELTA_GOV_LOAN)

    ev = record_event(
        db         = db,
        game       = game,
        event_type = EventType.GOV_LOAN,
        cycles     = body.duration_cycles,
        payload    = {
            "principal": body.principal,
            "rate":      GOV_LOAN_INTEREST_RATE,
        },
        team_id    = borrower.id,
        notes      = body.notes,
    )
    db.commit()
    return ev


# ── Global event ──────────────────────────────────────────────────────────────

@router.post("/global-event", response_model=EventOut, status_code=201)
def create_global_event(
    body: EventCreate,
    game: Game    = Depends(verify_organiser),
    db:   Session = Depends(get_db),
):
    _assert_backroom(game, db)
    ev = record_event(
        db         = db,
        game       = game,
        event_type = EventType.GLOBAL_EVENT,
        cycles     = body.cycles_duration,
        payload    = body.payload,
        team_id    = None,
        notes      = body.notes,
    )
    db.commit()
    return ev


# ── List deals ────────────────────────────────────────────────────────────────

@router.get("", response_model=List[GovDealOut])
def list_deals(
    game: Game    = Depends(verify_organiser),
    db:   Session = Depends(get_db),
):
    cycle = (
        db.query(Cycle)
        .filter(Cycle.game_id == game.id)
        .order_by(Cycle.cycle_number.desc())
        .first()
    )
    if not cycle:
        return []
    return (
        db.query(GovDeal)
        .filter(GovDeal.negotiated_cycle_id == cycle.id)
        .order_by(GovDeal.id)
        .all()
    )


# ── Cancel a deal ─────────────────────────────────────────────────────────────

@router.delete("/{deal_id}", response_model=OkResponse)
def cancel_deal(
    deal_id: int,
    game: Game    = Depends(verify_organiser),
    db:   Session = Depends(get_db),
):
    deal = db.query(GovDeal).filter(
        GovDeal.id == deal_id, GovDeal.game_id == game.id
    ).first()
    if not deal:
        raise HTTPException(404, "Deal not found.")
    if deal.status != GovDealStatus.PENDING:
        raise HTTPException(400, f"Cannot cancel a deal with status '{deal.status}'.")
    deal.status = GovDealStatus.CANCELLED
    db.commit()
    return OkResponse(message=f"Deal {deal_id} cancelled.")


# ── Manual discovery roll ─────────────────────────────────────────────────────

@router.post("/discover", response_model=dict)
def trigger_discovery(
    game: Game    = Depends(verify_organiser),
    db:   Session = Depends(get_db),
):
    """Run discovery rolls for all PENDING deals right now."""
    cycle = (
        db.query(Cycle)
        .filter(Cycle.game_id == game.id)
        .order_by(Cycle.cycle_number.desc())
        .first()
    )
    if not cycle:
        raise HTTPException(404, "No cycle found.")
    result = roll_discovery(db, cycle)
    db.commit()
    return result