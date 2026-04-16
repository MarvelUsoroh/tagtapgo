/**
 * Notification Sender Service
 * 
 * Sends push notifications via the send-push-notification Edge Function.
 * Handles all notification types for the gamification system.
 * 
 * Notification Types:
 * - achievement: Achievement unlocked
 * - streak: Streak at risk
 * - challenge: Challenge invitation
 * - rank: Rank change
 * - reward: Reward redemption
 * - points_milestone: Points milestone reached
 * 
 * Requirements: 15
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface NotificationPayload {
  studentId: string;
  title: string;
  body: string;
  data: {
    type: string;
    [key: string]: any;
  };
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
}

export interface NotificationResult {
  success: boolean;
  error?: string;
}

/**
 * Send push notification via Edge Function
 * 
 * @param supabaseUrl - Supabase project URL
 * @param serviceRoleKey - Service role key for authentication
 * @param payload - Notification payload
 * @returns Result of notification send
 */
export async function sendPushNotification(
  supabaseUrl: string,
  serviceRoleKey: string,
  payload: NotificationPayload
): Promise<NotificationResult> {
  try {
    const functionUrl = `${supabaseUrl}/functions/v1/send-push-notification`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Notification Sender] Failed to send notification:', errorText);
      return {
        success: false,
        error: errorText,
      };
    }
    
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Notification Sender] Error sending notification:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send achievement unlocked notification
 */
export async function sendAchievementNotification(
  supabaseUrl: string,
  serviceRoleKey: string,
  studentId: string,
  achievementName: string,
  achievementDescription: string,
  pointsEarned: number,
  rarity: string
): Promise<NotificationResult> {
  return sendPushNotification(supabaseUrl, serviceRoleKey, {
    studentId,
    title: '🏆 Achievement Unlocked!',
    body: `You earned "${achievementName}" and ${pointsEarned} points!`,
    data: {
      type: 'achievement',
      achievementName,
      achievementDescription,
      pointsEarned,
      rarity,
      trigger_confetti: true,
    },
    tag: `achievement-${achievementName}`,
    requireInteraction: false,
  });
}

/**
 * Send streak at risk notification
 */
export async function sendStreakRiskNotification(
  supabaseUrl: string,
  serviceRoleKey: string,
  studentId: string,
  currentStreak: number,
  className: string,
  classTime: string
): Promise<NotificationResult> {
  return sendPushNotification(supabaseUrl, serviceRoleKey, {
    studentId,
    title: '🔥 Streak at Risk!',
    body: `Don't break your ${currentStreak}-day streak! ${className} starts at ${classTime}.`,
    data: {
      type: 'streak',
      currentStreak,
      className,
      classTime,
    },
    tag: `streak-risk-${studentId}`,
    requireInteraction: true,
  });
}

/**
 * Send rank change notification
 */
export async function sendRankChangeNotification(
  supabaseUrl: string,
  serviceRoleKey: string,
  studentId: string,
  oldRank: number,
  newRank: number,
  leaderboardType: string,
  isImprovement: boolean
): Promise<NotificationResult> {
  const direction = isImprovement ? 'up' : 'down';
  const emoji = isImprovement ? '📈' : '📉';
  
  return sendPushNotification(supabaseUrl, serviceRoleKey, {
    studentId,
    title: `${emoji} Rank Update!`,
    body: `You moved ${direction} to #${newRank} on the ${leaderboardType} leaderboard!`,
    data: {
      type: 'rank',
      oldRank,
      newRank,
      leaderboardType,
      isImprovement,
    },
    tag: `rank-${leaderboardType}`,
    requireInteraction: false,
  });
}

/**
 * Send reward redemption notification
 */
export async function sendRewardRedemptionNotification(
  supabaseUrl: string,
  serviceRoleKey: string,
  studentId: string,
  rewardName: string,
  redemptionCode: string,
  expiresAt: string
): Promise<NotificationResult> {
  return sendPushNotification(supabaseUrl, serviceRoleKey, {
    studentId,
    title: '🎁 Reward Redeemed!',
    body: `Your ${rewardName} is ready! Code: ${redemptionCode}`,
    data: {
      type: 'reward',
      rewardName,
      redemptionCode,
      expiresAt,
    },
    tag: `reward-${redemptionCode}`,
    requireInteraction: true,
  });
}

/**
 * Send challenge invitation notification
 */
export async function sendChallengeInvitationNotification(
  supabaseUrl: string,
  serviceRoleKey: string,
  studentId: string,
  challengeName: string,
  inviterName: string,
  challengeId: string
): Promise<NotificationResult> {
  return sendPushNotification(supabaseUrl, serviceRoleKey, {
    studentId,
    title: '⚡ Challenge Invitation!',
    body: `${inviterName} challenged you to "${challengeName}"!`,
    data: {
      type: 'challenge',
      challengeName,
      inviterName,
      challengeId,
    },
    tag: `challenge-${challengeId}`,
    requireInteraction: true,
  });
}

/**
 * Send points milestone notification
 */
export async function sendPointsMilestoneNotification(
  supabaseUrl: string,
  serviceRoleKey: string,
  studentId: string,
  milestone: number,
  totalPoints: number
): Promise<NotificationResult> {
  return sendPushNotification(supabaseUrl, serviceRoleKey, {
    studentId,
    title: '🎉 Milestone Reached!',
    body: `Congratulations! You've earned ${milestone} points!`,
    data: {
      type: 'points_milestone',
      milestone,
      totalPoints,
    },
    tag: `milestone-${milestone}`,
    requireInteraction: false,
  });
}

/**
 * Send perfect week bonus notification
 */
export async function sendPerfectWeekNotification(
  supabaseUrl: string,
  serviceRoleKey: string,
  studentId: string,
  bonusPoints: number
): Promise<NotificationResult> {
  return sendPushNotification(supabaseUrl, serviceRoleKey, {
    studentId,
    title: '🌟 Perfect Week!',
    body: `Amazing! You attended all 5 days this week. +${bonusPoints} bonus points!`,
    data: {
      type: 'perfect_week',
      bonusPoints,
    },
    tag: 'perfect-week',
    requireInteraction: false,
  });
}

/**
 * Send perfect month bonus notification
 */
export async function sendPerfectMonthNotification(
  supabaseUrl: string,
  serviceRoleKey: string,
  studentId: string,
  bonusPoints: number
): Promise<NotificationResult> {
  return sendPushNotification(supabaseUrl, serviceRoleKey, {
    studentId,
    title: '🏅 Perfect Month!',
    body: `Incredible! You attended 20+ days this month. +${bonusPoints} bonus points!`,
    data: {
      type: 'perfect_month',
      bonusPoints,
    },
    tag: 'perfect-month',
    requireInteraction: false,
  });
}

/**
 * Send chat reply notification
 */
export async function sendChatReplyNotification(
  supabaseUrl: string,
  serviceRoleKey: string,
  studentId: string,
  replierName: string,
  messageText: string,
  messageId: string
): Promise<NotificationResult> {
  return sendPushNotification(supabaseUrl, serviceRoleKey, {
    studentId,
    title: '💬 New Reply',
    body: `${replierName} replied: ${messageText}`,
    data: {
      type: 'chat_reply',
      messageId,
    },
    tag: `chat-reply-${messageId}`,
    requireInteraction: false,
  });
}

/**
 * Send chat mention notification
 */
export async function sendChatMentionNotification(
  supabaseUrl: string,
  serviceRoleKey: string,
  studentId: string,
  mentionerName: string,
  messageText: string,
  messageId: string
): Promise<NotificationResult> {
  return sendPushNotification(supabaseUrl, serviceRoleKey, {
    studentId,
    title: '🔔 New Mention',
    body: `${mentionerName} mentioned you: ${messageText}`,
    data: {
      type: 'chat_mention',
      messageId,
    },
    tag: `chat-mention-${messageId}`,
    requireInteraction: false,
  });
}

/**
 * Send chat reaction notification
 */
export async function sendChatReactionNotification(
  supabaseUrl: string,
  serviceRoleKey: string,
  studentId: string,
  reactorName: string,
  emoji: string,
  messageId: string
): Promise<NotificationResult> {
  return sendPushNotification(supabaseUrl, serviceRoleKey, {
    studentId,
    title: '👍 New Reaction',
    body: `${reactorName} reacted with ${emoji} to your message`,
    data: {
      type: 'chat_reaction',
      messageId,
    },
    tag: `chat-reaction-${messageId}`,
    requireInteraction: false,
  });
}
