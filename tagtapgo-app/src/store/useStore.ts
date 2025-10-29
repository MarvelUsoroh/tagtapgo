/**
 * Zustand Store - UI State Only
 * Auth data is now handled by Server Components
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  // UI State
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Notifications
  unreadCount: number;
  setUnreadCount: (count: number) => void;

  // Reset
  reset: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // UI State
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),

      // Notifications
      unreadCount: 0,
      setUnreadCount: (count) => set({ unreadCount: count }),

      // Reset
      reset: () =>
        set({
          isLoading: false,
          unreadCount: 0,
        }),
    }),
    {
      name: 'tagtapgo-storage',
      // Only persist UI state, not auth data
      partialize: (state) => ({
        unreadCount: state.unreadCount,
      }),
    }
  )
);
