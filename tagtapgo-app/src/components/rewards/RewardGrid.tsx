/**
 * RewardGrid Component
 * Displays rewards in a responsive grid layout with loading and empty states
 * Requirements: 6.2, 6.4, 22.3, 23.1, 43.1-43.7
 */

'use client';

import { motion } from 'framer-motion';
import { IoGift } from 'react-icons/io5';
import RewardCard from '@/components/rewards/RewardCard';
import { SkeletonRewardCard } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';
import type { Reward } from '@/lib/supabase';

interface RewardGridProps {
  rewards: Reward[];
  isLoading?: boolean;
  view?: 'grid' | 'list';
  onRewardSelect: (reward: Reward) => void;
  studentId?: string;
  referralSource?: 'browse' | 'notification' | 'leaderboard' | 'achievement' | 'search';
}

/**
 * RewardGrid Component
 * 
 * Displays rewards in a grid or list layout with:
 * - Consistent spacing using design system tokens (16px gap)
 * - Loading state with skeleton components
 * - Empty state when no rewards available
 * - Responsive grid layout (1 col mobile, 2 col tablet, 3 col desktop)
 * - Staggered animation on mount
 */
export default function RewardGrid({
  rewards,
  isLoading = false,
  view = 'grid',
  onRewardSelect,
  studentId,
  referralSource = 'browse',
}: RewardGridProps) {
  // Loading state - show skeleton cards
  if (isLoading) {
    return (
      <div
        className={
          view === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'flex flex-col gap-4'
        }
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonRewardCard key={index} />
        ))}
      </div>
    );
  }

  // Empty state - no rewards available
  if (rewards.length === 0) {
    return (
      <EmptyState
        icon={IoGift}
        title="No rewards available"
        message="Check back later for new rewards from our brand partners."
      />
    );
  }

  // Grid view
  if (view === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rewards.map((reward, index) => (
          <motion.div
            key={reward.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <RewardCard
              reward={reward}
              studentId={studentId}
              referralSource={referralSource}
              onRedeem={() => onRewardSelect(reward)}
            />
          </motion.div>
        ))}
      </div>
    );
  }

  // List view
  return (
    <div className="flex flex-col gap-4">
      {rewards.map((reward, index) => (
        <motion.div
          key={reward.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
        >
          <RewardCard
            reward={reward}
            studentId={studentId}
            referralSource={referralSource}
            onRedeem={() => onRewardSelect(reward)}
          />
        </motion.div>
      ))}
    </div>
  );
}
