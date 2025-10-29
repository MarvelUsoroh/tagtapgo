/**
 * Profile Server Component
 * Fetches profile data server-side
 */

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase-server';
import ProfileClient from './ProfileClient';

export default async function ProfilePage() {
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
    // Fetch all data in parallel
    const [
      studentData,
      pointsData,
      pointsEarnedData,
      streakData,
      attendanceData,
      achievementsData,
      allAchievementsData,
      redemptionsData,
    ] = await Promise.all([
      // Student profile
      supabase.from('students').select('*').eq('id', userId).single(),
      
      // Total points (current balance)
      supabase.from('points').select('points').eq('student_id', userId),

      // Total points earned (only positive points, excluding redemptions)
      supabase.from('points').select('points').eq('student_id', userId).gte('points', 0),
      
      // Current streak
      supabase.from('streaks').select('*').eq('student_id', userId).single(),
      
      // Attendance (last 30 days)
      supabase.from('attendance').select('status').eq('student_id', userId)
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      
      // Unlocked achievements
      supabase.from('student_achievements').select('id').eq('student_id', userId)
        .not('unlocked_at', 'is', null),
      
      // Total achievements available
      supabase.from('achievements').select('id'),
      
      // Rewards redeemed (count all redemptions regardless of status)
      supabase.from('redemptions').select('id').eq('student_id', userId),
    ]);
    
    // Handle errors
    if (studentData.error) {
      console.error('Error fetching student:', studentData.error);
      redirect('/login?error=student_not_found');
    }
    
    // Calculate derived data
    const totalPoints = pointsData.data?.reduce((sum, p) => sum + p.points, 0) || 0;
    const totalPointsEarned = pointsEarnedData.data?.reduce((sum, p) => sum + p.points, 0) || 0;
    
    let attendanceRate = 0;
    if (attendanceData.data && attendanceData.data.length > 0) {
      const present = attendanceData.data.filter(a => a.status === 'present').length;
      attendanceRate = Math.round((present / attendanceData.data.length) * 100);
    }
    
    const stats = {
      attendanceRate,
      achievementsUnlocked: achievementsData.data?.length || 0,
      totalAchievements: allAchievementsData.data?.length || 0,
      rewardsRedeemed: redemptionsData.data?.length || 0,
      totalPointsEarned,
      memberSince: studentData.data.created_at,
    };
    
    // Pass to client component
    return (
      <ProfileClient
        student={studentData.data}
        totalPoints={totalPoints}
        currentStreak={streakData.data}
        stats={stats}
      />
    );
    
  } catch (error) {
    console.error('Error fetching profile data:', error);
    redirect('/login?error=data_fetch_failed');
  }
}
