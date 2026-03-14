/**
 * LeaderboardItem Component
 * Displays a single leaderboard entry with rank, avatar, name, and score
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
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
}

export const LeaderboardItem: React.FC<LeaderboardItemProps> = ({
  rank,
  studentName,
  studentAvatarUrl,
  score,
  currentStreak,
  isCurrentUser,
  index,
}) => {
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

  const getFirstName = (fullName: string) => {
    if (!fullName || !fullName.trim()) return 'Student';
    return fullName.trim().split(' ')[0];
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={cn(
        'bg-white rounded-xl p-4 flex items-center gap-4',
        isCurrentUser && 'ring-2 ring-primary',
        rank <= 3 && 'shadow-md'
      )}
    >
      {/* Rank */}
      <div className="flex-shrink-0 w-12 text-center">
        {getRankIcon() || (
          <span
            className="text-xl font-bold"
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
            <span className="text-white font-bold">
              {getInitials(studentName || 'Student')}
            </span>
          }
          size="md"
        />
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-gray-900">
          {getFirstName(studentName)}
          {isCurrentUser && (
            <span
              className="ml-2 text-xs font-normal"
              style={{ color: colors.primary.DEFAULT }}
            >
              (You)
            </span>
          )}
        </p>
      </div>

      {/* Score & Streak */}
      <div className="text-right">
        <div className="flex flex-col items-end gap-1">
          <p
            className="text-lg font-bold"
            style={{ color: getRankColor() }}
          >
            {formatNumber(score)}
          </p>
          <p className="text-xs text-gray-500">score</p>
          <div className="flex items-center gap-1 text-xs" style={{ color: colors.warning }}>
            <Icon name="flame" size="sm" color={colors.warning} />
            <span>{currentStreak || 0} day{currentStreak !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
