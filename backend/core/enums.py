"""
core/enums.py
=============
All enumerations for Industrix. One source of truth —
never define game constants anywhere else.
"""
import enum


# ── Components ────────────────────────────────────────────────────────────────

class ComponentType(str, enum.Enum):
    AIRFRAME         = "airframe"
    PROPULSION       = "propulsion"
    AVIONICS         = "avionics"
    FIRE_SUPPRESSION = "fire_suppression"
    SENSING_SAFETY   = "sensing_safety"
    BATTERY          = "battery"


# ── Procurement ───────────────────────────────────────────────────────────────

class TransportMode(str, enum.Enum):
    AIR  = "air"
    RAIL = "rail"
    ROAD = "road"


# ── Production ────────────────────────────────────────────────────────────────

class MachineTier(str, enum.Enum):
    BASIC      = "basic"
    STANDARD   = "standard"
    INDUSTRIAL = "industrial"
    PRECISION  = "precision"


class MaintenanceLevel(str, enum.Enum):
    NONE     = "none"
    BASIC    = "basic"
    FULL     = "full"
    OVERHAUL = "overhaul"


class AutomationLevel(str, enum.Enum):
    MANUAL    = "manual"
    SEMI_AUTO = "semi_auto"
    FULL_AUTO = "full_auto"


class WageLevel(str, enum.Enum):
    BELOW_MARKET = "below_market"
    MARKET       = "market"
    ABOVE_MARKET = "above_market"


class RndFocus(str, enum.Enum):
    QUALITY     = "quality"
    CONSISTENCY = "consistency"
    YIELD       = "yield"


# ── Sales ─────────────────────────────────────────────────────────────────────

class QualityTier(str, enum.Enum):
    REJECT      = "reject"
    SUBSTANDARD = "substandard"
    STANDARD    = "standard"
    PREMIUM     = "premium"


class SalesAction(str, enum.Enum):
    SELL_MARKET     = "sell_market"
    SELL_PREMIUM    = "sell_premium"
    SELL_DISCOUNTED = "sell_discounted"
    HOLD            = "hold"
    SCRAP           = "scrap"
    BLACK_MARKET    = "black_market"


class BrandTier(str, enum.Enum):
    POOR      = "poor"
    FAIR      = "fair"
    GOOD      = "good"
    EXCELLENT = "excellent"


# ── Cycle ─────────────────────────────────────────────────────────────────────

class CyclePhase(str, enum.Enum):
    """
    Linear phase machine. Organiser calls /advance at each arrow.

    PROCUREMENT_OPEN  →  PRODUCTION_OPEN  →  SALES_OPEN  →  BACKROOM
          ↑ advance           ↑ advance         ↑ advance
    From BACKROOM the organiser calls /next (new cycle) or /end-game.
    """
    PROCUREMENT_OPEN = "procurement_open"
    PRODUCTION_OPEN  = "production_open"
    SALES_OPEN       = "sales_open"
    BACKROOM         = "backroom"
    GAME_OVER        = "game_over"


# ── Deals & events ────────────────────────────────────────────────────────────

class EventType(str, enum.Enum):
    """All types of entries that can live in the event_ledger table."""
    GOV_LOAN         = "gov_loan"
    INTER_TEAM_LOAN  = "inter_team_loan"
    RND_INVESTMENT   = "rnd_investment"
    GLOBAL_EVENT     = "global_event"
    BACKROOM_EFFECT  = "backroom_effect"


class EventStatus(str, enum.Enum):
    ACTIVE   = "active"
    RESOLVED = "resolved"


class GovDealType(str, enum.Enum):
    # Procurement
    RED_SUPPLY_SABOTAGE     = "red_supply_sabotage"
    RED_PRICE_INFLATION     = "red_price_inflation"
    GREEN_PRIORITY_SUPPLY   = "green_priority_supply"
    GREEN_SUBSIDISED_INPUTS = "green_subsidised_inputs"
    # Infrastructure
    RED_MACHINE_SABOTAGE    = "red_machine_sabotage"
    RED_INFRA_DELAY         = "red_infra_delay"
    GREEN_FAST_TRACK_INFRA  = "green_fast_track_infra"
    # Labour & R&D
    RED_LABOUR_STRIKE       = "red_labour_strike"
    RED_LABOUR_POACH        = "red_labour_poach"
    RED_RND_SABOTAGE        = "red_rnd_sabotage"
    GREEN_SKILLED_LABOUR    = "green_skilled_labour"
    GREEN_RESEARCH_GRANT    = "green_research_grant"
    # Sales & market
    RED_MARKET_LIMIT        = "red_market_limit"
    RED_DEMAND_SUPPRESSION  = "red_demand_suppression"
    RED_PRICE_PRESSURE      = "red_price_pressure"
    GREEN_DEMAND_BOOST      = "green_demand_boost"
    GREEN_GOV_PURCHASE      = "green_gov_purchase"
    # Legal
    RED_TARGETED_AUDIT      = "red_targeted_audit"
    RED_ARBITRARY_FINE      = "red_arbitrary_fine"
    GREEN_AUDIT_IMMUNITY    = "green_audit_immunity"
    GREEN_QUALITY_WAIVER    = "green_quality_waiver"
    GREEN_TAX_EVASION       = "green_tax_evasion"


class GovDealStatus(str, enum.Enum):
    PENDING    = "pending"
    APPLIED    = "applied"
    DISCOVERED = "discovered"
    CANCELLED  = "cancelled"