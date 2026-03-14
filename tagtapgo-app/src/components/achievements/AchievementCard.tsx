/**
 * AchievementCard Component
 * Duolingo-style compact achievement badge
 * Requirements: 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 47.1-47.7
 */

'use client';

import React from 'react';
import { Icon } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { Achievement } from '@/lib/supabase';

interface AchievementCardProps {
  achievement: Achievement;
  isUnlocked: boolean;
  progress?: number;
  onClick?: () => void;
}

/**
 * Get achievement icon based on category or type
 */
const getAchievementIcon = (achievement: Achievement): 'calendar' | 'cash' | 'flame' | 'people' | 'school' | 'star' | 'trophy' | 'checkmarkFilled' | 'target' | 'heart' | 'ribbon' => {
  const category = achievement.category?.toLowerCase() || '';
  const name = achievement.name.toLowerCase();
  
  // Category-based icons
  if (category.includes('attendance')) return 'calendar';
  if (category.includes('points')) return 'cash';
  if (category.includes('streak')) return 'flame';
  if (category.includes('social')) return 'people';
  if (category.includes('learning')) return 'school';
  
  // Name-based icons
  if (name.includes('first') || name.includes('beginner')) return 'star';
  if (name.includes('master') || name.includes('expert')) return 'trophy';
  if (name.includes('perfect')) return 'checkmarkFilled';
  if (name.includes('streak')) return 'flame';
  if (name.includes('friend')) return 'people';
  
  // Default
  return 'trophy';
};

/**
 * Get achievement color based on category or type
 * Returns background color and shadow color for unlocked state
 */
const getAchievementColor = (achievement: Achievement): { bg: string; shadow: string } => {
  const category = achievement.category?.toLowerCase() || '';
  const name = achievement.name.toLowerCase();
  
  // Streak achievements - Orange/Gold (fire theme)
  if (category.includes('streak') || name.includes('streak') || name.includes('fire')) {
    return { bg: '#F59E0B', shadow: 'rgba(245, 158, 11, 0.3)' }; // Amber-500
  }
  
  // Points/Cash achievements - Gold
  if (category.includes('points') || name.includes('points') || name.includes('earn')) {
    return { bg: '#EAB308', shadow: 'rgba(234, 179, 8, 0.3)' }; // Yellow-500
  }
  
  // Attendance achievements - Blue
  if (category.includes('attendance') || name.includes('attendance') || name.includes('present')) {
    return { bg: '#3B82F6', shadow: 'rgba(59, 130, 246, 0.3)' }; // Blue-500
  }
  
  // Social achievements - Pink/Purple
  if (category.includes('social') || name.includes('friend') || name.includes('community')) {
    return { bg: '#EC4899', shadow: 'rgba(236, 72, 153, 0.3)' }; // Pink-500
  }
  
  // Learning achievements - Purple
  if (category.includes('learning') || name.includes('learn') || name.includes('study')) {
    return { bg: '#8B5CF6', shadow: 'rgba(139, 92, 246, 0.3)' }; // Violet-500
  }
  
  // Perfect/Master achievements - Gold
  if (name.includes('perfect') || name.includes('master') || name.includes('expert')) {
    return { bg: '#F59E0B', shadow: 'rgba(245, 158, 11, 0.3)' }; // Amber-500
  }
  
  // Beginner/First achievements - Green (brand color)
  if (name.includes('first') || name.includes('beginner') || name.includes('start')) {
    return { bg: '#4ADE80', shadow: 'rgba(74, 222, 128, 0.3)' }; // Brand green
  }
  
  // Default - Brand green
  return { bg: '#4ADE80', shadow: 'rgba(74, 222, 128, 0.3)' };
};

/**
 * AchievementCard Component - Duolingo Style
 * 
 * Features:
 * - Compact, icon-focused design
 * - Large circular badge with icon
 * - Minimal text (title only, description on tap)
 * - Brand color (#4ADE80) for unlocked achievements
 * - Grayscale for locked achievements
 * - Small progress indicator for in-progress
 * - 3 per row on mobile, 4-5 on larger screens
 */
export default function AchievementCard({
  achievement,
  isUnlocked,
  progress = 0,
  onClick,
}: AchievementCardProps) {
  const iconName = getAchievementIcon(achievement);
  const colors = getAchievementColor(achievement);
  const isInProgress = !isUnlocked && progress > 0;
  
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center p-3 rounded-xl transition-all duration-200',
        'hover:bg-gray-50 active:scale-95',
        onClick && 'cursor-pointer',
        !isUnlocked && 'opacity-60'
      )}
    >
      {/* Circular Badge */}
      <div className="relative mb-2">
        {/* Main Circle */}
        <div
          className={cn(
            'w-16 h-16 rounded-full flex items-center justify-center shadow-md transition-all'
          )}
          style={{
            backgroundColor: isUnlocked ? colors.bg : '#E5E7EB',
            boxShadow: isUnlocked ? `0 4px 12px ${colors.shadow}` : '0 2px 4px rgba(0, 0, 0, 0.1)'
          }}
        >
          <Icon
            name={iconName}
            size="lg"
            color={isUnlocked ? 'white' : '#9CA3AF'}
          />
        </div>

        {/* Progress Ring (for in-progress achievements) */}
        {isInProgress && (
          <svg
            className="absolute top-0 left-0 w-16 h-16 -rotate-90"
            viewBox="0 0 64 64"
          >
            <circle
              cx="32"
              cy="32"
              r="30"
              fill="none"
              stroke="#E5E7EB"
              strokeWidth="3"
            />
            <circle
              cx="32"
              cy="32"
              r="30"
              fill="none"
              stroke={colors.bg}
              strokeWidth="3"
              strokeDasharray={`${(progress / 100) * 188.4} 188.4`}
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* Unlocked Checkmark Badge */}
        {isUnlocked && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
            <Icon name="checkmarkFilled" size="sm" color={colors.bg} />
          </div>
        )}

        {/* Locked Icon Badge */}
        {!isUnlocked && !isInProgress && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
            <Icon name="lock" size="sm" color="#9CA3AF" />
          </div>
        )}
      </div>

      {/* Title */}
      <h3
        className={cn(
          'text-xs font-semibold text-center line-clamp-2 min-h-[32px]',
          isUnlocked ? 'text-gray-900' : 'text-gray-400'
        )}
      >
        {achievement.name}
      </h3>

      {/* Points (small, subtle) */}
      {achievement.points_reward > 0 && (
        <div className="flex items-center gap-0.5 mt-1">
          <Icon name="cash" size="sm" color={isUnlocked ? colors.bg : '#9CA3AF'} />
          <span
            className={cn(
              'text-xs font-medium',
              isUnlocked ? 'text-gray-700' : 'text-gray-400'
            )}
            style={{ color: isUnlocked ? colors.bg : undefined }}
          >
            {achievement.points_reward}
          </span>
        </div>
      )}
    </button>
  );
}
