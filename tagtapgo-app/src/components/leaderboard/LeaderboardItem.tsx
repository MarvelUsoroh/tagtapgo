/**
 * LeaderboardItem Component
 * Horizontal bar chart design inspired by Kahoot
 * Each entry is a distinct bar with rank, avatar, name, and score
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/icons';
import { colors } from '@/lib/theme';
import { cn, formatNumber, getInitials } from '@/lib/utils';

interface LeaderboardItemProps {
  rank: number;
  studentName: string;
  studentAvatarUrl?: string | null;
  score: number;
  currentStreak: number;
  isCurrentUser: boolean;
  index: number;
  maxScore: number; // For calculating bar width percentage
}

export const LeaderboardItem: React.FC<LeaderboardItemProps> = ({
  rank,
  studentName,
  studentAvatarUrl,
  score,
  currentStreak,
  isCurrentUser,
  index,
  maxScore,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getRankIcon = () => {
    switch (rank) {
      case 1:
        return <Icon name="trophy" size="lg" color={colors.rank.gold} />;
      case 2:
        return <Icon name="ribbon" size="lg" color={colors.rank.silver} />;
      case 3:
        return <Icon name="ribbon" size="lg" color={colors.rank.bronze} />;
      default:
        return null;
    }
  };

  const getRankColor = () => {
    switch (rank) {
      case 1:
        return colors.rank.gold;
      case 2:
        return colors.rank.silver;
      case 3:
        return colors.rank.bronze;
      default:
        return colors.gray[600];
    }
  };

  const getBarColor = () => {
    switch (rank) {
      case 1:
        return '#FFD700'; // Gold
      case 2:
        return '#C0C0C0'; // Silver
      case 3:
        return '#CD7F32'; // Bronze
      default:
        return colors.primary.DEFAULT;
    }
  };

  const getFirstName = (fullName: string) => {
    if (!fullName || !fullName.trim()) return 'Student';
    return fullName.trim().split(' ')[0];
  };

  // Calculate bar width percentage (minimum 15% for visibility)
  const barWidthPercent = maxScore > 0 ? Math.max(15, (score / maxScore) * 100) : 15;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className={cn(
        'bg-white rounded-xl overflow-hidden',
        isCurrentUser && 'ring-2 ring-primary shadow-lg',
        rank <= 3 && 'shadow-md'
      )}
    >
      {/* Header with rank, avatar, name */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left"
      >
        <div className="p-3 flex items-center gap-3">
          {/* Rank */}
          <div className="flex-shrink-0 w-8 text-center">
            {getRankIcon() || (
              <span
                className="text-lg font-bold"
                style={{ color: getRankColor() }}
              >
                {rank}
              </span>
            )}
          </div>

          {/* Avatar */}
          <div className="flex-shrink-0">
            <Avatar
              src={studentAvatarUrl || undefined}
              alt={getFirstName(studentName)}
              fallbackIcon={
                <span className="text-white font-bold text-sm">
                  {getInitials(studentName || 'Student')}
                </span>
              }
              size="sm"
            />
          </div>

          {/* Name */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate text-gray-900">
              {getFirstName(studentName)}
              {isCurrentUser && (
                <span
                  className="ml-1.5 text-xs font-medium"
                  style={{ color: colors.primary.DEFAULT }}
                >
                  (You)
                </span>
              )}
            </p>
          </div>

          {/* Score */}
          <div className="flex-shrink-0">
            <p
              className="text-lg font-bold"
              style={{ color: getRankColor() }}
            >
              {formatNumber(score)}
            </p>
          </div>

          {/* Expand Indicator */}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0"
          >
            <Icon name="arrowForward" size="sm" className="rotate-90 text-gray-400" />
          </motion.div>
        </div>
      </button>

      {/* Bar Chart */}
      <div className="px-3 pb-3">
        <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden">
          {/* Animated Bar */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${barWidthPercent}%` }}
            transition={{ duration: 1, delay: index * 0.08 + 0.3, ease: 'easeOut' }}
            className="absolute inset-y-0 left-0 rounded-full flex items-center justify-end pr-3"
            style={{
              backgroundColor: getBarColor(),
            }}
          >
            {/* Score inside bar (only show if bar is wide enough) */}
            {barWidthPercent > 30 && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.08 + 0.8 }}
                className="text-white text-xs font-bold"
              >
                {formatNumber(score)}
              </motion.span>
            )}
          </motion.div>

          {/* Streak indicator on the right */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full">
              <Icon name="flame" size="sm" color={colors.warning} />
              <span className="text-xs font-medium text-gray-700">
                {currentStreak || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden border-t border-gray-100"
          >
            <div className="p-4 bg-gray-50 grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold" style={{ color: colors.primary.DEFAULT }}>
                  {formatNumber(score)}
                </p>
                <p className="text-xs text-gray-600 mt-1">Total Score</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Icon name="flame" size="lg" color={colors.warning} />
                  <p className="text-2xl font-bold" style={{ color: colors.warning }}>
                    {currentStreak || 0}
                  </p>
                </div>
                <p className="text-xs text-gray-600 mt-1">Day Streak</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
