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

  // Gamification State (synced across components)
  totalPoints: number;
  setTotalPoints: (points: number) => void;
  
  currentStreak: number;
  setCurrentStreak: (streak: number) => void;
  
  badgesCount: number;
  setBadgesCount: (count: number) => void;
  
  attendanceRate: number;
  setAttendanceRate: (rate: number) => void;

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

      // Gamification State
      totalPoints: 0,
      setTotalPoints: (points) => set({ totalPoints: points }),
      
      currentStreak: 0,
      setCurrentStreak: (streak) => set({ currentStreak: streak }),
      
      badgesCount: 0,
      setBadgesCount: (count) => set({ badgesCount: count }),
      
      attendanceRate: 0,
      setAttendanceRate: (rate) => set({ attendanceRate: rate }),

      // Reset
      reset: () =>
        set({
          isLoading: false,
          unreadCount: 0,
          totalPoints: 0,
          currentStreak: 0,
          badgesCount: 0,
          attendanceRate: 0,
        }),
    }),
    {
      name: 'tagtapgo-storage',
      // Only persist UI preferences, not volatile gamification data
      // Gamification data is initialized from SSR on mount to prevent stale flashes
      partialize: (state) => ({
        unreadCount: state.unreadCount,
        // Removed: totalPoints, currentStreak, badgesCount, attendanceRate
        // These are now sourced from SSR and real-time updates only
      }),
    }
  )
);
