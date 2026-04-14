import { create } from 'zustand';
import type { ComponentType, ProductionDecision } from '../types';
import { teamApi } from '../api';

interface ProductionState {
  componentDecisions: Record<ComponentType, ProductionDecision>;
  wageLevel: 'below_market' | 'market' | 'above_market';
  targetHeadcount: number;
  upgradeAutomation: 'manual' | 'semi_auto' | 'full_auto';
  selectedComponent: ComponentType;
  initialState: {
    componentDecisions: Record<ComponentType, ProductionDecision>;
    wageLevel: 'below_market' | 'market' | 'above_market';
    targetHeadcount: number;
    upgradeAutomation: 'manual' | 'semi_auto' | 'full_auto';
  };

  setComponent: (c: ComponentType) => void;
  setMaintenance: (comp: ComponentType, level: 'none' | 'basic' | 'full' | 'overhaul') => void;
  setUnitsToProduce: (comp: ComponentType, units: number | null) => void;
  setRndInvest: (comp: ComponentType, focus: string, levels: number) => void;
  setBuyMachine: (comp: ComponentType, tier: 'basic' | 'standard' | 'industrial' | 'precision' | null) => void;
  clearRndInvest: (comp: ComponentType) => void;
  setWageLevel: (level: 'below_market' | 'market' | 'above_market') => void;
  setHeadcount: (count: number) => void;
  setAutomation: (level: 'manual' | 'semi_auto' | 'full_auto') => void;
  fetchExistingDecisions: () => Promise<void>;
  submitDecisions: () => Promise<void>;
}

const DEFAULT_COMP: ProductionDecision = { maintenance: 'none', units_to_produce: null, rnd_invest: null, buy_machine: null };

export const useProductionStore = create<ProductionState>((set, get) => ({
  componentDecisions: {
    airframe: { ...DEFAULT_COMP },
    propulsion: { ...DEFAULT_COMP },
    avionics: { ...DEFAULT_COMP },
    fire_suppression: { ...DEFAULT_COMP },
    sensing_safety: { ...DEFAULT_COMP },
    battery: { ...DEFAULT_COMP },
  },
  wageLevel: 'market',
  targetHeadcount: 0,
  upgradeAutomation: 'manual',
  selectedComponent: 'airframe',
  initialState: {
    componentDecisions: {
      airframe: { ...DEFAULT_COMP },
      propulsion: { ...DEFAULT_COMP },
      avionics: { ...DEFAULT_COMP },
      fire_suppression: { ...DEFAULT_COMP },
      sensing_safety: { ...DEFAULT_COMP },
      battery: { ...DEFAULT_COMP },
    },
    wageLevel: 'market',
    targetHeadcount: 0,
    upgradeAutomation: 'manual',
  },

  setComponent: (c) => set({ selectedComponent: c }),

  setMaintenance: (comp, level) => set((s) => ({
    componentDecisions: { ...s.componentDecisions, [comp]: { ...s.componentDecisions[comp], maintenance: level } }
  })),

  setUnitsToProduce: (comp, units) => set((s) => ({
    componentDecisions: { ...s.componentDecisions, [comp]: { ...s.componentDecisions[comp], units_to_produce: units } }
  })),

  setRndInvest: (comp, focus, levels) => set((s) => ({
    componentDecisions: { ...s.componentDecisions, [comp]: { ...s.componentDecisions[comp], rnd_invest: { focus, levels } } }
  })),

  setBuyMachine: (comp, tier) => set((s) => ({
    componentDecisions: { ...s.componentDecisions, [comp]: { ...s.componentDecisions[comp], buy_machine: tier ? { tier } : null } }
  })),

  clearRndInvest: (comp) => set((s) => ({
    componentDecisions: { ...s.componentDecisions, [comp]: { ...s.componentDecisions[comp], rnd_invest: null } }
  })),

  setWageLevel: (l) => set({ wageLevel: l }),
  setHeadcount: (c) => set({ targetHeadcount: c }),
  setAutomation: (l) => set({ upgradeAutomation: l }),

  fetchExistingDecisions: async () => {
    try {
      const data = await teamApi.getProduction();
      if (data && data.decisions) {
        const dec = data.decisions;
        const nextComp = { ...get().componentDecisions };
        const components: ComponentType[] = ['airframe', 'propulsion', 'avionics', 'fire_suppression', 'sensing_safety', 'battery'];
        
        components.forEach((comp) => {
          if (dec[comp]) {
            nextComp[comp] = { ...nextComp[comp], ...dec[comp] };
          }
        });

        const nextWage = dec.wage_level || 'market';
        const nextHead = dec.target_headcount || 0;
        const nextAuto = dec.upgrade_automation || 'manual';

        set({
          componentDecisions: nextComp,
          wageLevel: nextWage as any,
          targetHeadcount: nextHead as any,
          upgradeAutomation: nextAuto as any,
          initialState: {
            componentDecisions: nextComp,
            wageLevel: nextWage as any,
            targetHeadcount: nextHead as any,
            upgradeAutomation: nextAuto as any,
          },
        });
      }
    } catch (err) {
      console.error("No existing production decisions found", err);
    }
  },

  submitDecisions: async () => {
    const { componentDecisions, wageLevel, targetHeadcount, upgradeAutomation, initialState } = get();
    const payload: any = {};
    const changedComponents: Record<string, any> = {};
    
    (Object.keys(componentDecisions) as ComponentType[]).forEach((comp) => {
      if (JSON.stringify(componentDecisions[comp]) !== JSON.stringify(initialState.componentDecisions[comp])) {
        changedComponents[comp] = componentDecisions[comp];
      }
    });

    if (Object.keys(changedComponents).length > 0) payload.component_decisions = changedComponents;
    if (wageLevel !== initialState.wageLevel) payload.wage_level = wageLevel;
    if (targetHeadcount !== initialState.targetHeadcount) payload.target_headcount = targetHeadcount;
    if (upgradeAutomation !== initialState.upgradeAutomation) payload.upgrade_automation = upgradeAutomation;
    
    if (Object.keys(payload).length === 0) return;
    
    await teamApi.patchProduction(payload);
    
    set({
      initialState: {
        componentDecisions: { ...componentDecisions },
        wageLevel,
        targetHeadcount,
        upgradeAutomation,
      },
    });
  },
}));
