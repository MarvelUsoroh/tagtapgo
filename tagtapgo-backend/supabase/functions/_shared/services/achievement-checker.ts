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
 * 
 * Strategy: Only send push notification via send-push-notification Edge Function.
 * The Edge Function handles both database storage AND push delivery.
 * DO NOT store notification here to avoid duplicates.
 */
async function sendAchievementNotification(
  supabase: SupabaseClient,
  studentId: string,
  achievement: Achievement
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.warn('[Achievement Checker] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY, skipping notification');
      return;
    }
    
    // Send via send-push-notification Edge Function
    // This function handles BOTH database storage AND push delivery
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
    
    console.log(`[Achievement Checker] Sent notification for achievement: ${achievement.name}`);
  } catch (error) {
    console.error('[Achievement Checker] Error sending notification:', error);
    const errorDetails = error instanceof Error ? error.message : String(error);
    console.error('[Achievement Checker] Error details:', errorDetails);
    // Don't throw - achievement is already unlocked
  }
}
