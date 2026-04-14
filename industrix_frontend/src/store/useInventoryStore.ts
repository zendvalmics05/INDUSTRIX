import { create } from 'zustand';
import { teamApi } from '../api';
import type { ComponentSlotData } from '../types';

export interface FundsLedgerEntry {
  id: number;
  timestamp: string;
  delta: number;
  balance: number;
  type: string;
  description: string;
  cycle: number;
}

interface InventoryState {
  funds: number;
  brandScore: number;
  brandTier: string;
  droneStockTotal: number;
  droneStock: number[];
  components: ComponentSlotData[];
  workforceSize: number;
  skillLevel: number;
  morale: number;
  automationLevel: string;
  hasGovLoan: boolean;

  fundsLedger: FundsLedgerEntry[];

  fetchInventory: () => Promise<void>;
  scrapRejectUnits: () => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  funds: 0,
  brandScore: 0,
  brandTier: 'fair',
  droneStockTotal: 0,
  droneStock: Array(101).fill(0),
  components: [],
  workforceSize: 0,
  skillLevel: 0,
  morale: 0,
  automationLevel: 'manual',
  hasGovLoan: false,

  fundsLedger: [],

  fetchInventory: async () => {
    try {
      const [meData, componentsData] = await Promise.all([
        teamApi.me(),
        teamApi.getComponents()
      ]);

      if (meData) {
        // Map backend transactions to ledger entries
        const ledger: FundsLedgerEntry[] = (meData.transactions || []).map((t: any) => ({
          id: t.id,
          timestamp: new Date(t.created_at).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          delta: t.delta,
          balance: t.balance,
          type: t.type,
          description: t.description || '',
          cycle: t.cycle_number
        }));

        set({
          funds: meData.funds || 0,
          brandScore: meData.brand_score || 0,
          brandTier: meData.brand_tier || 'fair',
          droneStockTotal: meData.drone_stock_total || 0,
          droneStock: meData.drone_stock || Array(101).fill(0),
          workforceSize: meData.workforce_size || 0,
          skillLevel: meData.skill_level || 0,
          morale: meData.morale || 0,
          automationLevel: meData.automation_level || 'manual',
          hasGovLoan: !!meData.has_gov_loan,
          fundsLedger: ledger,
        });
      }

      if (componentsData) {
        set({ 
          components: componentsData.components || [],
          droneStock: componentsData.drone_stock || Array(101).fill(0),
          droneStockTotal: componentsData.drone_stock_total || 0,
        });
      }
    } catch (err) {
      console.error("Failed to load inventory", err);
    }
  },

  scrapRejectUnits: async () => {
    try {
      await teamApi.patchSales({
        decisions: {
          reject: { action: 'scrap' }
        }
      });
    } catch (err) {
      console.error("Failed to scrap rejects", err);
    }
  },
}));
