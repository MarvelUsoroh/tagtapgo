/**
 * Leaderboard Server Component
 * Fetches leaderboard data server-side
 */

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase-server';
import { LEADERBOARD_CONFIG } from '@/lib/constants';
import LeaderboardClient from './LeaderboardClient';

export default async function LeaderboardPage() {
  // Create server-side Supabase client and verify user via SSR
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }
  const userId = user.id;
  
  // Get the actual student ID from auth_user_id
  const { data: studentProfile } = await supabase
    .from('students')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  
  if (!studentProfile) {
    redirect('/login?error=no_profile');
  }
  
  const studentId = studentProfile.id;
  
  try {
    // Fetch initial leaderboard data (school, all-time by default)
    const { data: leaderboardData, error } = await supabase
      .from('leaderboards')
      .select('id, student_id, leaderboard_type, period, course_id, primary_course_id, rank, points, current_streak, longest_streak, score, period_start, period_end, updated_at, student_name, student_avatar_url')
      .eq('leaderboard_type', 'school')
      .eq('period', 'all_time')
      .order('rank')
      .limit(LEADERBOARD_CONFIG.ITEMS_PER_PAGE);
    
    if (error) {
      console.error('Error fetching leaderboard:', error);
      throw error;
    }
    
    // Find user's rank
    const userEntry = leaderboardData?.find((entry) => entry.student_id === studentId);
    const userRank = userEntry?.rank || null;
    
    // Pass to client component
    return (
      <LeaderboardClient
        initialLeaderboard={leaderboardData || []}
        initialUserRank={userRank}
        currentStudentId={studentId}
      />
    );
    
  } catch (error) {
    console.error('Error fetching leaderboard data:', error);
    redirect('/login?error=data_fetch_failed');
  }
}
