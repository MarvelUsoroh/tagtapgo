/**
 * ProfileHeader Component
 * Digital Student ID Card - Revolut-style card design
 * Requirements: 7.2, 7.3, 7.4, 7.5, 42.1-42.7
 */

import React from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/icons';
import { cn } from '@/lib/utils';


export interface ProfileHeaderProps {
  avatarUrl?: string;
  name: string;
  level: number;
  points: number;
  studentId?: string;
  className?: string;
}

/**
 * ProfileHeader Component
 * Digital student ID card with brand color background
 * Inspired by Revolut's card design in wallet apps
 */
export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  avatarUrl,
  name,
  level,
  points,
  studentId,
  className,
}) => {
  return (
    <div 
      className={cn(
        'relative overflow-hidden rounded-2xl p-5 sm:p-6',
        'shadow-xl',
        className
      )}
      style={{
        backgroundColor: '#fbbf24',
      }}
    >
      {/* Decorative Pattern - Scaled for mobile */}
      <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 opacity-10 pointer-events-none">
        <div className="absolute top-4 right-4 w-24 sm:w-32 h-24 sm:h-32 rounded-full border-4 border-white" />
        <div className="absolute top-10 sm:top-12 right-10 sm:right-12 w-16 sm:w-24 h-16 sm:h-24 rounded-full border-4 border-white" />
      </div>

      {/* Decorative Chip Effect */}
      <div className="absolute top-1/2 right-6 -translate-y-1/2 w-10 sm:w-12 h-8 sm:h-10 rounded-lg bg-white/20 backdrop-blur-md border border-white/20 pointer-events-none hidden sm:block" />

      {/* Card Content */}
      <div className="relative z-10">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-5 sm:mb-6">
          <div>
            <p className="text-white/80 text-[10px] sm:text-xs font-medium uppercase tracking-wider mb-1">
              Student ID Card
            </p>
            <p className="text-white/60 text-xs sm:text-sm font-mono tracking-wide">
              {studentId || '••••••••'}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full backdrop-blur-sm border border-white/10 shadow-sm">
            <Icon name="ribbon" size="sm" color="white" />
            <span className="text-white text-xs sm:text-sm font-bold">
              Level {level}
            </span>
          </div>
        </div>

        {/* Main Content - Flex wrapped for extreme small screens */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-2 sm:mt-4">
          {/* Avatar and Name */}
          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
            <div className="relative flex-shrink-0 text-white">
              <Avatar
                src={avatarUrl}
                alt={name}
                size="lg" // Scaled down avatar slightly for better mobile fit
                className="ring-4 ring-white/30 sm:w-16 sm:h-16 shadow-md bg-white/10"
                fallbackIcon={<Icon name="person" size="md" color="white" />}
              />
            </div>
            
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-0.5 truncate pr-2 drop-shadow-sm">
                {name}
              </h2>
              <div className="flex items-center gap-1.5 opacity-90">
                <Icon name="school" size="sm" color="white" />
                <span className="text-white/90 text-xs sm:text-sm truncate font-medium">
                  Active Student
                </span>
              </div>
            </div>
          </div>

          {/* Points Display */}
          <div className="text-left sm:text-right flex-shrink-0 bg-white/10 sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none border border-white/10 sm:border-transparent backdrop-blur-md sm:backdrop-blur-none mt-2 sm:mt-0 shadow-sm sm:shadow-none">
            <p className="text-white/80 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1">
              Balance
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-white drop-shadow-md">
                {points.toLocaleString()}
              </span>
              <span className="text-white/90 text-xs sm:text-sm font-bold tracking-wide">
                pts
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
