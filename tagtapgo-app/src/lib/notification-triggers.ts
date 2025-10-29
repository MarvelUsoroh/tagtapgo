/**
 * Server-side notification triggers
 * These call the Supabase Edge Function to send push notifications
 */
import { supabase } from "./supabase";

interface NotificationResponse {
  success?: boolean;
  message?: string;
  error?: string;
}

/**
 * Send notification via Edge Function
 */
async function sendNotification(
  studentId: string,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<NotificationResponse> {
  try {
    // Get current session and access token
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error(
        "Not authenticated. Please sign in to send notifications."
      );
    }

    // Use direct fetch because @supabase/ssr's functions.invoke() doesn't properly
    // handle custom Authorization headers
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const functionUrl = `${supabaseUrl}/functions/v1/send-push-notification`;



    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({
        studentId,
        title,
        body,
        data,
      }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      console.error("Edge Function error:", response.status, errorData);
      throw new Error(
        errorData.error || `Edge Function returned ${response.status}`
      );
    }

    const result = await response.json();
    return result as NotificationResponse;
  } catch (error) {
    console.error("Failed to send notification:", error);
    throw error;
  }
}

/**
 * Trigger achievement unlocked notification
 */
export async function triggerAchievementNotification(
  studentId: string,
  achievementName: string,
  achievementDescription: string,
  pointsEarned: number,
  rarity?: string
): Promise<NotificationResponse> {
  return sendNotification(
    studentId,
    "🏆 Achievement Unlocked!",
    `You earned "${achievementName}" and ${pointsEarned} points!`,
    {
      type: "achievement",
      achievementName,
      achievementDescription,
      pointsEarned,
      rarity: rarity || "common",
      trigger_confetti: true,
    }
  );
}

/**
 * Trigger streak risk notification
 */
export async function triggerStreakRiskNotification(
  studentId: string,
  currentStreak: number,
  className: string,
  classTime: string
): Promise<NotificationResponse> {
  return sendNotification(
    studentId,
    "Streak at Risk! 🔥",
    `Don't break your ${currentStreak}-day streak! ${className} starts at ${classTime}.`,
    {
      type: "streak",
      currentStreak,
      className,
      classTime,
    }
  );
}

/**
 * Trigger challenge invitation notification
 */
export async function triggerChallengeInvitationNotification(
  studentId: string,
  challengeName: string,
  inviterName: string,
  challengeId: string
): Promise<NotificationResponse> {
  return sendNotification(
    studentId,
    "Challenge Invitation! ⚡",
    `${inviterName} challenged you to "${challengeName}"!`,
    {
      type: "challenge",
      challengeName,
      inviterName,
      challengeId,
    }
  );
}

/**
 * Trigger rank change notification
 */
export async function triggerRankChangeNotification(
  studentId: string,
  oldRank: number,
  newRank: number,
  leaderboardType: string,
  isImprovement: boolean
): Promise<NotificationResponse> {
  const direction = isImprovement ? "up" : "down";
  const emoji = isImprovement ? "📈" : "📉";

  return sendNotification(
    studentId,
    `${emoji} Rank Update!`,
    `You moved ${direction} to #${newRank} on the ${leaderboardType} leaderboard!`,
    {
      type: "rank",
      oldRank,
      newRank,
      leaderboardType,
      isImprovement,
    }
  );
}

/**
 * Trigger reward redemption notification
 */
export async function triggerRewardRedemptionNotification(
  studentId: string,
  rewardName: string,
  redemptionCode: string,
  expiresAt: string
): Promise<NotificationResponse> {
  return sendNotification(
    studentId,
    "Reward Redeemed! 🎁",
    `Your ${rewardName} is ready! Code: ${redemptionCode}`,
    {
      type: "reward",
      rewardName,
      redemptionCode,
      expiresAt,
    }
  );
}
