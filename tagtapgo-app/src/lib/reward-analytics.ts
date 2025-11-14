/**
 * Reward Analytics Client
 * Tracks reward views for conversion rate analysis
 */

import { supabase } from './supabase';

export type ReferralSource = 'browse' | 'notification' | 'leaderboard' | 'achievement' | 'search';

/**
 * Track when a student views a reward
 * Call this when reward card is clicked or modal is opened
 */
export async function trackRewardView(
  studentId: string,
  rewardId: string,
  referralSource: ReferralSource = 'browse',
  sessionId?: string
): Promise<void> {
  try {
    // Non-blocking - don't await
    supabase
      .from('reward_views')
      .insert({
        student_id: studentId,
        reward_id: rewardId,
        referral_source: referralSource,
        session_id: sessionId,
      })
      .then(({ error }) => {
        if (error) {
          console.error('[Analytics] Failed to track reward view:', error);
        }
      });
  } catch (error) {
    console.error('[Analytics] Exception tracking reward view:', error);
  }
}

/**
 * Generate a session ID for tracking user behavior
 * Store in sessionStorage to persist across page reloads
 */
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  const SESSION_KEY = 'reward_session_id';
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  
  return sessionId;
}
