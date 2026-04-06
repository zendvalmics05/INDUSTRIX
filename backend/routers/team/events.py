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

router = APIRouter(prefix="/events", tags=["Team Events"])


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
    cycle_ids = [
        c.id for c in db.query(Cycle.id)
        .filter(Cycle.game_id == team.game_id, Cycle.cycle_number >= min_cycle_num)
        .all()
    ]

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
                cycle_number=deal.negotiated_cycle.cycle_number + 1,
                type=NotificationType.DISCOVERY_SELF,
                title="Protocol Investigation: Compromised",
                message=f"Ministry auditors intercepted your arrangement for '{deal.deal_type}'. Penalty of {fine:,.0f} CU applied.",
                severity="warning",
                payload=deal.effect_payload
            ))
        
        # B. If Self-Buff (Confirmed record for the team)
        elif deal.deal_type.startswith("green_"):
            status_text = "Active" if deal.status == GovDealStatus.PENDING else "Concluded"
            notifications.append(NotificationOut(
                id=f"deal-self-{deal.id}",
                cycle_number=deal.negotiated_cycle.cycle_number,
                type=NotificationType.BENEFIT,
                title=f"Government Accord: {deal.deal_type.replace('green_', '').replace('_', ' ').title()}",
                message=f"Agreement verified and recorded. Protocol Status: {status_text}.",
                severity="success",
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
            cycle_number=deal.negotiated_cycle.cycle_number + 1,
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
            Event.event_type == EventType.LOAN_REPAYMENT
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
