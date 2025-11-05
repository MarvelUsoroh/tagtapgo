/**
 * Achievements Server Component
 * Fetches achievements data server-side
 */

// Force dynamic rendering to ensure fresh data for authenticated users
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase-server';
import AchievementsClient from './AchievementsClient';

export default async function AchievementsPage() {
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
    type AchWithProgressRow = {
      id: string;
      name: string;
      description: string;
      category: 'attendance' | 'streak' | 'time' | 'social' | 'reward';
      rarity: 'common' | 'rare' | 'epic' | 'legendary';
      points_reward: number;
      created_at: string;
      student_achievement_id: string | null;
      student_unlocked_at: string | null;
    };
    // Fetch achievements with progress from the view
    const { data, error } = await supabase
      .from('achievements_with_progress')
      .select('id, name, description, category, rarity, points_reward, created_at, student_achievement_id, student_unlocked_at')
      .order('rarity', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching achievements_with_progress:', error);
      throw error;
    }

    // Map rows to the client shape: Achievement & optional StudentAchievement
    const achievementsWithProgress = ((data as AchWithProgressRow[] | null) || []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      rarity: row.rarity,
      points_reward: row.points_reward,
      created_at: row.created_at,
      // Fill required Achievement fields not present in the view
      badge_image_url: undefined,
      criteria: {},
      studentAchievement: row.student_achievement_id
        ? {
            id: row.student_achievement_id,
            student_id: userId,
            achievement_id: row.id,
            unlocked_at: row.student_unlocked_at as string,
            progress: {},
          }
        : undefined,
    }));

    // Calculate stats from the mapped rows
    const unlockedCount = achievementsWithProgress.filter(a => a.studentAchievement?.unlocked_at).length;
    const bonusPoints = achievementsWithProgress
      .filter(a => a.studentAchievement?.unlocked_at)
      .reduce((sum, a) => sum + (a.points_reward || 0), 0);
    
    // Pass to client component
    return (
      <AchievementsClient
        achievements={achievementsWithProgress}
        unlockedCount={unlockedCount}
        bonusPoints={bonusPoints}
      />
    );
    
  } catch (error) {
    console.error('Error fetching achievements data:', error);
    redirect('/login?error=data_fetch_failed');
  }
}
