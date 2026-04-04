import { create } from 'zustand';
import type { ComponentType, Source, ProcurementDecision } from '../types';
import { teamApi } from '../api';

const DEFAULT_DECISION: ProcurementDecision = {
  source_id: 1,
  quantity: 0,
  transport: 'road',
};

interface ProcurementState {
  decisions: Record<ComponentType, ProcurementDecision>;
  initialDecisions: Record<ComponentType, ProcurementDecision>;
  sources: Source[];
  sourcesByComponent: Record<string, Source[]>;
  selectedComponent: ComponentType;

  setComponent: (c: ComponentType) => void;
  setDecision: (component: ComponentType, field: keyof ProcurementDecision, value: any) => void;
  fetchSources: () => Promise<void>;
  fetchExistingDecisions: () => Promise<void>;
  submitDecisions: () => Promise<void>;
}

export const useProcurementStore = create<ProcurementState>((set, get) => ({
  decisions: {
    airframe: { ...DEFAULT_DECISION },
    propulsion: { ...DEFAULT_DECISION },
    avionics: { ...DEFAULT_DECISION },
    fire_suppression: { ...DEFAULT_DECISION },
    sensing_safety: { ...DEFAULT_DECISION },
    battery: { ...DEFAULT_DECISION },
  },
  initialDecisions: {
    airframe: { ...DEFAULT_DECISION },
    propulsion: { ...DEFAULT_DECISION },
    avionics: { ...DEFAULT_DECISION },
    fire_suppression: { ...DEFAULT_DECISION },
    sensing_safety: { ...DEFAULT_DECISION },
    battery: { ...DEFAULT_DECISION },
  },
  sources: [],
  sourcesByComponent: {},
  selectedComponent: 'airframe',

  setComponent: (c) => set({ selectedComponent: c }),

  setDecision: (component, field, value) => set((state) => ({
    decisions: {
      ...state.decisions,
      [component]: {
        ...state.decisions[component],
        [field]: value,
      },
    },
  })),

  fetchSources: async () => {
    try {
      const sources = await teamApi.getSources();
      const grouped: Record<string, Source[]> = {};
      sources.forEach(src => {
        if (!grouped[src.component]) {
          grouped[src.component] = [];
        }
        grouped[src.component].push(src);
      });
      set({ sources, sourcesByComponent: grouped });
    } catch (err) {
      console.error("Failed to load sources", err);
    }
  },

  fetchExistingDecisions: async () => {
    try {
      const data = await teamApi.getProcurement();
      if (data && data.decisions) {
        if (Object.keys(data.decisions).length > 0) {
          const merged = { ...get().decisions };
          (Object.keys(data.decisions) as ComponentType[]).forEach(comp => {
            if (data.decisions[comp]) {
              merged[comp] = { ...merged[comp], ...data.decisions[comp] };
            }
          });
          set({ decisions: merged, initialDecisions: merged });
        }
      }
    } catch (err) {
      console.error("No existing procurement decisions found", err);
    }
  },

  submitDecisions: async () => {
    const { decisions, initialDecisions } = get();
    const changed: Record<string, any> = {};
    (Object.keys(decisions) as ComponentType[]).forEach((comp) => {
      const next = decisions[comp];
      const prev = initialDecisions[comp];
      if (JSON.stringify(next) !== JSON.stringify(prev)) {
        changed[comp] = next;
      }
    });
    if (Object.keys(changed).length === 0) return;
    await teamApi.patchProcurement(changed);
    set({ initialDecisions: JSON.parse(JSON.stringify(decisions)) });
  },
}));
