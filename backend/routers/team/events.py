import random
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.enums import (
    CyclePhase, EventStatus, GovDealStatus, NotificationType, EventType
)
from core.config import DISCOVERY_BOOST_COST, DISCOVERY_BOOST_PROBABILITY
from models.game import Cycle, Team
from models.deals import Event, GovDeal
from models.procurement import Inventory
from schemas.deals import NotificationOut, BackroomStatusOut
from core.auth import verify_team

router = APIRouter(prefix="/team/events", tags=["Team Events"])


@router.get("/notifications", response_model=List[NotificationOut])
def get_notifications(
    db: Session = Depends(get_db),
    team: Team = Depends(verify_team)
):
    """
    Fetch all intelligence notifications for the current team.
    
    TIMING RULES:
    1. Sabotages (SABOTAGE): Visible only AFTER they fire (status=APPLIED).
       Teams see the Trace ID here to use for identification in the Backroom.
    2. Own Self-Buffs (BENEFIT): Visible as soon as recorded (status=PENDING/APPLIED).
       Confirms the deal was struck with the government.
    3. Caught Attacking (DISCOVERY_SELF): Visible as soon as discovered.
    4. Thwarted Attacks (DISCOVERY_THWARTED): Visible as soon as discovered.
    """
    # Find current cycle number for this game
    current_cycle = (
        db.query(Cycle)
        .filter(Cycle.game_id == team.game_id)
        .order_by(Cycle.cycle_number.desc())
        .first()
    )
    if not current_cycle:
        return []

    min_cycle_num = max(1, current_cycle.cycle_number - 1)
    
    # Cycles to include (current and previous)
    relevant_cycles = db.query(Cycle).filter(Cycle.game_id == team.game_id, Cycle.cycle_number >= min_cycle_num).all()
    cycle_ids = [c.id for c in relevant_cycles]
    
    # Map all cycles for this game to be safe
    all_cycles = db.query(Cycle).filter(Cycle.game_id == team.game_id).all()
    cycle_num_map = {c.id: c.cycle_number for c in all_cycles}

    notifications = []

    # 1. Sabotages Suffered (Victim View)
    # Only show if APPLIED (the sabotage actually happened)
    sabotages = (
        db.query(Event)
        .filter(
            Event.target_team_id == team.id,
            Event.cycle_id.in_(cycle_ids),
            Event.status == EventStatus.APPLIED,
            Event.gov_deal_id != None
        )
        .all()
    )

    for ev in sabotages:
        desc = ev.event_type.replace("_", " ").title()
        notifications.append(NotificationOut(
            id=f"ev-{ev.id}",
            cycle_number=ev.cycle.cycle_number,
            type=NotificationType.SABOTAGE,
            title=f"Security Breach: {desc}",
            message=f"Investigation suggests external interference with your operations. Trace ID recorded.",
            severity="error",
            discovery_code=ev.discovery_code,
            payload=ev.payload
        ))

    # 2. Own Deals (Buyer View)
    own_deals = (
        db.query(GovDeal)
        .filter(
            GovDeal.buyer_team_id == team.id,
            GovDeal.negotiated_cycle_id.in_(cycle_ids)
        )
        .all()
    )

    for deal in own_deals:
        # A. If Discovered (Caught)
        if deal.status == GovDealStatus.DISCOVERED:
            fine = round(deal.bribe_amount * 2.5, 2)
            notifications.append(NotificationOut(
                id=f"deal-disc-{deal.id}",
                cycle_number=cycle_num_map.get(deal.negotiated_cycle_id, 0) + 1,
                type=NotificationType.DISCOVERY_SELF,
                title="Protocol Investigation: Compromised",
                message=f"Ministry auditors intercepted your arrangement for '{deal.deal_type}'. Penalty of {fine:,.0f} CU applied.",
                severity="warning",
                payload=deal.effect_payload
            ))
        
        # B. If Pending/Applied/Cancelled (Confirmed record for the buyer)
        elif deal.status in (GovDealStatus.PENDING, GovDealStatus.APPLIED, GovDealStatus.CANCELLED):
            status_text = deal.status.value.capitalize()
            prefix = "Government Accord"
            severity = "success"
            
            if deal.deal_type.startswith("red_"):
                prefix = "Offensive Protocol"
                severity = "info"  # Not error, as the buyer bought it intentionally
            elif deal.deal_type.startswith("blue_"):
                prefix = "Intelligence Protocol"
                severity = "info"
                
            clean_type = deal.deal_type.value.replace('green_', '').replace('red_', '').replace('blue_', '').replace('_', ' ').title()
            
            notifications.append(NotificationOut(
                id=f"deal-self-{deal.id}-{deal.status.value}",
                cycle_number=cycle_num_map.get(deal.negotiated_cycle_id, 0),
                type=NotificationType.BENEFIT,
                title=f"{prefix}: {clean_type}",
                message=f"Agreement verified and recorded. Protocol Status: {status_text}.",
                severity=severity,
                payload=deal.effect_payload
            ))

    # 3. Thwarted Attacks (Target View)
    thwarted = (
        db.query(GovDeal)
        .filter(
            GovDeal.target_team_id == team.id,
            GovDeal.status == GovDealStatus.DISCOVERED,
            GovDeal.negotiated_cycle_id.in_(cycle_ids)
        )
        .all()
    )

    for deal in thwarted:
        notifications.append(NotificationOut(
            id=f"thwart-{deal.id}",
            cycle_number=cycle_num_map.get(deal.negotiated_cycle_id, 0) + 1,
            type=NotificationType.DISCOVERY_THWARTED,
            title="Threat Neutralized",
            message=f"A hostile protocol targeting your organization was intercepted and nullified by security forces.",
            severity="success"
        ))

    # 4. Pure Financial Events (Tax, Fines - usually global or organiser triggered)
    financials = (
        db.query(Event)
        .filter(
            Event.target_team_id == team.id,
            Event.cycle_id.in_(cycle_ids),
            Event.status == EventStatus.APPLIED,
            Event.event_type.in_([EventType.ARBITRARY_FINE, EventType.TAX_EVASION_REFUND])
        )
        .all()
    )

    for ev in financials:
        if ev.event_type == EventType.ARBITRARY_FINE:
            notifications.append(NotificationOut(
                id=f"fin-{ev.id}",
                cycle_number=ev.cycle.cycle_number,
                type=NotificationType.FINE,
                title="Ministry Fine",
                message=f"Administrative deduction of {ev.payload.get('fine_amount', 0):,.0f} CU applied to your accounts.",
                severity="warning",
                payload=ev.payload
            ))
        else:
            notifications.append(NotificationOut(
                id=f"fin-{ev.id}",
                cycle_number=ev.cycle.cycle_number,
                type=NotificationType.BENEFIT,
                title="Tax Rebate",
                message=f"Received a {ev.payload.get('refund_fraction', 0)*100:.1f}% refund on operating costs.",
                severity="success",
                payload=ev.payload
            ))

    # 5. Blue Deals - Intel Reports (Buyer View)
    intel_reports = (
        db.query(Event)
        .filter(
            Event.source_team_id == team.id,
            Event.cycle_id.in_(cycle_ids),
            Event.status == EventStatus.APPLIED,
            Event.event_type == EventType.ESPIONAGE_DATA
        )
        .all()
    )
    for ev in intel_reports:
        notifications.append(NotificationOut(
            id=f"intel-{ev.id}",
            cycle_number=ev.cycle.cycle_number,
            type=NotificationType.INTEL_REPORT,
            title="Intelligence Bureau: Reconnaissance Report",
            message=f"Confidential data intercepted regarding target organization. Decryption successful.",
            severity="info",
            payload=ev.payload
        ))

    # 6. Blue Deals - Operational Loss (Victim View)
    losses = (
        db.query(Event)
        .filter(
            Event.target_team_id == team.id,
            Event.cycle_id.in_(cycle_ids),
            Event.status == EventStatus.APPLIED,
            Event.event_type.in_([EventType.TALENT_THEFT, EventType.RESOURCE_BLOCKADE])
        )
        .all()
    )
    for ev in losses:
        desc = ev.event_type.replace("_", " ").title()
        notifications.append(NotificationOut(
            id=f"loss-{ev.id}",
            cycle_number=ev.cycle.cycle_number,
            type=NotificationType.OPERATIONAL_LOSS,
            title=f"Operational Disturbance: {desc}",
            message=f"Anomalies detected in internal operations. Asset reconciliation required.",
            severity="error",
            payload=ev.payload
        ))

    # 7. Asset Exchanges (Mutual View)
    exchanges = (
        db.query(Event)
        .filter(
            Event.target_team_id == team.id,
            Event.cycle_id.in_(cycle_ids),
            Event.event_type == EventType.ASSET_EXCHANGE
        )
        .all()
    )
    for ev in exchanges:
        origin = ev.payload.get("from", "External")
        notifications.append(NotificationOut(
            id=f"exch-{ev.id}",
            cycle_number=ev.cycle.cycle_number,
            type=NotificationType.ASSET_EXCHANGE,
            title="Intra-Company Asset Transfer",
            message=f"Assets received from {origin}. Protocol: {ev.payload.get('direction', 'unknown')}.",
            severity="info",
            payload=ev.payload
        ))

    # 8. Loan Repayments
    repayments = (
        db.query(Event)
        .filter(
            Event.target_team_id == team.id,
            Event.cycle_id.in_(cycle_ids),
            Event.status == EventStatus.APPLIED,
            Event.event_type.in_([EventType.LOAN_REPAYMENT, EventType.LOAN_INTEREST])
        )
        .all()
    )
    for ev in repayments:
        notifications.append(NotificationOut(
            id=f"repr-{ev.id}",
            cycle_number=ev.cycle.cycle_number,
            type=NotificationType.ASSET_EXCHANGE, # reuse or use info
            title="Debt Reconciliation",
            message=f"Automatic repayment processed. Principal and interest updated.",
            severity="info",
            payload=ev.payload
        ))

    # Sort by cycle number desc, then id desc
    notifications.sort(key=lambda x: (x.cycle_number, x.id), reverse=True)
    return notifications


@router.get("/backroom-status", response_model=BackroomStatusOut)
def get_backroom_status(
    db: Session = Depends(get_db),
    team: Team = Depends(verify_team)
):
    inv = db.query(Inventory).filter(Inventory.team_id == team.id).first()
    return BackroomStatusOut(
        discovery_boost_active=inv.block_probability > 0,
        boost_cost=0.0, # Now dynamic/manual
        boost_probability=inv.block_probability
    )


@router.post("/buy-intel")
def buy_intel(
    db: Session = Depends(get_db),
    team: Team = Depends(verify_team)
):
    raise HTTPException(
        status_code=403, 
        detail="Standard security autonomous activation disabled. Contact your Government Liaison for custom protocol pricing."
    )

@router.get("/news")
def get_news(
    db: Session = Depends(get_db),
    team: Team = Depends(verify_team)
):
    """
    Generate dynamic, vague news snippets about the state of the game based on active data and logs.
    Includes labour gossip, financial scandals, and market movements.
    New rumors 'unlock' every 30 seconds during a phase.
    """
    _FLAVOR_NEWS = [
        "Ministry of Transport announces rail infrastructure priority for next cycle.",
        "Scientists predict a temporary increase in high-grade battery tech availability.",
        "Unconfirmed reports of a major logistics union considering a brief pause.",
        "Environmental regulators hint at new emission standards for propulsion systems.",
        "Global minerals market shows signs of minor price stabilization.",
        "Industrial designers celebrate 'Innovation Week' — R&D enthusiasm is at a cycle high.",
        "Rumors of a 'Black Swan' event in the sensing equipment market are dismissed by experts.",
        "Ministry Directorate issues a warning against unlicensed asset trading.",
        "A private investor group has reportedly expressed interest in 'the most innovative' drone firm.",
        "Ministry of Labours rants about 'unpatriotic' wage stagnation in some sectors.",
        "Local entrepreneurs demand lower interest rates on Ministry-backed loans.",
        "A fleet of luxury drones was reportedly spotted near the Ministry's private residence.",
        "Rumors of a 'Phantom Warehouse' containing Grade-100 components are circulating.",
        "Ministry of Security warns of high-frequency data scans in industrial sectors.",
        "A small faction of workers is reportedly petitioning for a 'Automation Tax'.",
        "Coastal logistics hubs report a 15% increase in throughput capacity.",
        "Military contractors express interest in the 'reliability' of civilian drone fleets.",
        "A minor fire in a component warehouse has caused local price tremors.",
        "Experts argue that 'brand prestige' is becoming the most valuable industrial asset.",
        "Ministry of Energy discusses potential subsidies for high-efficiency propulsion.",
    ]

    current_cycle = (
        db.query(Cycle)
        .filter(Cycle.game_id == team.game_id)
        .order_by(Cycle.cycle_number.desc())
        .first()
    )
    if not current_cycle:
        return []

    min_cycle_num = max(1, current_cycle.cycle_number - 1)
    relevant_cycles = db.query(Cycle).filter(Cycle.game_id == team.game_id, Cycle.cycle_number >= min_cycle_num).all()
    cycle_ids = [c.id for c in relevant_cycles]

    all_teams = db.query(Team).filter(Team.game_id == team.game_id).all()
    team_names = {str(t.id): t.name for t in all_teams}
    
    news = []

    # 1. Look for sabotage events against ANY team
    sabotages = (
        db.query(Event)
        .filter(
            Event.cycle_id.in_(cycle_ids),
            Event.status == EventStatus.APPLIED,
            Event.gov_deal_id != None
        )
        .all()
    )
    for ev in sabotages:
        victim_name = team_names.get(str(ev.target_team_id), "AN UNKNOWN ENTITY").upper()
        news.append({
            "id": f"news-sab-{ev.id}",
            "cycle_number": ev.cycle.cycle_number,
            "type": "sabotage",
            "title": "DIRECT ATTACK CONFIRMED",
            "message": f"CRITICAL BREACH! {victim_name} has been targeted by professional saboteurs. Their operations are reportedly in shambles following the interception of their local protocols."
        })

    # 2. Extract news from CyclePhaseLogs
    for c in relevant_cycles:
        if not c.phase_log:
            continue
            
        # Procurement insights (High volume & Logistics Failures)
        proc_summary = c.phase_log.procurement_summary or {}
        for t_id, t_data in proc_summary.items():
            t_name = team_names.get(t_id, "A competitor")
            
            # 1. Volume tracking
            total_ordered = sum(comp.get("units_ordered", 0) for comp in t_data.get("per_component", {}).values())
            if total_ordered > 10000:
                news.append({
                    "id": f"news-proc-vol-{c.id}-{t_id}",
                    "cycle_number": c.cycle_number,
                    "type": "stockpile",
                    "title": "Massive Raw Material Movements",
                    "message": f"Logistics networks report extremely high shipping activity destined for {t_name}. Market analysts suspect aggressive stockpiling."
                })

            # 2. Logistics Failures (Real Data!)
            for comp, details in t_data.get("per_component", {}).items():
                ev_type = details.get("event", "none")
                t_name_upper = t_name.upper()
                comp_upper = comp.upper()
                
                if ev_type == "partial_damage":
                    news.append({
                        "id": f"news-proc-dmg-{c.id}-{t_id}-{comp}",
                        "cycle_number": c.cycle_number,
                        "type": "market",
                        "title": "LOGISTICS COLLAPSE",
                        "message": f"CARGO DECIMATED! {t_name_upper} is reeling after their shipment of {comp_upper} suffered catastrophic damage in transit. Regional supply chains are strained."
                    })
                elif ev_type == "sabotaged":
                    news.append({
                        "id": f"news-proc-sab-{c.id}-{t_id}-{comp}",
                        "cycle_number": c.cycle_number,
                        "type": "sabotage",
                        "title": "SUPPLY CHAIN ATTACK",
                        "message": f"INTERCEPTION! Global freight monitors confirm {t_name_upper}'s {comp_upper} shipment was successfully sabotaged. Logistics experts call it a 'surgical strike'."
                    })
                elif ev_type == "source_unavailable":
                    news.append({
                        "id": f"news-proc-src-{c.id}-{t_id}-{comp}",
                        "cycle_number": c.cycle_number,
                        "type": "market",
                        "title": "PROCUREMENT FAILURE",
                        "message": f"SUPPLY CUTOFF! {t_name_upper} failed to secure critical {comp_upper} stocks. Their production quotas for the cycle are reportedly in jeopardy."
                    })
                
                # Also keep the existing high-volume scuttlebutt for sources
                if details.get("units_received", 0) > 5000:
                    src_id = details.get("source_id", "Unknown")
                    news.append({
                        "id": f"news-proc-src-vol-{c.id}-{t_id}-{comp}",
                        "cycle_number": c.cycle_number,
                        "type": "market",
                        "title": "MASSIVE PROCUREMENT LEAK",
                        "message": f"RECORDS EXPOSED! {t_name_upper} has imported a staggering shipment of {comp_upper} from Source {src_id}. Market analysts are adjusting their risk profiles."
                    })

        # Production insights
        prod_summary = c.phase_log.production_summary or {}
        for t_id, t_data in prod_summary.items():
            t_name_upper = team_names.get(t_id, "A competitor").upper()
            if t_data.get("riot"):
                news.append({
                    "id": f"news-riot-{c.id}-{t_id}",
                    "cycle_number": c.cycle_number,
                    "type": "labour",
                    "title": "FACILITY CHAOS",
                    "message": f"VIOLENT UPRISING! {t_name_upper} factory floors are in flames following a full-scale riot. Operations are completely paralyzed."
                })
            elif t_data.get("strike"):
                news.append({
                    "id": f"news-strike-{c.id}-{t_id}",
                    "cycle_number": c.cycle_number,
                    "type": "labour",
                    "title": "LABOUR WALKOUT",
                    "message": f"PRODUCTION STALLED! Unions have crippled {t_name_upper} in a coordinated strike. Morale is reported to be at an all-time low."
                })

        # Sales insights
        sales_summary = c.phase_log.sales_summary or {}
        for t_id, t_data in sales_summary.items():
            t_name_upper = team_names.get(t_id, "A competitor").upper()
            if t_data.get("black_market_discovered"):
                news.append({
                    "id": f"news-bm-{c.id}-{t_id}",
                    "cycle_number": c.cycle_number,
                    "type": "scandal",
                    "title": "BLACK MARKET BUST",
                    "message": f"CRIMINAL INTERCEPTION! {t_name_upper} was caught funneling assets through the underground market. Ministry fines are reportedly devastating."
                })
            elif t_data.get("brand_delta", 0) < -10:
                news.append({
                    "id": f"news-brand-{c.id}-{t_id}",
                    "cycle_number": c.cycle_number,
                    "type": "scandal",
                    "title": "REPUTATION COLLAPSE",
                    "message": f"PR CATASTROPHE! Trust in {t_name_upper} has evaporated following recent failures. Consumers are boycotting their products en masse."
                })

        # 4. Government Exposure (Red-Handed Reports)
        discovered_deals = (
            db.query(GovDeal)
            .filter(
                GovDeal.negotiated_cycle_id == c.id,
                GovDeal.status == GovDealStatus.DISCOVERED
            )
            .all()
        )
        for deal in discovered_deals:
            perp_name = team_names.get(str(deal.buyer_team_id), "A shadow entity")
            victim_name = team_names.get(str(deal.target_team_id), "a competitor")
            news.append({
                "id": f"news-disc-{deal.id}",
                "cycle_number": c.cycle_number + 1,
                "type": "scandal",
                "title": "GLORIOUS GOVERNMENT EXPOSES HOSTILITY",
                "message": f"Justice! The Ministry of Security has caught {perp_name} red-handed in a hostile protocol against {victim_name}. 'This aggression will not stand,' says the Directorate."
            })

    # 5. Inventory-based news (Wages, Loans)
    all_invs = db.query(Inventory).filter(Inventory.team_id.in_([t.id for t in all_teams])).all()
    inv_map = {str(i.team_id): i for i in all_invs}

    for t_id, inv in inv_map.items():
        t_name = team_names.get(t_id, "A competitor")
        
        # Loans
        if inv.has_gov_loan:
            news.append({
                "id": f"news-loan-{t_id}",
                "cycle_number": current_cycle.cycle_number,
                "type": "finance",
                "title": "FINANCIAL WEAKNESS EXPOSED",
                "message": f"MINISTRY BAILOUT! {t_name.upper()} has bent the knee for a government liquidity injection. They are now operating under strict state oversight."
            })
        
        # Wage Gossip (High Morale/Wages check - though we check summary mostly)
        # We can also check if they are the "Highest/Lowest" relative.
    
    # Highest/Lowest salary reporting from production summaries
    if relevant_cycles:
        last_prod = relevant_cycles[0].phase_log.production_summary if relevant_cycles[0].phase_log else {}
        if last_prod:
            labour_data = []
            for tid, data in last_prod.items():
                wlvl = data.get("labour", {}).get("wage_level")
                if wlvl:
                    labour_data.append((tid, wlvl))
            
            if labour_data:
                # Find teams with 'above_market'
                high_payers = [tid for tid, lvl in labour_data if lvl == "above_market"]
                for tid in high_payers:
                    news.append({
                        "id": f"news-wage-hi-{tid}",
                        "cycle_number": current_cycle.cycle_number,
                        "type": "labour",
                        "title": "Talent War: Luxury Salaries",
                        "message": f"Workers across the sector are flocking to {team_names.get(tid, 'a competitor')} as they offer industry-leading wage packages."
                    })
                
                low_payers = [tid for tid, lvl in labour_data if lvl == "below_market"]
                for tid in low_payers:
                    news.append({
                        "id": f"news-wage-lo-{tid}",
                        "cycle_number": current_cycle.cycle_number,
                        "type": "labour",
                        "title": "Staffing Crisis Looming",
                        "message": f"Low morale reported at {team_names.get(tid, 'one firm')} as rumors of below-market wage cuts begin to circulate."
                    })

    # 6. Time-based flavor unlocking (1 per 30 seconds)
    # Determine how long the current phase has been open
    log = current_cycle.phase_log
    phase_start = log.procurement_opened_at
    if log.current_phase == CyclePhase.PRODUCTION_OPEN: phase_start = log.production_opened_at
    if log.current_phase == CyclePhase.SALES_OPEN:       phase_start = log.sales_opened_at
    if log.current_phase == CyclePhase.BACKROOM:         phase_start = log.backroom_opened_at
    
    # If phase_start is None (e.g. cycle just created), use updated_at
    if not phase_start:
        phase_start = log.updated_at
        
    seconds_elapsed = (datetime.now(timezone.utc).replace(tzinfo=None) - phase_start).total_seconds()
    
    # Reveal 1 item + 1 per 30 seconds, max 5 per cycle phase
    unlock_count = min(5, 1 + int(seconds_elapsed // 30))
    
    random.seed(f"{current_cycle.id}-{log.current_phase}")
    selected_flavor = random.sample(_FLAVOR_NEWS, min(len(_FLAVOR_NEWS), 10)) # Shuffle a subset
    
    for i in range(unlock_count):
        news.append({
            "id": f"news-flavor-{current_cycle.id}-{log.current_phase}-{i}",
            "cycle_number": current_cycle.cycle_number,
            "type": "market",
            "title": "Industry Whisper",
            "message": selected_flavor[i]
        })

    # Sort news descending by cycle
    news.sort(key=lambda x: (x["cycle_number"], x["id"]), reverse=True)
    return news
