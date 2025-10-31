/**
 * useDataRefresh Hook
 * 
 * Provides a centralized way to refresh data across the app after mutations.
 * Combines optimistic updates (instant UI) with server refresh (accurate data).
 * 
 * Usage:
 * const { refreshAll, refreshPoints, refreshAchievements } = useDataRefresh();
 * 
 * After mutations:
 * await submitFeedback();
 * refreshAll(); // Triggers router.refresh() + real-time subscriptions
 */

'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';

export function useDataRefresh(studentId?: string) {
  const router = useRouter();
  const { 
    setTotalPoints, 
    setCurrentStreak, 
    setBadgesCount, 
    setAttendanceRate,
    setUnreadCount 
  } = useStore();

  /**
   * Refresh points from database
   */
  const refreshPoints = useCallback(async () => {
    if (!studentId) return;
    
    const { data } = await supabase
      .from('points')
      .select('points')
      .eq('student_id', studentId);
    
    const total = data?.reduce((sum, p) => sum + p.points, 0) || 0;
    setTotalPoints(total);
  }, [studentId, setTotalPoints]);

  /**
   * Refresh streak from database
   */
  const refreshStreak = useCallback(async () => {
    if (!studentId) return;
    
    const { data } = await supabase
      .from('streaks')
      .select('current_streak')
      .eq('student_id', studentId)
      .single();
    
    setCurrentStreak(data?.current_streak || 0);
  }, [studentId, setCurrentStreak]);

  /**
   * Refresh achievements count from database
   */
  const refreshAchievements = useCallback(async () => {
    if (!studentId) return;
    
    const { count } = await supabase
      .from('student_achievements')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('unlocked', true);
    
    setBadgesCount(count || 0);
  }, [studentId, setBadgesCount]);

  /**
   * Refresh attendance rate from database
   */
  const refreshAttendance = useCallback(async () => {
    if (!studentId) return;
    
    const { data } = await supabase
      .from('attendance')
      .select('status')
      .eq('student_id', studentId)
      .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    
    if (data && data.length > 0) {
      const present = data.filter(a => a.status === 'present').length;
      const rate = Math.round((present / data.length) * 100);
      setAttendanceRate(rate);
    }
  }, [studentId, setAttendanceRate]);

  /**
   * Refresh notifications count from database
   */
  const refreshNotifications = useCallback(async () => {
    if (!studentId) return;
    
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('read', false);
    
    setUnreadCount(count || 0);
  }, [studentId, setUnreadCount]);

  /**
   * Refresh all data (comprehensive)
   * Use after major mutations like feedback submission, achievement unlock
   */
  const refreshAll = useCallback(async () => {
    // Trigger server-side refresh for SSR pages
    router.refresh();
    
    // Also refresh client-side state
    if (studentId) {
      await Promise.all([
        refreshPoints(),
        refreshStreak(),
        refreshAchievements(),
        refreshAttendance(),
        refreshNotifications(),
      ]);
    }
  }, [router, studentId, refreshPoints, refreshStreak, refreshAchievements, refreshAttendance, refreshNotifications]);

  /**
   * Refresh gamification data only (points, streak, achievements)
   * Use after point-earning actions
   */
  const refreshGamification = useCallback(async () => {
    router.refresh();
    
    if (studentId) {
      await Promise.all([
        refreshPoints(),
        refreshStreak(),
        refreshAchievements(),
      ]);
    }
  }, [router, studentId, refreshPoints, refreshStreak, refreshAchievements]);

  return {
    refreshAll,
    refreshGamification,
    refreshPoints,
    refreshStreak,
    refreshAchievements,
    refreshAttendance,
    refreshNotifications,
  };
}
