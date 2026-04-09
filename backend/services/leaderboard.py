"""
services/leaderboard.py
=======================
compute_leaderboard(db, game, cycle, is_final)
    Compute composite scores for all active teams.
    Returns a sorted list of LeaderboardRow dicts.
"""
from typing import Dict, List

from sqlalchemy.orm import Session

from core.config import LEADERBOARD_NORMALISE, LEADERBOARD_WEIGHTS
from models.game import Team, Cycle, CyclePhaseLog
from models.procurement import Inventory
from models.deals import Event, EventType
from sqlalchemy import func


def compute_leaderboard(
    db: Session, game, cycle, is_final: bool = False
) -> Dict:
    teams: List[Team] = (
        db.query(Team)
        .filter(Team.game_id == game.id, Team.is_active == True)
        .all()
    )

    rows = []
    for team in teams:
        inv: Inventory = (
            db.query(Inventory).filter(Inventory.team_id == team.id).first()
        )
        if inv is None:
            continue

        drone_stock       = inv.drone_stock or [0] * 101
        inventory_penalty = float(sum(drone_stock[1:]))

        # Quality weighted average from drone_stock
        total_units = sum(drone_stock[1:])
        if total_units > 0:
            quality_avg = sum(g * drone_stock[g] for g in range(1, 101)) / total_units
        else:
            quality_avg = 0.0

        raw = {
            "closing_funds":     inv.funds,
            "cumulative_profit": inv.cumulative_profit,
            "brand_score":       inv.brand_score,
            "quality_avg":       quality_avg,
            "inventory_penalty": inventory_penalty,
        }

        norm = {
            k: v / LEADERBOARD_NORMALISE.get(k, 1.0)
            for k, v in raw.items()
        }

        composite = sum(
            norm[k] * w for k, w in LEADERBOARD_WEIGHTS.items()
        )
        composite = max(-1.0, composite)

        rows.append({
            "team_id":          team.id,
            "team_name":        team.name,
            "composite_score":  round(composite, 4),
            **{k: round(v, 2) for k, v in raw.items()},
        })

    rows.sort(key=lambda r: r["composite_score"], reverse=True)

    prev_score = None
    prev_rank  = 0
    for i, row in enumerate(rows, start=1):
        if row["composite_score"] != prev_score:
            prev_rank  = i
            prev_score = row["composite_score"]
        row["rank"] = prev_rank

    awards = []
    if is_final and len(rows) > 0:
        # 1. Market Titan (Highest Profit)
        titan = max(rows, key=lambda r: r["cumulative_profit"])
        awards.append({
            "category": "Market Titan",
            "team_name": titan["team_name"],
            "description": "Dominant economic force with the highest career profits.",
            "icon": "titan"
        })

        # 2. Quality Paragon (Highest Brand)
        paragon = max(rows, key=lambda r: r["brand_score"])
        awards.append({
            "category": "Quality Paragon",
            "team_name": paragon["team_name"],
            "description": "Unmatched reputation and relentless pursuit of excellence.",
            "icon": "paragon"
        })

        # 3. Ruthless Tycoon (Most Sabotages)
        saboteur = (
            db.query(Team.name, func.count(Event.id).label("count"))
            .join(Event, Event.source_team_id == Team.id)
            .filter(Team.game_id == game.id, Event.event_type == EventType.SUPPLY_SABOTAGE)
            .group_by(Team.id)
            .order_by(func.count(Event.id).desc())
            .first()
        )
        if saboteur:
            awards.append({
                "category": "Ruthless Tycoon",
                "team_name": saboteur[0],
                "description": f"Master of industrial espionage with {saboteur[1]} confirmed sabotages.",
                "icon": "tycoon"
            })

        # 4. Worker's Nightmare (Most Riots)
        # Scan all cycle summaries for this game
        all_logs = db.query(CyclePhaseLog).join(Cycle).filter(Cycle.game_id == game.id).all()
        riot_counts = {}
        for log in all_logs:
            summary = log.production_summary or {}
            for t_id, s in summary.items():
                if s.get("riot"):
                    riot_counts[t_id] = riot_counts.get(t_id, 0) + 1
        
        if riot_counts:
            worst_t_id = max(riot_counts, key=riot_counts.get)
            worst_team = db.query(Team).filter(Team.id == int(worst_t_id)).first()
            if worst_team:
                awards.append({
                    "category": "Worker's Nightmare",
                    "team_name": worst_team.name,
                    "description": f"Suffered {riot_counts[worst_t_id]} riots. Labor unions have placed them on a permanent blacklist.",
                    "icon": "nightmare"
                })

        # 5. Underworld King (Black Market)
        black_market_sales = {}
        for log in all_logs:
            summary = log.sales_summary or {}
            for t_id, s in summary.items():
                bm_sold = s.get("black_market_sold", 0)
                if bm_sold > 0:
                    black_market_sales[t_id] = black_market_sales.get(t_id, 0) + bm_sold
        
        if black_market_sales:
            king_t_id = max(black_market_sales, key=black_market_sales.get)
            king_team = db.query(Team).filter(Team.id == int(king_t_id)).first()
            if king_team:
                awards.append({
                    "category": "Underworld King",
                    "team_name": king_team.name,
                    "description": f"Sold {black_market_sales[king_t_id]} drones via back-alleys. The authorities are looking the other way... for a price.",
                    "icon": "king"
                })

    return {
        "rows": rows,
        "awards": awards
    }