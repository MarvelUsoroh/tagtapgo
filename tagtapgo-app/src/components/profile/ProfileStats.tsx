/**
 * ProfileStats Component
 * Displays user statistics in a grid layout
 * Requirements: 7.2, 7.3, 7.4
 */

import React from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { cn } from '@/lib/utils';

export interface ProfileStatsProps {
  stats: {
    attendance: number;
    achievements: number;
    streak: number;
    totalPoints: number;
  };
  className?: string;
}

/**
 * ProfileStats Component
 * Displays user statistics using StatCard components in a responsive grid
 */
export const ProfileStats: React.FC<ProfileStatsProps> = ({
  stats,
  className,
}) => {
  return (
    <div className={cn('grid grid-cols-2 gap-4', className)}>
      {/* Attendance */}
      <StatCard
        label="Attendance"
        value={`${stats.attendance}%`}
        icon="calendar"
        trend={stats.attendance >= 80 ? 'up' : undefined}
      />
      
      {/* Achievements */}
      <StatCard
        label="Achievements"
        value={stats.achievements.toString()}
        icon="trophy"
      />
      
      {/* Streak */}
      <StatCard
        label="Streak"
        value={`${stats.streak} days`}
        icon="flame"
        trend={stats.streak > 0 ? 'up' : undefined}
      />
      
      {/* Total Points */}
      <StatCard
        label="Total Points"
        value={stats.totalPoints.toLocaleString()}
        icon="cash"
      />
    </div>
  );
};
