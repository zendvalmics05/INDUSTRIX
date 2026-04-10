from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from core.database import get_db
from core.auth import verify_team
from models.game import Game, Cycle, Team
from models.deals import Event, EventType, EventStatus
from schemas.briefing import CycleBriefingOut, LastCycleStats, OperationalUpdate, MarketIntel

router = APIRouter(prefix="/team/briefing", tags=["team"])

@router.get("", response_model=CycleBriefingOut)
def get_cycle_briefing(
    team: Team = Depends(verify_team),
    db: Session = Depends(get_db)
):
    """
    Returns a briefing for the current cycle, including a recap of the previous 
    cycle's resolution and new intelligence for the current one.
    """
    game = db.query(Game).filter(Game.is_active == True).first()
    if not game:
        raise HTTPException(404, "No active game.")

    current_cycle = (
        db.query(Cycle)
        .filter(Cycle.game_id == game.id)
        .order_by(Cycle.cycle_number.desc())
        .first()
    )
    if not current_cycle:
        raise HTTPException(404, "No cycle found.")

    res = CycleBriefingOut(cycle_number=current_cycle.cycle_number)

    # 1. Last Cycle Stats
    if current_cycle.cycle_number > 1:
        prev_cycle = (
            db.query(Cycle)
            .filter(Cycle.game_id == game.id, Cycle.cycle_number == current_cycle.cycle_number - 1)
            .first()
        )
        if prev_cycle and prev_cycle.phase_log:
            log = prev_cycle.phase_log
            t_id = str(team.id)
            
            proc_s = (log.procurement_summary or {}).get(t_id, {})
            prod_s = (log.production_summary or {}).get(t_id, {})
            sale_s = (log.sales_summary or {}).get(t_id, {})
            
            revenue = sale_s.get("revenue", 0.0)
            # procurement_cost (already deducted during resolution)
            # prod_wage_cost + maint_cost (already deducted)
            # holding_cost (already deducted)
            
            # For "expenses" we aggregate what was spent/deducted in the summaries
            # Include fin_adjustment (interest/fines) from the sales summary
            fin_adj = sale_s.get("fin_adjustment", 0.0)
            
            expenses = (
                proc_s.get("total_cost", 0.0) + 
                prod_s.get("wage_cost", 0.0) + 
                prod_s.get("maintenance_cost", 0.0) + 
                prod_s.get("buy_cost", 0.0) + 
                prod_s.get("rnd_cost", 0.0) + 
                prod_s.get("automation_upgrade_cost", 0.0) +
                sale_s.get("holding_cost", 0.0) - 
                (fin_adj if fin_adj < 0 else 0)
            )
            
            # If fin_adj is positive (refund), it should decrease expenses or increase profit.
            # Usually fin_adj is negative for costs. 
            # Let's just use a more direct profit calculation: revenue - expenses + fin_adj
            
            res.last_cycle_stats = LastCycleStats(
                cycle_number = prev_cycle.cycle_number,
                revenue      = revenue,
                expenses     = expenses,
                net_profit   = revenue - expenses + (fin_adj if fin_adj > 0 else 0),
                units_sold   = sale_s.get("units_sold", 0),
                brand_delta  = sale_s.get("brand_delta", 0.0),
                brand_score  = sale_s.get("brand_score_after", 0.0)
            )

    # 2. Intelligence for CURRENT cycle
    # Focus on R&D completions and helpful discoveries
    events = (
        db.query(Event)
        .filter(
            Event.cycle_id == current_cycle.id,
            Event.target_team_id == team.id
        )
        .all()
    )
    
    for ev in events:
        p = ev.payload or {}
        if ev.event_type == EventType.RND_INVESTMENT:
            comp = p.get("component", "System")
            focus = p.get("focus", "Efficiency")
            res.operational_updates.append(OperationalUpdate(
                title=f"R&D Completion: {comp.capitalize()}",
                description=f"New breakthrough in {focus} has been integrated into the production line.",
                type="rnd"
            ))
        elif ev.event_type == EventType.SKILLED_LABOUR:
            res.operational_updates.append(OperationalUpdate(
                title="Labour Quality Upgraded",
                description="Our recruitment drive has yielded high-skill additions to the workforce.",
                type="staffing"
            ))
        elif ev.event_type == EventType.BENEFIT:
            res.market_intelligence.append(MarketIntel(
                title=ev.title or "Favourable Condition",
                message=ev.message or "Market conditions have shifted in our favour.",
                severity="success"
            ))
        elif ev.event_type == EventType.INTEL_REPORT:
            res.market_intelligence.append(MarketIntel(
                title="Intelligence Digest",
                message=ev.message,
                severity="info"
            ))

    return res
