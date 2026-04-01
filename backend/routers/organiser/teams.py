"""
routers/organiser/teams.py
==========================
GET  /organiser/teams                — list all teams + their inventory
GET  /organiser/teams/{id}/inventory — detailed inventory for one team
POST /organiser/teams/{id}/reset-pin — reset a team's PIN
POST /organiser/game/create          — create the game (first endpoint ever called)
POST /organiser/teams/add            — add a team to the active game
"""
import hashlib
from typing import List

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from core.auth import verify_organiser
from core.database import get_db
from models.game import Game, Team
from models.procurement import ComponentSlot, Inventory
from schemas.common import OkResponse
from schemas.game import GameCreate, GameOut, TeamCreate, TeamOut
from services.cycle import add_team, create_game

from core.config import ADMIN_CODE

router = APIRouter(prefix="/organiser", tags=["organiser"])


# ── Game creation (bootstrap — no auth yet) ───────────────────────────────────

@router.post("/game/create", response_model=GameOut, status_code=201)
def bootstrap_game(
    body:               GameCreate,
    x_bootstrap_secret: str = Header(...,
        description="One-time secret from .env to create the first game."),
    db: Session = Depends(get_db),
):
    """
    Create the game. Called once before the event.
    x_bootstrap_secret must match BOOTSTRAP_SECRET in .env.
    After this, use the returned organiser_secret for all admin endpoints.
    """
    import os
    expected = ADMIN_CODE
    if not expected or x_bootstrap_secret != expected:
        raise HTTPException(403, "Invalid bootstrap secret.")

    game = create_game(
        db                       = db,
        name                     = body.name,
        qr_hard                  = body.qr_hard,
        qr_soft                  = body.qr_soft,
        qr_premium               = body.qr_premium,
        market_demand_multiplier = body.market_demand_multiplier,
        starting_funds           = body.starting_funds,
    )
    return game


# ── Team management ───────────────────────────────────────────────────────────

@router.post("/teams/add", response_model=TeamOut, status_code=201)
def create_team(
    body: TeamCreate,
    game: Game    = Depends(verify_organiser),
    db:   Session = Depends(get_db),
):
    try:
        team = add_team(db, game, body.name, body.pin)
    except Exception as e:
        raise HTTPException(400, str(e))
    return team


@router.get("/teams", response_model=List[dict])
def list_teams(
    game: Game    = Depends(verify_organiser),
    db:   Session = Depends(get_db),
):
    teams = db.query(Team).filter(Team.game_id == game.id).all()
    result = []
    for team in teams:
        inv = db.query(Inventory).filter(Inventory.team_id == team.id).first()
        result.append({
            "id":          team.id,
            "name":        team.name,
            "is_active":   team.is_active,
            "funds":       round(inv.funds, 2) if inv else 0.0,
            "brand_score": round(inv.brand_score, 2) if inv else 0.0,
            "has_gov_loan": inv.has_gov_loan if inv else False,
        })
    return result


@router.get("/teams/{team_id}/inventory")
def team_inventory(
    team_id: int,
    game: Game    = Depends(verify_organiser),
    db:   Session = Depends(get_db),
):
    team = db.query(Team).filter(
        Team.id == team_id, Team.game_id == game.id
    ).first()
    if not team:
        raise HTTPException(404, "Team not found.")

    inv   = db.query(Inventory).filter(Inventory.team_id == team.id).first()
    slots = db.query(ComponentSlot).filter(ComponentSlot.team_id == team.id).all()

    return {
        "team":      {"id": team.id, "name": team.name, "is_active": team.is_active},
        "inventory": {
            "funds":             round(inv.funds, 2) if inv else 0.0,
            "brand_score":       round(inv.brand_score, 2) if inv else 0.0,
            "brand_tier":        inv.brand_tier.value if inv else "fair",
            "drone_stock_total": sum(inv.drone_stock[1:]) if inv and inv.drone_stock else 0,
            "workforce":         inv.workforce_size if inv else 0,
            "skill":             round(inv.skill_level, 1) if inv else 0.0,
            "morale":            round(inv.morale, 1) if inv else 0.0,
            "automation":        inv.automation_level.value if inv and hasattr(
                                     inv.automation_level, "value") else "manual",
            "has_gov_loan":      inv.has_gov_loan if inv else False,
            "cumulative_profit": round(inv.cumulative_profit, 2) if inv else 0.0,
        },
        "components": [
            {
                "component":       s.component.value,
                "machine_tier":    s.machine_tier_str,
                "condition":       round(s.machine_condition, 1),
                "raw_stock_total": sum(s.raw_stock[1:]) if s.raw_stock else 0,
                "fin_stock_total": sum(s.finished_stock[1:]) if s.finished_stock else 0,
                "rnd_quality":     s.rnd_quality,
                "rnd_consistency": s.rnd_consistency,
                "rnd_yield":       s.rnd_yield,
            }
            for s in slots
        ],
    }


@router.post("/teams/{team_id}/reset-pin", response_model=OkResponse)
def reset_pin(
    team_id:  int,
    new_pin:  str,
    game: Game    = Depends(verify_organiser),
    db:   Session = Depends(get_db),
):
    team = db.query(Team).filter(
        Team.id == team_id, Team.game_id == game.id
    ).first()
    if not team:
        raise HTTPException(404, "Team not found.")
    team.pin_hash = hashlib.sha256(new_pin.encode()).hexdigest()
    db.commit()
    return OkResponse(message=f"PIN reset for team '{team.name}'.")