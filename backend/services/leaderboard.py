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

    # Pre-calculate total units sold by all teams for market share
    all_logs = db.query(CyclePhaseLog).join(Cycle).filter(Cycle.game_id == game.id).all()
    team_units_sold = {team.id: 0 for team in teams}
    for log in all_logs:
        sales_summary = log.sales_summary or {}
        for t_id_str, s in sales_summary.items():
            t_id = int(t_id_str)
            if t_id in team_units_sold:
                team_units_sold[t_id] += s.get("units_sold", 0) + s.get("black_market_sold", 0) # black market counts or just units_sold?
                # Actually "units_sold" in sales_summary already is typical market sales, let's just use it
    
    total_units_sold_all = sum(team_units_sold.values())

    rows = []
    for team in teams:
        inv: Inventory = (
            db.query(Inventory).filter(Inventory.team_id == team.id).first()
        )
        if inv is None:
            continue
            
        drone_stock = inv.drone_stock or [0] * 101

        # Calculate Net Margin
        if inv.cumulative_revenue > 0:
            net_margin = (inv.cumulative_revenue - inv.cumulative_production_cost) / inv.cumulative_revenue
        else:
            net_margin = 0.0

        # Calculate Enterprise Value
        # 1. Closing funds
        ev_funds = inv.funds
        
        # 2. Machine value
        from models.procurement import Machine
        from core.config import MACHINE_TIERS, PRICE_PREMIUM_NORMAL, PRICE_STANDARD, PRICE_SUBSTANDARD, PRICE_REJECT_SCRAP
        active_machines = db.query(Machine).filter(Machine.team_id == team.id, Machine.is_active == True).all()
        machine_value = sum((m.condition / 100.0) * MACHINE_TIERS.get(m.tier, MACHINE_TIERS["standard"])["buy"] for m in active_machines)
        
        # 3. Drone stock value
        from services.sales import classify_drones
        tiers = classify_drones(drone_stock, game.qr_hard, game.qr_soft, game.qr_premium)
        drone_stock_value = (
            tiers.get("premium", 0) * PRICE_PREMIUM_NORMAL +
            tiers.get("standard", 0) * PRICE_STANDARD +
            tiers.get("substandard", 0) * PRICE_SUBSTANDARD +
            tiers.get("reject", 0) * PRICE_REJECT_SCRAP
        )
        
        # 4. Outstanding loans
        from models.deals import GovDeal, GovDealType, GovDealStatus, EventStatus
        
        # A. Public Repayment Events (e.g. from inter-team or auction loans)
        pending_repayments = db.query(Event).filter(
            Event.target_team_id == team.id,
            Event.event_type == EventType.LOAN_REPAYMENT,
            Event.status == EventStatus.PENDING
        ).all()
        event_debt = sum(ev.payload.get("amount", 0.0) for ev in pending_repayments if ev.payload)
        
        # B. Government Loan Contracts (GovDeals) - these only generate events as they expire
        active_gov_loans = db.query(GovDeal).filter(
            GovDeal.buyer_team_id == team.id,
            GovDeal.deal_type == GovDealType.GREEN_GOV_LOAN,
            GovDeal.status == GovDealStatus.PENDING
        ).all()
        gov_debt = sum(deal.effect_payload.get("principal", 0.0) for deal in active_gov_loans if deal.effect_payload)
        
        outstanding_loans = event_debt + gov_debt
        
        enterprise_value = ev_funds + machine_value + drone_stock_value - outstanding_loans
        
        # Calculate Market Share
        units_sold = team_units_sold.get(team.id, 0)
        market_share = units_sold / total_units_sold_all if total_units_sold_all > 0 else 0.0
        
        # Calculate Operational Efficiency
        if inv.cumulative_production_cost > 0:
            operational_efficiency = inv.cumulative_units_produced / inv.cumulative_production_cost
        else:
            operational_efficiency = 0.0

        raw = {
            "net_margin":             net_margin,
            "enterprise_value":       enterprise_value,
            "market_share":           market_share,
            "brand_score":            inv.brand_score,
            "operational_efficiency": operational_efficiency,
            "liquid_cash":            inv.funds,
        }

        norm = {
            k: v / LEADERBOARD_NORMALISE.get(k, 1.0)
            for k, v in raw.items() if k in LEADERBOARD_WEIGHTS
        }

        composite = sum(
            norm[k] * w for k, w in LEADERBOARD_WEIGHTS.items()
        )
        # We don't cap at -1.0 strictly anymore unless requested, 
        # but let's keep it bounded just in case it's huge negative.
        # Actually margins can drag it down. Let's just not max it.

        rows.append({
            "team_id":          team.id,
            "team_name":        team.name,
            "composite_score":  round(composite, 4),
            **{k: (round(v, 7) if "efficiency" in k else round(v, 4) if "share" in k or "margin" in k else round(v, 2)) for k, v in raw.items()},
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