import { create } from 'zustand';
import { teamApi } from '../api';
import type { ComponentSlotData } from '../types';

interface InventoryState {
  funds: number;
  brandScore: number;
  brandTier: string;
  droneStockTotal: number;
  droneBreakdown: {
    reject: number;
    substandard: number;
    standard: number;
    premium: number;
  };
  rawMaterialStocks: Record<string, number>;
  components: ComponentSlotData[];
  workforceSize: number;
  skillLevel: number;
  morale: number;
  automationLevel: string;
  hasGovLoan: boolean;

  fetchInventory: () => Promise<void>;
  scrapRejectUnits: () => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set) => ({
  funds: 0,
  brandScore: 0,
  brandTier: 'fair',
  droneStockTotal: 0,
  droneBreakdown: { reject: 0, substandard: 0, standard: 0, premium: 0 },
  rawMaterialStocks: {
    airframe: 0, propulsion: 0, avionics: 0, fire_suppression: 0, sensing_safety: 0, battery: 0
  },
  components: [],
  workforceSize: 0,
  skillLevel: 0,
  morale: 0,
  automationLevel: 'manual',
  hasGovLoan: false,

  fetchInventory: async () => {
    try {
      const [meData, componentsData] = await Promise.all([
        teamApi.me(),
        teamApi.getComponents()
      ]);

      if (meData) {
        set({
          funds: meData.funds || 0,
          brandScore: meData.brand_score || 0,
          brandTier: meData.brand_tier || 'fair',
          droneStockTotal: meData.drone_stock_total || 0,
          droneBreakdown: { reject: 0, substandard: 0, standard: meData.drone_stock_total || 0, premium: 0 },
          workforceSize: meData.workforce_size || 0,
          skillLevel: meData.skill_level || 0,
          morale: meData.morale || 0,
          automationLevel: meData.automation_level || 'manual',
          hasGovLoan: !!meData.has_gov_loan,
        });
      }

      if (componentsData && componentsData.components) {
        const rawStocks: Record<string, number> = {};
        componentsData.components.forEach(comp => {
          rawStocks[comp.component] = comp.raw_stock_total;
        });

        set({
          components: componentsData.components,
          rawMaterialStocks: rawStocks,
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
      // Optionally trigger re-fetch of inventory
    } catch (err) {
      console.error("Failed to scrap rejects", err);
    }
  },
}));
