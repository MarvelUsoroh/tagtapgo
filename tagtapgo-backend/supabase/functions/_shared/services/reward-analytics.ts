/**
 * Reward Analytics Service
 * Tracks reward views and redemption analytics for brand partnership ROI
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export interface RewardView {
  student_id: string;
  reward_id: string;
  referral_source?: 'browse' | 'notification' | 'leaderboard' | 'achievement' | 'search';
  session_id?: string;
}

export interface RedemptionAnalytics {
  redemption_id: string;
  student_id: string;
  reward_id: string;
  
  // Student metrics
  attendance_rate: number;
  current_streak: number;
  total_points_earned: number;
  days_since_signup: number;
  
  // Conversion metrics
  redemption_value: number;
  time_to_redeem?: string; // ISO duration
  view_to_redemption_time?: string;
  views_before_redemption: number;
  
  // Brand metrics
  brand_id?: string;
  brand_name: string;
  category: string;
  
  // Behavioral metrics
  repeat_redemption_count: number;
  referral_source?: string;
  session_duration?: string;
  platform?: 'web' | 'ios' | 'android';
}

/**
 * Track when a student views a reward
 */
export async function trackRewardView(
  supabase: SupabaseClient,
  view: RewardView
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('reward_views')
      .insert({
        student_id: view.student_id,
        reward_id: view.reward_id,
        referral_source: view.referral_source || 'browse',
        session_id: view.session_id,
      });

    if (error) {
      console.error('[RewardAnalytics] Error tracking view:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[RewardAnalytics] Exception tracking view:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Create redemption analytics record
 * Called after successful redemption
 */
export async function createRedemptionAnalytics(
  supabase: SupabaseClient,
  redemptionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get redemption details
    const { data: redemption, error: redemptionError } = await supabase
      .from('redemptions')
      .select(`
        id,
        student_id,
        reward_id,
        points_spent,
        created_at,
        reward:rewards (
          id,
          name,
          brand,
          category,
          points_cost
        )
      `)
      .eq('id', redemptionId)
      .single();

    if (redemptionError || !redemption) {
      return { success: false, error: 'Redemption not found' };
    }

    // Get student engagement metrics
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, created_at')
      .eq('id', redemption.student_id)
      .single();

    if (studentError || !student) {
      return { success: false, error: 'Student not found' };
    }

    // Calculate attendance rate
    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('status')
      .eq('student_id', redemption.student_id);

    const totalAttendance = attendanceData?.length || 0;
    const presentCount = attendanceData?.filter(a => a.status === 'present').length || 0;
    const attendanceRate = totalAttendance > 0 ? (presentCount / totalAttendance) * 100 : 0;

    // Get current streak
    const { data: streakData } = await supabase
      .from('streaks')
      .select('current_streak')
      .eq('student_id', redemption.student_id)
      .single();

    const currentStreak = streakData?.current_streak || 0;

    // Calculate total points earned
    const { data: pointsData } = await supabase
      .from('points')
      .select('points')
      .eq('student_id', redemption.student_id)
      .gte('points', 0); // Only positive points (earned, not spent)

    const totalPointsEarned = pointsData?.reduce((sum, p) => sum + p.points, 0) || 0;

    // Calculate days since signup
    const daysSinceSignup = Math.floor(
      (new Date().getTime() - new Date(student.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Get first view time for this reward
    const { data: firstView } = await supabase
      .from('reward_views')
      .select('viewed_at, referral_source')
      .eq('student_id', redemption.student_id)
      .eq('reward_id', redemption.reward_id)
      .order('viewed_at', { ascending: true })
      .limit(1)
      .single();

    // Count views before redemption
    const { count: viewCount } = await supabase
      .from('reward_views')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', redemption.student_id)
      .eq('reward_id', redemption.reward_id)
      .lt('viewed_at', redemption.created_at);

    // Calculate time to redeem (from earning enough points)
    const { data: pointsHistory } = await supabase
      .from('points')
      .select('points, created_at')
      .eq('student_id', redemption.student_id)
      .order('created_at', { ascending: true });

    let timeToRedeem: string | undefined;
    if (pointsHistory) {
      let runningTotal = 0;
      let earnedEnoughAt: Date | null = null;

      for (const point of pointsHistory) {
        runningTotal += point.points;
        if (runningTotal >= redemption.points_spent && !earnedEnoughAt) {
          earnedEnoughAt = new Date(point.created_at);
          break;
        }
      }

      if (earnedEnoughAt) {
        const diffMs = new Date(redemption.created_at).getTime() - earnedEnoughAt.getTime();
        timeToRedeem = `PT${Math.floor(diffMs / 1000)}S`; // ISO 8601 duration
      }
    }

    // Calculate view to redemption time
    let viewToRedemptionTime: string | undefined;
    if (firstView) {
      const diffMs = new Date(redemption.created_at).getTime() - new Date(firstView.viewed_at).getTime();
      viewToRedemptionTime = `PT${Math.floor(diffMs / 1000)}S`;
    }

    // Count repeat redemptions from this brand
    const { count: repeatCount } = await supabase
      .from('redemptions')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', redemption.student_id)
      .eq('reward_id', redemption.reward_id)
      .lt('created_at', redemption.created_at);

    // Insert analytics record
    const analyticsData: Partial<RedemptionAnalytics> = {
      redemption_id: redemption.id,
      student_id: redemption.student_id,
      reward_id: redemption.reward_id,
      
      attendance_rate: Math.round(attendanceRate * 100) / 100,
      current_streak: currentStreak,
      total_points_earned: totalPointsEarned,
      days_since_signup: daysSinceSignup,
      
      redemption_value: redemption.points_spent, // For now, use points as value
      time_to_redeem: timeToRedeem,
      view_to_redemption_time: viewToRedemptionTime,
      views_before_redemption: viewCount || 0,
      
      brand_name: redemption.reward.brand || 'Unknown',
      category: redemption.reward.category || 'other',
      
      repeat_redemption_count: repeatCount || 0,
      referral_source: firstView?.referral_source || 'unknown',
      platform: 'web', // TODO: Detect from user agent
    };

    const { error: insertError } = await supabase
      .from('redemption_analytics')
      .insert(analyticsData);

    if (insertError) {
      console.error('[RewardAnalytics] Error creating analytics:', insertError);
      return { success: false, error: insertError.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[RewardAnalytics] Exception creating analytics:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get brand performance metrics
 */
export async function getBrandPerformance(
  supabase: SupabaseClient,
  brandId?: string
): Promise<any> {
  try {
    let query = supabase
      .from('brand_performance')
      .select('*');

    if (brandId) {
      query = query.eq('brand_id', brandId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[RewardAnalytics] Error fetching brand performance:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('[RewardAnalytics] Exception fetching brand performance:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get conversion funnel by engagement tier
 */
export async function getConversionFunnel(
  supabase: SupabaseClient
): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('conversion_by_engagement')
      .select('*')
      .order('engagement_tier', { ascending: false });

    if (error) {
      console.error('[RewardAnalytics] Error fetching conversion funnel:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('[RewardAnalytics] Exception fetching conversion funnel:', error);
    return { success: false, error: String(error) };
  }
}
