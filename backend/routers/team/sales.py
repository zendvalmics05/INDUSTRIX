"""
routers/team/sales.py
=====================
GET   /team/sales   — view current decisions
PATCH /team/sales   — update decisions (partial)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.auth import verify_team
from core.database import get_db
from core.enums import CyclePhase
from models.game import Cycle, Game, Team
from models.sales import MemorySales
from schemas.common import OkResponse
from schemas.sales import SalesMemoryOut, SalesPatch, AssemblyProjectionIn, AssemblyProjectionOut, SalesPricesOut
from core.config import (
    PRICE_REJECT_SCRAP, PRICE_REJECT_REWORK, PRICE_REJECT_BLACK_MKT,
    PRICE_SUBSTANDARD, PRICE_STANDARD, PRICE_PREMIUM_SELL
)

router = APIRouter(prefix="/team/sales", tags=["team"])


@router.get("/prices", response_model=SalesPricesOut)
def get_standard_prices():
    """Return the authoritative price constants for sales decision UI."""
    return SalesPricesOut(
        scrap=PRICE_REJECT_SCRAP,
        rework=PRICE_REJECT_REWORK,
        black_market=PRICE_REJECT_BLACK_MKT,
        substandard=PRICE_SUBSTANDARD,
        standard=PRICE_STANDARD,
        premium=PRICE_PREMIUM_SELL
    )


def _assert_phase(db: Session, team: Team, expected: CyclePhase) -> Cycle:
    game  = db.query(Game).filter(Game.id == team.game_id,Game.is_active == True).first()
    cycle = (
        db.query(Cycle)
        .filter(Cycle.game_id == game.id)
        .order_by(Cycle.cycle_number.desc())
        .first()
    )
    if not cycle or cycle.phase_log.current_phase != expected:
        raise HTTPException(
            400,
            f"Action only allowed during {expected.value}. "
            f"Current: {cycle.phase_log.current_phase.value if cycle else 'none'}",
        )
    return cycle


@router.get("", response_model=SalesMemoryOut)
def get_decisions(
    team: Team    = Depends(verify_team),
    db:   Session = Depends(get_db),
):
    game  = db.query(Game).filter(Game.id == team.game_id, Game.is_active == True).first()
    cycle = (
        db.query(Cycle)
        .filter(Cycle.game_id == game.id)
        .order_by(Cycle.cycle_number.desc())
        .first()
    )
    
    mem = db.query(MemorySales).filter(MemorySales.team_id == team.id).first()
    decisions = mem.decisions if mem else {}
    units_to_assemble = decisions.get("units_to_assemble")
    
    return SalesMemoryOut(
        decisions=decisions,
        units_to_assemble=units_to_assemble,
        qr_hard=cycle.qr_hard if cycle else 0.0,
        qr_soft=cycle.qr_soft if cycle else 0.0,
        qr_premium=cycle.qr_premium if cycle else 0.0,
    )


@router.patch("", response_model=OkResponse)
def patch_decisions(
    body: SalesPatch,
    team: Team    = Depends(verify_team),
    db:   Session = Depends(get_db),
):
    _assert_phase(db, team, CyclePhase.SALES_OPEN)

    mem = db.query(MemorySales).filter(
        MemorySales.team_id == team.id
    ).first()
    if mem is None:
        raise HTTPException(500, "Sales memory not initialised.")

    current = dict(mem.decisions or {})

    # Save units_to_assemble at top level of decisions
    if body.units_to_assemble is not None:
        current["units_to_assemble"] = body.units_to_assemble

    for tier_val, dec in body.decisions.items():
        current[tier_val] = dec.dict()

    mem.decisions = current
    db.commit()

    return OkResponse(message="Sales decisions updated.")


@router.post("/projections", response_model=AssemblyProjectionOut)
def post_projections(
    body: AssemblyProjectionIn,
    team: Team    = Depends(verify_team),
    db:   Session = Depends(get_db),
):
    """
    Project drone quality distribution and bottleneck for a given assembly volume.
    Read-only simulation.
    """
    from models.procurement import ComponentSlot
    from services.sales import get_assembly_projections

    slots = {
        s.component.value: s
        for s in db.query(ComponentSlot)
        .filter(ComponentSlot.team_id == team.id)
        .all()
    }
    
    dist, bottleneck, max_p = get_assembly_projections(slots, body.units_to_assemble)
    
    return AssemblyProjectionOut(
        projected_distribution=dist,
        bottleneck_component=bottleneck,
        max_possible=max_p
    )