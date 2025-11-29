'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Trophy, Flame, Clock, Users, Gift, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Achievement, StudentAchievement } from '@/lib/supabase';
import { NoRecentAchievements } from './EmptyState';
import BadgeIcon from './BadgeIcon';
import { categoryPalette, colors } from '@/lib/theme';
import { triggerConfetti } from '@/lib/utils';

interface StudentAchievementWithAchievement extends StudentAchievement {
  achievement: Achievement;
}

interface RecentAchievementsProps {
  studentId: string;
}

const categoryIcons = {
  attendance: Trophy,
  streak: Flame,
  time: Clock,
  social: Users,
  reward: Gift,
  special: Star,
};

export default function RecentAchievements({ studentId }: RecentAchievementsProps) {
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

      {/* Mobile: Compact circle badges - hidden on sm and up */}
      <div className="flex justify-center gap-4 sm:hidden">
        {achievements.filter(item => item.achievement).map((item, index) => {
          const Icon = categoryIcons[item.achievement.category] || Trophy;
          const catColors = categoryPalette[item.achievement.category] ?? { gradFrom: colors.primary.light, gradTo: colors.primary.dark };
          
          return (
            <motion.button
              key={`mobile-${item.id}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                triggerConfetti({
                  particleCount: 50,
                  spread: 70,
                  colors: [catColors.gradFrom, catColors.gradTo],
                });
                router.push('/achievements');
              }}
              className="relative w-16 h-16 rounded-full flex items-center justify-center shadow-lg cursor-pointer"
              style={{
                background: `linear-gradient(135deg, ${catColors.gradFrom}, ${catColors.gradTo})`,
              }}
            >
              <Icon size={24} className="text-white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
              {/* Glow effect */}
              <motion.div
                className="absolute inset-0 rounded-full -z-10"
                style={{
                  background: `linear-gradient(135deg, ${catColors.gradFrom}, ${catColors.gradTo})`,
                  filter: 'blur(8px)',
                  opacity: 0.4,
                }}
                animate={{
                  scale: [1, 1.15, 1],
                  opacity: [0.4, 0.6, 0.4],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: index * 0.3,
                }}
              />
            </motion.button>
          );
        })}
      </div>

      {/* Desktop: Full badge cards - hidden below sm */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-3">
        {achievements.filter(item => item.achievement).map((item, index) => (
          <motion.div
            key={`desktop-${item.id}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            <BadgeIcon
              achievement={item.achievement}
              studentAchievement={item}
              size="sm"
              showProgress={false}
              onClick={() => router.push('/achievements')}
            />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
