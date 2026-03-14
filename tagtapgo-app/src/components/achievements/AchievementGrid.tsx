/**
 * AchievementGrid Component
 * Displays achievements in a responsive grid layout with loading and empty states
 * Requirements: 10.2, 10.4, 22.3, 23.1, 43.1-43.7
 */

'use client';

import { motion } from 'framer-motion';
import { IoTrophy } from 'react-icons/io5';
import AchievementCard from './AchievementCard';
import { Skeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/EmptyState';
import type { Achievement, StudentAchievement } from '@/lib/supabase';

interface AchievementGridProps {
  achievements: (Achievement & { student_achievement?: StudentAchievement })[];
  isLoading?: boolean;
  onAchievementSelect?: (achievement: Achievement) => void;
}

/**
 * AchievementGrid Component
 * 
 * Displays achievements in a grid layout with:
 * - Consistent spacing using design system tokens (16px gap)
 * - Loading state with skeleton components
 * - Empty state when no achievements available
 * - Responsive grid layout (1 col mobile, 2 col tablet, 3 col desktop)
 * - Staggered animation on mount
 */
export default function AchievementGrid({
  achievements,
  isLoading = false,
  onAchievementSelect,
}: AchievementGridProps) {
  // Loading state - show skeleton cards
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="flex flex-col items-center p-3">
            <Skeleton variant="circular" width={64} height={64} className="mb-2" />
            <Skeleton variant="text" width="100%" height={16} className="mb-1" />
            <Skeleton variant="text" width="60%" height={12} />
          </div>
        ))}
      </div>
    );
  }

  // Empty state - no achievements available
  if (achievements.length === 0) {
    return (
      <EmptyState
        icon={IoTrophy}
        title="No achievements yet"
        message="Complete activities to unlock achievements and earn rewards."
      />
    );
  }

  // Grid view with achievements
  return (
    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {achievements.map((achievement, index) => {
        // Extract progress as a number if it's an object with current/target
        const progressData = achievement.student_achievement?.progress;
        const progressValue = typeof progressData === 'number' 
          ? progressData 
          : (progressData && typeof progressData === 'object' && 'current' in progressData && 'target' in progressData)
            ? ((progressData.current as number) / (progressData.target as number)) * 100
            : 0;

        return (
          <motion.div
            key={achievement.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
          >
            <AchievementCard
              achievement={achievement}
              isUnlocked={!!achievement.student_achievement?.unlocked_at}
              progress={progressValue}
              onClick={() => onAchievementSelect?.(achievement)}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
