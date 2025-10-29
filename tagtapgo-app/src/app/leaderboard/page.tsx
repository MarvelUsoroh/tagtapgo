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
  
  try {
    // Calculate current week start (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    const currentWeekStart = monday.toISOString().split('T')[0];

    // Fetch initial leaderboard data (school, weekly by default)
    const { data: leaderboardData, error } = await supabase
      .from('leaderboards')
      .select('id, student_id, leaderboard_type, period, course_id, primary_course_id, rank, points, current_streak, longest_streak, score, period_start, period_end, updated_at, student_name, student_avatar_url')
      .eq('leaderboard_type', 'school')
      .eq('period', 'weekly')
      .eq('period_start', currentWeekStart)
      .order('rank')
      .limit(LEADERBOARD_CONFIG.ITEMS_PER_PAGE);
    
    if (error) {
      console.error('Error fetching leaderboard:', error);
      throw error;
    }
    
    // Find user's rank
    const userEntry = leaderboardData?.find((entry) => entry.student_id === userId);
    const userRank = userEntry?.rank || null;
    
    // Pass to client component
    return (
      <LeaderboardClient
        initialLeaderboard={leaderboardData || []}
        initialUserRank={userRank}
        currentStudentId={userId}
      />
    );
    
  } catch (error) {
    console.error('Error fetching leaderboard data:', error);
    redirect('/login?error=data_fetch_failed');
  }
}
