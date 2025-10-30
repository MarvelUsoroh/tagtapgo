/**
 * Achievement Check Service
 * 
 * Checks achievement criteria and unlocks achievements for students.
 * Awards bonus points for unlocked achievements.
 * Triggers confetti animation via push notification.
 * 
 * Achievement Categories:
 * - attendance: Based on attendance records
 * - streak: Based on streak milestones
 * - time: Based on early arrival
 * - social: Based on feedback and social interactions
 * - reward: Based on reward redemptions
 * 
 * Requirements: 4, 7
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: 'attendance' | 'streak' | 'time' | 'social' | 'reward';
  criteria: AchievementCriteria;
  points_reward: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon?: string;
  created_at: string;
}

export interface AchievementCriteria {
  type: string;
  target: number;
  [key: string]: any;
}

export interface StudentAchievement {
  id: string;
  student_id: string;
  achievement_id: string;
  progress: any; // JSONB - can store various progress data
  unlocked: boolean;
  unlocked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AchievementCheckResult {
  student_id: string;
  achievements_unlocked: UnlockedAchievement[];
  achievements_progressed: ProgressedAchievement[];
  total_bonus_points: number;
  errors: string[];
}

export interface UnlockedAchievement {
  achievement_id: string;
  achievement_name: string;
  points_reward: number;
  rarity: string;
}

export interface ProgressedAchievement {
  achievement_id: string;
  achievement_name: string;
  progress: number;
  target: number;
  percentage: number;
}

/**
 * Check achievements for students based on recent activity
 * 
 * @param supabase - Supabase client with service role
 * @param studentIds - Student IDs to check
 * @returns Results for each student
 */
export async function checkAchievements(
  supabase: SupabaseClient,
  studentIds: string[]
): Promise<AchievementCheckResult[]> {
  const results: AchievementCheckResult[] = [];
  
  // Get all achievements
  const { data: achievements, error: achievementsError } = await supabase
    .from('achievements')
    .select('*');
  
  if (achievementsError) {
    throw new Error(`Failed to load achievements: ${achievementsError.message}`);
  }
  
  if (!achievements || achievements.length === 0) {
    console.log('[Achievement Checker] No achievements defined');
    return [];
  }
  
  // Process each student
  for (const studentId of studentIds) {
    try {
      const result = await checkStudentAchievements(supabase, studentId, achievements);
      results.push(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Achievement Checker] Error processing student ${studentId}:`, errorMessage);
      
      results.push({
        student_id: studentId,
        achievements_unlocked: [],
        achievements_progressed: [],
        total_bonus_points: 0,
        errors: [errorMessage],
      });
    }
  }
  
  return results;
}

/**
 * Check achievements for a single student
 */
async function checkStudentAchievements(
  supabase: SupabaseClient,
  studentId: string,
  achievements: Achievement[]
): Promise<AchievementCheckResult> {
  const result: AchievementCheckResult = {
    student_id: studentId,
    achievements_unlocked: [],
    achievements_progressed: [],
    total_bonus_points: 0,
    errors: [],
  };
  
  // Get student's current achievement progress
  const { data: studentAchievements, error: studentAchievementsError } = await supabase
    .from('student_achievements')
    .select('*')
    .eq('student_id', studentId);
  
  if (studentAchievementsError) {
    throw new Error(`Failed to load student achievements: ${studentAchievementsError.message}`);
  }
  
  const studentAchievementMap = new Map(
    (studentAchievements || []).map(sa => [sa.achievement_id, sa])
  );
  
  // Check each achievement
  for (const achievement of achievements) {
    try {
      const studentAchievement = studentAchievementMap.get(achievement.id) as StudentAchievement | undefined;
      
      // Skip if already unlocked
      if (studentAchievement?.unlocked || studentAchievement?.unlocked_at) {
        continue;
      }
      
      // Calculate progress
      const progress = await calculateProgress(supabase, studentId, achievement);
      
      // Check if criteria met (handle both 'target' and 'value' fields)
      const target = achievement.criteria.target || achievement.criteria.value || 0;
      const unlocked = progress >= target;
      
      if (unlocked && !studentAchievement) {
        // Unlock achievement (only if not already in database)
        await unlockAchievement(supabase, studentId, achievement, progress);
        
        result.achievements_unlocked.push({
          achievement_id: achievement.id,
          achievement_name: achievement.name,
          points_reward: achievement.points_reward,
          rarity: achievement.rarity,
        });
        
        result.total_bonus_points += achievement.points_reward;
        
        // Send notification
        await sendAchievementNotification(supabase, studentId, achievement);
        
        console.log(`[Achievement Checker] Student ${studentId} unlocked: ${achievement.name}`);
      } else if (progress > 0) {
        // Update progress
        await updateProgress(supabase, studentId, achievement, progress);
        
        const target = achievement.criteria.target || achievement.criteria.value || 0;
        result.achievements_progressed.push({
          achievement_id: achievement.id,
          achievement_name: achievement.name,
          progress,
          target,
          percentage: Math.round((progress / target) * 100),
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Achievement ${achievement.name}: ${errorMessage}`);
      console.error(`[Achievement Checker] Error checking ${achievement.name}:`, errorMessage);
    }
  }
  
  return result;
}

/**
 * Calculate progress for an achievement based on criteria type
 */
async function calculateProgress(
  supabase: SupabaseClient,
  studentId: string,
  achievement: Achievement
): Promise<number> {
  const { type } = achievement.criteria;
  
  switch (type) {
    case 'attendance_count':
      return await calculateAttendanceCount(supabase, studentId, achievement.criteria);
    
    case 'streak_milestone':
    case 'streak': // Alias for streak_milestone
      return await calculateStreakMilestone(supabase, studentId, achievement.criteria);
    
    case 'early_arrival_count':
    case 'early_arrival': // Alias
      return await calculateEarlyArrivalCount(supabase, studentId, achievement.criteria);
    
    case 'perfect_week_count':
    case 'perfect_week': // Alias for perfect_week_count
      return await calculatePerfectWeekCount(supabase, studentId, achievement.criteria);
    
    case 'perfect_month_count':
    case 'perfect_month': // Alias for perfect_month_count
      return await calculatePerfectMonthCount(supabase, studentId, achievement.criteria);
    
    case 'feedback_count':
      return await calculateFeedbackCount(supabase, studentId, achievement.criteria);
    
    case 'feedback_unique_courses':
      return await calculateFeedbackUniqueCourses(supabase, studentId, achievement.criteria);
    
    case 'feedback_with_comments':
      return await calculateFeedbackWithComments(supabase, studentId, achievement.criteria);
    
    case 'reward_redemption_count':
    case 'redemption_count': // Alias for reward_redemption_count
      return await calculateRewardRedemptionCount(supabase, studentId, achievement.criteria);
    
    case 'challenge_count':
      return await calculateChallengeCount(supabase, studentId, achievement.criteria);
    
    case 'friend_count':
    case 'friends': // Alias
      return await calculateFriendCount(supabase, studentId, achievement.criteria);
    
    default:
      console.warn(`[Achievement Checker] Unknown criteria type: ${type}`);
      return 0;
  }
}

/**
 * Calculate attendance count
 */
async function calculateAttendanceCount(
  supabase: SupabaseClient,
  studentId: string,
  criteria: AchievementCriteria
): Promise<number> {
  const { count, error } = await supabase
    .from('attendance')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .in('status', ['present', 'late', 'excused']);
  
  if (error) {
    throw new Error(`Failed to count attendance: ${error.message}`);
  }
  
  return count || 0;
}

/**
 * Calculate streak milestone
 */
async function calculateStreakMilestone(
  supabase: SupabaseClient,
  studentId: string,
  criteria: AchievementCriteria
): Promise<number> {
  const { data, error } = await supabase
    .from('streaks')
    .select('current_streak')
    .eq('student_id', studentId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get streak: ${error.message}`);
  }
  
  return data?.current_streak || 0;
}

/**
 * Calculate early arrival count
 */
async function calculateEarlyArrivalCount(
  supabase: SupabaseClient,
  studentId: string,
  criteria: AchievementCriteria
): Promise<number> {
  const { count, error } = await supabase
    .from('points')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('transaction_type', 'early_arrival');
  
  if (error) {
    throw new Error(`Failed to count early arrivals: ${error.message}`);
  }
  
  return count || 0;
}

/**
 * Calculate perfect week count
 */
async function calculatePerfectWeekCount(
  supabase: SupabaseClient,
  studentId: string,
  criteria: AchievementCriteria
): Promise<number> {
  const { count, error } = await supabase
    .from('points')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('transaction_type', 'perfect_week');
  
  if (error) {
    throw new Error(`Failed to count perfect weeks: ${error.message}`);
  }
  
  return count || 0;
}

/**
 * Calculate perfect month count
 */
async function calculatePerfectMonthCount(
  supabase: SupabaseClient,
  studentId: string,
  criteria: AchievementCriteria
): Promise<number> {
  const { count, error } = await supabase
    .from('points')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('transaction_type', 'perfect_month');
  
  if (error) {
    throw new Error(`Failed to count perfect months: ${error.message}`);
  }
  
  return count || 0;
}

/**
 * Calculate feedback count
 */
async function calculateFeedbackCount(
  supabase: SupabaseClient,
  studentId: string,
  criteria: AchievementCriteria
): Promise<number> {
  const { count, error } = await supabase
    .from('class_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId);
  
  if (error) {
    throw new Error(`Failed to count feedback: ${error.message}`);
  }
  
  return count || 0;
}

/**
 * Calculate feedback unique courses
 */
async function calculateFeedbackUniqueCourses(
  supabase: SupabaseClient,
  studentId: string,
  criteria: AchievementCriteria
): Promise<number> {
  const { data, error } = await supabase
    .from('class_feedback')
    .select('class_id')
    .eq('student_id', studentId);
  
  if (error) {
    throw new Error(`Failed to get feedback courses: ${error.message}`);
  }
  
  // Count unique course IDs
  const uniqueCourses = new Set(data?.map(f => f.class_id) || []);
  return uniqueCourses.size;
}

/**
 * Calculate feedback with comments
 */
async function calculateFeedbackWithComments(
  supabase: SupabaseClient,
  studentId: string,
  criteria: AchievementCriteria
): Promise<number> {
  const { count, error } = await supabase
    .from('class_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .not('comment', 'is', null);
  
  if (error) {
    throw new Error(`Failed to count feedback with comments: ${error.message}`);
  }
  
  return count || 0;
}

/**
 * Calculate reward redemption count
 */
async function calculateRewardRedemptionCount(
  supabase: SupabaseClient,
  studentId: string,
  criteria: AchievementCriteria
): Promise<number> {
  const { count, error } = await supabase
    .from('redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .in('status', ['issued', 'used']);
  
  if (error) {
    throw new Error(`Failed to count redemptions: ${error.message}`);
  }
  
  return count || 0;
}

/**
 * Calculate challenge count
 */
async function calculateChallengeCount(
  supabase: SupabaseClient,
  studentId: string,
  criteria: AchievementCriteria
): Promise<number> {
  // Count challenges where student is creator or participant
  const { count, error } = await supabase
    .from('challenges')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', studentId)
    .eq('status', 'completed');
  
  if (error) {
    throw new Error(`Failed to count challenges: ${error.message}`);
  }
  
  return count || 0;
}

/**
 * Calculate friend count
 */
async function calculateFriendCount(
  supabase: SupabaseClient,
  studentId: string,
  criteria: AchievementCriteria
): Promise<number> {
  // Note: Assuming a friends table exists or will be created
  // For now, return 0 as friends feature may not be implemented yet
  console.warn('[Achievement Checker] Friend count not implemented yet');
  return 0;
}

/**
 * Unlock achievement for student
 */
async function unlockAchievement(
  supabase: SupabaseClient,
  studentId: string,
  achievement: Achievement,
  progress: number
): Promise<void> {
  // Insert or update student_achievement
  // Support multiple field names: threshold (database), target, value (legacy)
  const target = achievement.criteria.threshold || achievement.criteria.target || achievement.criteria.value || 0;
  const { error: achievementError } = await supabase
    .from('student_achievements')
    .upsert({
      student_id: studentId,
      achievement_id: achievement.id,
      progress: { current: progress, target }, // Store as JSONB
      unlocked: true,
      unlocked_at: new Date().toISOString(),
    }, {
      onConflict: 'student_id,achievement_id',
    });
  
  if (achievementError) {
    throw new Error(`Failed to unlock achievement: ${achievementError.message}`);
  }
  
  // Award bonus points
  const { error: pointsError } = await supabase
    .from('points')
    .insert({
      student_id: studentId,
      points: achievement.points_reward,
      transaction_type: 'achievement',
      reference_id: achievement.id, // Use achievement_id as reference (UUID)
      description: `Achievement unlocked: ${achievement.name}`,
      metadata: {
        achievement_id: achievement.id,
        achievement_name: achievement.name,
        rarity: achievement.rarity,
      },
      created_at: new Date().toISOString(),
    });
  
  if (pointsError) {
    console.error('[Achievement Checker] Error awarding points:', pointsError);
    // Don't throw - achievement is already unlocked
  }
}

/**
 * Update achievement progress
 */
async function updateProgress(
  supabase: SupabaseClient,
  studentId: string,
  achievement: Achievement,
  progress: number
): Promise<void> {
  // Support multiple field names: threshold (database), target, value (legacy)
  const target = achievement.criteria.threshold || achievement.criteria.target || achievement.criteria.value || 0;
  const { error } = await supabase
    .from('student_achievements')
    .upsert({
      student_id: studentId,
      achievement_id: achievement.id,
      progress: { current: progress, target }, // Store as JSONB
      unlocked: false,
      unlocked_at: null,
    }, {
      onConflict: 'student_id,achievement_id',
    });
  
  if (error) {
    throw new Error(`Failed to update progress: ${error.message}`);
  }
}

/**
 * Send achievement unlock notification
 * Note: Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 */
async function sendAchievementNotification(
  supabase: SupabaseClient,
  studentId: string,
  achievement: Achievement
): Promise<void> {
  // Store notification in database
  const { error: dbError } = await supabase
    .from('notifications')
    .insert({
      student_id: studentId,
      notification_type: 'achievement_unlocked', // Must match check constraint
      title: '🏆 Achievement Unlocked!',
      message: `You earned "${achievement.name}" (+${achievement.points_reward} points)`,
      data: {
        achievement_id: achievement.id,
        achievement_name: achievement.name,
        points_reward: achievement.points_reward,
        rarity: achievement.rarity,
        trigger_confetti: true, // Signal to frontend to show confetti
      },
      read: false,
      created_at: new Date().toISOString(),
    });
  
  if (dbError) {
    console.error('[Achievement Checker] Error storing notification:', dbError);
  }
  
  // Send push notification (non-blocking)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.warn('[Achievement Checker] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY, skipping push notification');
      return;
    }
    
    // Dynamic import to avoid circular dependencies
    const { sendAchievementNotification: sendPush } = await import('./notification-sender.ts');
    
    await sendPush(
      supabaseUrl,
      serviceRoleKey,
      studentId,
      achievement.name,
      achievement.description,
      achievement.points_reward,
      achievement.rarity
    );
    
    console.log(`[Achievement Checker] Sent push notification for achievement: ${achievement.name}`);
  } catch (error) {
    console.error('[Achievement Checker] Error sending push notification:', error);
    // Don't throw - achievement is already unlocked and stored in DB
  }
}
