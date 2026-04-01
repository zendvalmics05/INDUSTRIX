"""
routers/team/procurement.py
===========================
GET   /team/procurement        — view current decisions
PATCH /team/procurement        — update decisions (partial)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.auth import verify_team
from core.database import get_db
from core.enums import CyclePhase
from models.game import Cycle, Game, Team
from models.procurement import MemoryProcurement
from schemas.common import OkResponse
from schemas.procurement import ProcurementMemoryOut, ProcurementPatch

router = APIRouter(prefix="/team/procurement", tags=["team"])


def _assert_phase(db: Session, team: Team, expected: CyclePhase) -> Cycle:
    game  = db.query(Game).filter(Game.id == team.game_id, Game.is_active == True).first()
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


@router.get("", response_model=ProcurementMemoryOut)
def get_decisions(
    team: Team    = Depends(verify_team),
    db:   Session = Depends(get_db),
):
    mem = db.query(MemoryProcurement).filter(
        MemoryProcurement.team_id == team.id
    ).first()
    return ProcurementMemoryOut(decisions=mem.decisions if mem else {})


@router.patch("", response_model=OkResponse)
def patch_decisions(
    body: ProcurementPatch,
    team: Team    = Depends(verify_team),
    db:   Session = Depends(get_db),
):
    _assert_phase(db, team, CyclePhase.PROCUREMENT_OPEN)

    mem = db.query(MemoryProcurement).filter(
        MemoryProcurement.team_id == team.id
    ).first()
    if mem is None:
        raise HTTPException(500, "Procurement memory not initialised.")

    # PATCH: merge incoming decisions over existing ones
    current = dict(mem.decisions or {})
    for comp_val, decision in body.decisions.items():
        current[comp_val] = decision.dict()
    mem.decisions = current
    db.commit()
    return OkResponse(message="Procurement decisions updated.")