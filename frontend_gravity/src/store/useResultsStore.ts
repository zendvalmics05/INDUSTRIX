import { create } from 'zustand';
import type { LeaderboardRow } from '../types';
import { teamApi } from '../api';

interface ResultsState {
  cycleNumber: number;
  isFinal: boolean;
  rows: LeaderboardRow[];
  awards: any[];
  
  fetchLeaderboard: () => Promise<void>;
}

export const useResultsStore = create<ResultsState>((set) => ({
  cycleNumber: 0,
  isFinal: false,
  rows: [],
  awards: [],

  fetchLeaderboard: async () => {
    try {
      const data = await teamApi.getLeaderboard();
      if (data) {
        set({
          cycleNumber: data.cycle_number || 0,
          isFinal: data.is_final || false,
          rows: data.rows || [],
          awards: data.awards || [],
        });
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard", err);
    }
  },
}));
