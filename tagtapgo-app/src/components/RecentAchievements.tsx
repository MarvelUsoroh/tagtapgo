'use client';

import { useEffect, useState, memo } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Achievement, StudentAchievement } from '@/lib/supabase';
import { NoRecentAchievements } from './EmptyState';
import AchievementCard from '@/components/achievements/AchievementCard';

interface StudentAchievementWithAchievement extends StudentAchievement {
  achievement: Achievement;
}

interface RecentAchievementsProps {
  studentId: string;
}

function RecentAchievements({ studentId }: RecentAchievementsProps) {
  const router = useRouter();
  const [achievements, setAchievements] = useState<StudentAchievementWithAchievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    (async () => {
      try {
        // Fetch student achievements
        const { data: studentAchievements, error: saError } = await supabase
          .from('student_achievements')
          .select('id, student_id, achievement_id, unlocked_at, progress')
          .eq('student_id', studentId)
          .eq('unlocked', true)
          .not('unlocked_at', 'is', null)
          .order('unlocked_at', { ascending: false })
          .limit(3);

        if (saError) throw saError;

        if (!studentAchievements || studentAchievements.length === 0) {
          if (!cancelled) setLoading(false);
          return;
        }

        // Fetch the corresponding achievements
        const achievementIds = studentAchievements.map(sa => sa.achievement_id);
        const { data: achievementsData, error: achievementsError } = await supabase
          .from('achievements')
          .select('id, name, description, category, rarity, points_reward, criteria, created_at, badge_image_url')
          .in('id', achievementIds);

        if (achievementsError) throw achievementsError;

        if (achievementsData && !cancelled) {
          // Combine the data
          const combined = studentAchievements.map(sa => {
            const achievement = achievementsData.find(a => a.id === sa.achievement_id);
            return {
              ...sa,
              achievement
            };
          }).filter(item => item.achievement) as StudentAchievementWithAchievement[];

          setAchievements(combined);
        }
      } catch (error) {
        console.error('Error fetching achievements:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="flex space-x-3">
            <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
            <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
            <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  if (achievements.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-md p-6"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Achievements</h2>
        <NoRecentAchievements onAction={() => router.push('/achievements')} />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-md p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Recent Achievements</h2>
        <button
          onClick={() => router.push('/achievements')}
          className="text-primary text-sm font-medium hover:text-primary-dark transition-colors"
        >
          View All
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {achievements.filter(item => item.achievement).map((item, index) => {
          // Extract progress
          const progressData = item.progress;
          const progressValue = typeof progressData === 'number' 
            ? progressData 
            : (progressData && typeof progressData === 'object' && 'current' in progressData && 'target' in progressData)
              ? ((progressData.current as number) / (progressData.target as number)) * 100
              : 0;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <AchievementCard
                achievement={item.achievement}
                isUnlocked={!!item.unlocked_at}
                progress={progressValue}
                onClick={() => router.push('/achievements')}
              />
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

export default memo(RecentAchievements);
