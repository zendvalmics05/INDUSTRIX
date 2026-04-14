import { create } from 'zustand';
import { teamApi } from '../api';

interface GameState {
  teamId: number | null;
  teamName: string;
  pin: string;
  isLoggedIn: boolean;

  gameName: string;
  cycleNumber: number;
  phase: string;
  gameActive: boolean;
  phaseOpenedAt: number | null;
  phaseDuration: number | null;

  // Sync indicator support
  lastSyncTs: number | null;
  connectionOk: boolean;

  login: (teamId: number, pin: string) => Promise<void>;
  logout: () => void;
  pollStatus: () => Promise<void>;
  
  lastBriefedCycle: number;
  setLastBriefedCycle: (cycle: number) => void;
}

export const useGameStore = create<GameState>((set) => {
  // Try to load auth from localStorage
  const saved = localStorage.getItem('industrix-auth');
  const savedBriefing = localStorage.getItem('industrix-last-briefed-cycle');
  
  let initial = { teamId: null, teamName: '', pin: '', isLoggedIn: false, lastBriefedCycle: 0 };
  if (saved) {
    try {
      const auth = JSON.parse(saved).state;
      initial = { ...initial, ...auth };
    } catch {}
  }
  if (savedBriefing) {
    initial.lastBriefedCycle = parseInt(savedBriefing, 10) || 0;
  }

  return {
    ...initial,
    gameName: '',
    cycleNumber: 0,
    phase: '',
    gameActive: false,
    phaseOpenedAt: null,
    phaseDuration: null,
    lastSyncTs: null,
    connectionOk: true,

    login: async (teamId: number, pin: string) => {
      const res = await teamApi.login(teamId, pin);
      const newState = {
        teamId,
        teamName: res.team_name || `Team ${teamId}`,
        pin,
        isLoggedIn: true,
      };
      set(newState);
      localStorage.setItem('industrix-auth', JSON.stringify({ state: newState }));
    },

    logout: () => {
      localStorage.removeItem('industrix-auth');
      set({ teamId: null, teamName: '', pin: '', isLoggedIn: false });
      // Navigation will be handled by the useEffect in SharedLayout
    },

    pollStatus: async () => {
      try {
        const status = await teamApi.status();
        set({
          gameName: status.game_name,
          cycleNumber: status.cycle_number,
          phase: status.phase,
          gameActive: status.game_active,
          phaseOpenedAt: status.phase_opened_at || null,
          phaseDuration: status.phase_duration || null,
          lastSyncTs: Date.now(),
          connectionOk: true,
        });
      } catch (err) {
        console.error("Failed to poll status", err);
        set({ connectionOk: false });
      }
    },

    setLastBriefedCycle: (cycle: number) => {
      set({ lastBriefedCycle: cycle });
      localStorage.setItem('industrix-last-briefed-cycle', cycle.toString());
    }
  };
});