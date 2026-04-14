import { create } from 'zustand';
import { teamApi } from '../api';
import type {
  ProcurementSummary,
  ProductionSummary,
  SalesSummary,
  NotificationOut,
  BackroomStatusOut
} from '../types';

interface EventsState {
  procurement: ProcurementSummary | null;
  production: ProductionSummary | null;
  sales: SalesSummary | null;
  notifications: NotificationOut[];
  news: any[];
  viewedNotificationIds: string[];
  backroomStatus: BackroomStatusOut | null;

  loadingProcurement: boolean;
  loadingProduction: boolean;
  loadingSales: boolean;
  loadingNotifications: boolean;
  loadingNews: boolean;

  fetchAll: (phase: string) => Promise<void>;
  fetchNotifications: () => Promise<void>;
  fetchNews: () => Promise<void>;
  fetchBackroomStatus: () => Promise<void>;
  buyIntel: () => Promise<void>;
  markNotificationsAsViewed: (ids: string[]) => void;
  getUnreadCount: () => number;
}

export const useEventsStore = create<EventsState>((set, get) => {
  const savedViewedIds = localStorage.getItem('industrix-viewed-notifications');
  let initialViewedIds: string[] = [];
  if (savedViewedIds) {
    try { initialViewedIds = JSON.parse(savedViewedIds); } catch { }
  }

  return {
    procurement: null,
    production: null,
    sales: null,
    notifications: [],
    news: [],
    viewedNotificationIds: initialViewedIds,
    backroomStatus: null,

    loadingProcurement: false,
    loadingProduction: false,
    loadingSales: false,
    loadingNotifications: false,
    loadingNews: false,

    fetchNotifications: async () => {
      set({ loadingNotifications: true });
      try {
        const data = await teamApi.getNotifications();
        set({ notifications: data });
      } catch (err) {
        console.error("Failed to fetch notifications", err);
      } finally {
        set({ loadingNotifications: false });
      }
    },

    fetchNews: async (silent: boolean = false) => {
      if (!silent) set({ loadingNews: true });
      try {
        const data = await teamApi.getNews();
        set({ news: data });
      } catch (err) {
        console.error("Failed to fetch news", err);
      } finally {
        if (!silent) set({ loadingNews: false });
      }
    },

    fetchBackroomStatus: async () => {
      try {
        const data = await teamApi.getBackroomStatus();
        set({ backroomStatus: data });
      } catch (err) {
        console.error("Failed to fetch backroom status", err);
      }
    },

    buyIntel: async () => {
      await teamApi.buyIntel();
      await get().fetchBackroomStatus();
    },

    fetchAll: async (phase: string) => {
      const canSeeProcurement = ['production_open', 'sales_open', 'backroom', 'game_over'].includes(phase);
      const canSeeProduction = ['sales_open', 'backroom', 'game_over'].includes(phase);
      const canSeeSales = ['backroom', 'game_over'].includes(phase);

      // Notifications and news are always visible if logged in
      get().fetchNotifications();
      get().fetchNews();

      if (phase === 'backroom') {
        get().fetchBackroomStatus();
      }

      if (canSeeProcurement) {
        set({ loadingProcurement: true });
        try {
          const data = await teamApi.getProcurementSummary();
          set({ procurement: data as ProcurementSummary });
        } catch {
          set({ procurement: null });
        } finally {
          set({ loadingProcurement: false });
        }
      }

      if (canSeeProduction) {
        set({ loadingProduction: true });
        try {
          const data = await teamApi.getProductionSummary();
          set({ production: data as ProductionSummary });
        } catch {
          set({ production: null });
        } finally {
          set({ loadingProduction: false });
        }
      }

      if (canSeeSales) {
        set({ loadingSales: true });
        try {
          const data = await teamApi.getSalesSummary();
          set({ sales: data as SalesSummary });
        } catch {
          set({ sales: null });
        } finally {
          set({ loadingSales: false });
        }
      }
    },

    markNotificationsAsViewed: (ids: string[]) => {
      set((state) => {
        const newIds = Array.from(new Set([...state.viewedNotificationIds, ...ids]));
        localStorage.setItem('industrix-viewed-notifications', JSON.stringify(newIds));
        return { viewedNotificationIds: newIds };
      });
    },

    getUnreadCount: () => {
      const { notifications, viewedNotificationIds } = get();
      return notifications.filter(n => !viewedNotificationIds.includes(n.id)).length;
    }
  };
});
