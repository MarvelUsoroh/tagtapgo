/**
 * Empty State Components
 * Reusable empty state displays with encouraging messages
 */

'use client';

import { motion } from 'framer-motion';
import { 
  IoRibbon,
  IoTrophy,
  IoGift,
  IoSparkles,
  IoPeople,
  IoCalendar,
  IoSearch
} from 'react-icons/io5';
import type { IconType } from 'react-icons';
import { colors } from '@/lib/theme';
import { buttonPress, fadeInUp } from '@/lib/animations';

interface EmptyStateProps {
  icon?: IconType;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/**
 * Generic Empty State Component
 */
export default function EmptyState({
  icon: Icon = IoRibbon,
  title,
  message,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className || ''}`}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className="mb-4 p-4 rounded-full"
        style={{ backgroundColor: colors.gray[100] }}
      >
        <Icon size={48} style={{ color: colors.gray[400] }} />
      </motion.div>

      <h3 className="text-xl font-bold mb-2" style={{ color: colors.gray[900] }}>
        {title}
      </h3>

      <p className="text-sm mb-6 max-w-md" style={{ color: colors.gray[600] }}>
        {message}
      </p>

      {actionLabel && onAction && (
        <motion.button
          {...buttonPress}
          onClick={onAction}
          className="px-6 py-3 rounded-lg font-medium text-white transition-colors"
          style={{ backgroundColor: colors.primary.DEFAULT }}
        >
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  );
}

/**
 * No Achievements Empty State
 */
export function NoAchievements({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={IoTrophy}
      title="No Achievements Yet"
      message="Start attending classes to unlock your first achievement! Every class you attend brings you closer to earning badges."
      actionLabel="View Dashboard"
      onAction={onAction}
    />
  );
}

/**
 * No Rewards Empty State
 */
export function NoRewards({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={IoGift}
      title="No Rewards Available"
      message="Check back soon! We're working on bringing you exciting rewards from our brand partners."
      actionLabel="Earn More Points"
      onAction={onAction}
    />
  );
}

/**
 * No Redemptions Empty State
 */
export function NoRedemptions({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={IoSparkles}
      title="No Redemptions Yet"
      message="You haven't redeemed any rewards yet. Browse the catalog and treat yourself with your hard-earned points!"
      actionLabel="Browse Rewards"
      onAction={onAction}
    />
  );
}

/**
 * No Leaderboard Data Empty State
 */
export function NoLeaderboardData() {
  return (
    <EmptyState
      icon={IoPeople}
      title="No Rankings Yet"
      message="Be the first to appear on the leaderboard! Attend classes and earn points to climb the ranks."
    />
  );
}

/**
 * No Classes Today Empty State
 */
export function NoClassesToday() {
  return (
    <EmptyState
      icon={IoCalendar}
      title="No Classes Today"
      message="Enjoy your day off! Check back tomorrow for your class schedule."
    />
  );
}

/**
 * No Recent Achievements Empty State
 */
export function NoRecentAchievements({ onAction }: { onAction?: () => void }) {
  return (
    <div className="text-center py-8">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="mb-3"
      >
        <IoRibbon size={40} style={{ color: colors.gray[300] }} className="mx-auto" />
      </motion.div>
      <p className="text-sm font-medium mb-2" style={{ color: colors.gray[600] }}>
        No achievements yet
      </p>
      <p className="text-xs mb-4" style={{ color: colors.gray[500] }}>
        Keep attending classes to unlock badges!
      </p>
      {onAction && (
        <motion.button
          {...buttonPress}
          onClick={onAction}
          className="text-sm font-medium px-4 py-2 rounded-lg"
          style={{ 
            backgroundColor: colors.primary.DEFAULT + '20',
            color: colors.primary.DEFAULT 
          }}
        >
          View All Achievements
        </motion.button>
      )}
    </div>
  );
}

/**
 * No Search Results Empty State
 */
export function NoSearchResults({ query }: { query: string }) {
  return (
    <EmptyState
      icon={IoSearch}
      title="No Results Found"
      message={`We couldn't find anything matching "${query}". Try adjusting your search or filters.`}
    />
  );
}

/**
 * Coming Soon Empty State
 */
export function ComingSoon({ feature }: { feature: string }) {
  return (
    <EmptyState
      icon={IoSparkles}
      title="Coming Soon"
      message={`${feature} is on the way! We're working hard to bring you this feature. Stay tuned!`}
    />
  );
}

/**
 * Inline Empty State (smaller, for cards/sections)
 */
export function InlineEmpty({
  icon: Icon = IoRibbon,
  message,
}: {
  icon?: IconType;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-6 px-4">
      <Icon size={32} style={{ color: colors.gray[300] }} className="mb-2" />
      <p className="text-sm text-center" style={{ color: colors.gray[500] }}>
        {message}
      </p>
    </div>
  );
}
