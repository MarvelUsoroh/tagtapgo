/**
 * ProgressBar Component
 * Animated progress bar with smooth filling animation
 */

'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { colors } from '@/lib/theme';

interface ProgressBarProps {
  value: number; // 0-100
  max?: number; // Default 100
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'gold';
  height?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
  animate?: boolean;
  duration?: number; // Animation duration in seconds
}

const colorMap = {
  primary: colors.primary.DEFAULT,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  gold: colors.rank.gold,
} as const;

const heightMap = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
} as const;

export default function ProgressBar({
  value,
  max = 100,
  color = 'primary',
  height = 'md',
  showLabel = false,
  className,
  animate = true,
  duration = 0.8,
}: ProgressBarProps) {
  // Calculate percentage
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      
      <div className={cn('w-full bg-gray-200 rounded-full overflow-hidden', heightMap[height])}>
        <motion.div
          initial={animate ? { width: 0 } : { width: `${percentage}%` }}
          animate={{ width: `${percentage}%` }}
          transition={{
            duration,
            ease: [0.4, 0, 0.2, 1], // Custom easing for smooth animation
          }}
          className={cn('h-full rounded-full')}
          style={{ backgroundColor: colorMap[color] }}
        />
      </div>
    </div>
  );
}
