/**
 * Test notification functions for development
 * These work without needing the Supabase Edge Function
 */

import { showLocalNotification } from './notifications';

/**
 * Test achievement notification
 */
export async function testAchievementNotification() {
  await showLocalNotification(
    'Achievement Unlocked! 🏆',
    'You earned "Early Bird" and 50 points!',
    {
      type: 'achievement',
      achievementName: 'Early Bird',
      points: 50,
    }
  );
}

/**
 * Test streak risk notification
 */
export async function testStreakRiskNotification() {
  await showLocalNotification(
    'Streak at Risk! 🔥',
    "Don't break your 7-day streak! Class starts in 2 hours.",
    {
      type: 'streak',
      currentStreak: 7,
      className: 'Computer Science 101',
      classTime: '10:00 AM',
    }
  );
}

/**
 * Test challenge invitation notification
 */
export async function testChallengeInvitationNotification() {
  await showLocalNotification(
    'Challenge Invitation! ⚡',
    'Sarah challenged you to an attendance battle!',
    {
      type: 'challenge',
      challengeName: 'Perfect Week Challenge',
      inviterName: 'Sarah',
      challengeId: 'challenge-123',
    }
  );
}

/**
 * Test rank change notification
 */
export async function testRankChangeNotification() {
  await showLocalNotification(
    'Rank Update! 📈',
    'You moved up to #3 on the leaderboard!',
    {
      type: 'rank',
      oldRank: 5,
      newRank: 3,
      leaderboardType: 'school',
      isImprovement: true,
    }
  );
}

/**
 * Test reward redemption notification
 */
export async function testRewardRedemptionNotification() {
  await showLocalNotification(
    'Reward Redeemed! 🎁',
    'Your Starbucks gift card is ready! Code: STAR2024',
    {
      type: 'reward',
      rewardName: 'Starbucks $5 Gift Card',
      redemptionCode: 'STAR2024',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }
  );
}

/**
 * Test all notification types in sequence
 */
export async function testAllNotifications() {
  const notifications = [
    { fn: testAchievementNotification, name: 'Achievement', delay: 0 },
    { fn: testStreakRiskNotification, name: 'Streak Risk', delay: 2000 },
    { fn: testChallengeInvitationNotification, name: 'Challenge', delay: 4000 },
    { fn: testRankChangeNotification, name: 'Rank Change', delay: 6000 },
    { fn: testRewardRedemptionNotification, name: 'Reward', delay: 8000 },
  ];

  for (const { fn, name, delay } of notifications) {
    setTimeout(async () => {
      try {
        await fn();
      } catch (error) {
        console.error(`${name} notification failed:`, error);
      }
    }, delay);
  }

  return 'Sending 5 test notifications over 10 seconds...';
}
