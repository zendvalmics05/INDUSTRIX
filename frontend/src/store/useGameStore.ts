import { create } from 'zustand'
import api from '../api/api'
import { useAuthStore } from './authStore'

type TransportMode = 'air' | 'rail' | 'road'

interface ProcurementItem {
  source_id: number | null
  quantity: number
  transport_mode: TransportMode
}

interface Source {
  id: number
  name: string
  component: string
  quality_mean: number
  quality_sigma: number
  base_cost_per_unit: number
  lat?: number
  lon?: number
}

interface GameState {
  // Core
  funds: number
  selectedComponent: string

  // Data
  sources: Source[]
  procurement: Record<string, ProcurementItem>

  // UI state
  selectedSource: Source | null

  // Actions
  setSources: (sources: Source[]) => void
  setSelectedComponent: (component: string) => void
  selectSource: (source: Source) => void
  updateProcurement: (component: string, data: Partial<ProcurementItem>) => void

  // API Actions
  fetchSources: () => Promise<void>
  submitProcurement: (component: string) => Promise<void>
  fetchCostEstimate: () => Promise<void>
  provisionResources: (resources: {minerals: number, chemicals: number, power: number}) => Promise<void>

  // Derived
  totalCost: number
}

export const useGameStore = create<GameState>((set, get) => ({
  funds: 100000,
  selectedComponent: 'airframe',

  sources: [],
  procurement: {},

  selectedSource: null,

  // ---------- Basic setters ----------
  setSources: (sources) => set({ sources }),

  setSelectedComponent: (component) =>
    set({ selectedComponent: component }),

  selectSource: (source) =>
    set({ selectedSource: source }),

  updateProcurement: (component, data) =>
    set((state) => ({
      procurement: {
        ...state.procurement,
        [component]: {
          ...state.procurement[component],
          ...data,
        },
      },
    })),

  // ---------- API CALLS ----------

  fetchSources: async () => {
    const team = useAuthStore.getState().team
    if (!team) return

    try {
      const res = await api.get(`/games/${team.game_id}/sources`)
      set({ sources: res.data })
    } catch (err) {
      console.error('fetchSources error:', err)
    }
  },

  submitProcurement: async (component: string) => {
    const team = useAuthStore.getState().team
    if (!team) return

    const { procurement } = get()
    const data = procurement[component]
    if (!data) return

    try {
      await api.patch(
        `/teams/${team.id}/procurement/${component}`,
        data
      )
    } catch (err) {
      console.error('submitProcurement error:', err)
    }
  },

  fetchCostEstimate: async () => {
    const team = useAuthStore.getState().team
    if (!team) return

    try {
      const res = await api.get(
        `/teams/${team.id}/procurement/cost-estimate`
      )

      set({ totalCost: res.data.total_cost })
    } catch (err) {
      console.error('fetchCostEstimate error:', err)
    }
  },

  provisionResources: async (resources) => {
    try {
      const res = await api.post('/team/procurement/provision', resources)
      // Update team in auth store with new values
      const setAuth = useAuthStore.getState().setAuth
      const token = useAuthStore.getState().token
      const currentTeam = useAuthStore.getState().team
      if (token && currentTeam) {
        setAuth(token, {
          ...currentTeam,
          minerals: res.data.minerals,
          chemicals: res.data.chemicals,
          power: res.data.power,
          cash: res.data.funds_left,
        })
      }
    } catch (err) {
      console.error('provisionResources error:', err)
      throw err
    }
  },

  // ---------- Derived ----------
  totalCost: 0,
}))