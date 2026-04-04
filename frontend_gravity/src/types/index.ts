export type ComponentType =
  | 'airframe'
  | 'propulsion'
  | 'avionics'
  | 'fire_suppression'
  | 'sensing_safety'
  | 'battery';

// Procurement Phase
export interface Source {
  id: number;
  component: string;
  name: string;
  distance: number;
  quality_mean: number;
  quality_sigma: number;
  base_cost_per_unit: number;
  min_order: number;
  max_order: number;
}

export interface ProcurementDecision {
  source_id: number;
  quantity: number;
  transport: 'road' | 'rail' | 'air' | 'water';
}

export interface ProcurementMemoryOut {
  decisions: Record<string, ProcurementDecision>;
}

// Production Phase
export interface MachineData {
  id: number;
  tier: string;
  condition: number;
  is_active: boolean;
  throughput: number;
  base_grade: number;
  purchased_cycle?: number | null;
  source: string;
}

export interface ComponentSlotData {
  component: string;
  raw_stock_total: number;
  fin_stock_total: number;
  rnd_quality: number;
  rnd_consistency: number;
  rnd_yield: number;
  total_throughput: number;
  machine_count: number;
  machines: MachineData[];
  rnd_in_progress?: { focus: string; levels: number; arrives_cycle: number }[];
}

export interface ProductionDecision {
  maintenance: 'none' | 'basic' | 'full' | 'overhaul';
  units_to_produce: number | null;
  rnd_invest: { focus: string; levels: number } | null;
  buy_machine: { tier: 'basic' | 'standard' | 'industrial' | 'precision' } | null;
}

export interface ProductionMemoryOut {
  decisions: Record<string, ProductionDecision> & {
    wage_level?: 'below_market' | 'market' | 'above_market';
    target_headcount?: number;
    upgrade_automation?: 'manual' | 'semi_auto' | 'full_auto';
  };
}

// Sales Phase
export interface SalesDecision {
  action: 'sell_market' | 'sell_premium' | 'sell_discounted' | 'hold' | 'scrap' | 'black_market';
  price_override: number | null;
}

export interface SalesMemoryOut {
  units_to_assemble?: number | null;
  decisions: Record<string, SalesDecision>;
}

// Market Factions
export interface MarketFaction {
  id: number;
  name: string;
  tier_preference: string;
  price_ceiling: number;
  volume: number;
  flexibility: number;
  brand_min: number;
}

// Global & Auth
export interface InventoryOut {
  funds: number;
  brand_score: number;
  brand_tier: string;
  drone_stock_total: number;
  workforce_size: number;
  skill_level: number;
  morale: number;
  automation_level: string;
  has_gov_loan: boolean;
}

export interface FinancesData {
  funds: number;
  cumulative_profit: number;
  brand_score: number;
  brand_tier: string;
  has_gov_loan: boolean;
  active_loans: { interest_per_cycle: number; lender: string; cycle_id: number }[];
  total_interest_due_per_cycle: number;
}

export interface LeaderboardRow {
  rank: number;
  team_name: string;
  composite_score: number;
  closing_funds: number;
  cumulative_profit: number;
  brand_score: number;
  quality_avg: number;
  inventory_penalty: number;
}

export interface LeaderboardOut {
  cycle_number: number;
  is_final: boolean;
  rows: LeaderboardRow[];
}

export interface GameStatusOut {
  game_name: string;
  cycle_number: number;
  phase:
    | 'procurement_open'
    | 'production_open'
    | 'sales_open'
    | 'backroom'
    | 'game_over'
    | 'waiting_for_first_cycle'
    | 'no_active_game';
  game_active: boolean;
}
