'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { colors } from '@/lib/theme';

interface AttendanceGoalProgressProps {
  current: number;
  target: number;
  status: 'on_track' | 'behind' | 'achieved';
  animated?: boolean;
  className?: string;
}

// Status color mapping
const statusColors = {
  achieved: colors.success,
  on_track: colors.primary.DEFAULT,
  behind: colors.danger,
} as const;

export default function AttendanceGoalProgress({
  current,
  target,
  status,
  animated = true,
  className,
}: AttendanceGoalProgressProps) {
  // Calculate progress percentage (capped at 100%)
  const progressPercentage = Math.min((current / target) * 100, 100);
  const statusColor = statusColors[status];

  // Milestone markers at 25%, 50%, 75%, 100%
  const milestones = [25, 50, 75, 100];

  return (
    <div className={cn('w-full', className)}>
      {/* Progress bar container */}
      <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
        {/* Animated fill */}
        <motion.div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{ backgroundColor: statusColor }}
          initial={{ width: 0 }}
          animate={{ width: `${progressPercentage}%` }}
          transition={{
            duration: animated ? 1.2 : 0,
            ease: 'easeOut',
          }}
        />

        {/* Milestone markers */}
        {milestones.map((milestone) => {
          const milestonePosition = (milestone / target) * 100;
          if (milestonePosition > 100) return null;

          return (
            <div
              key={milestone}
              className="absolute top-0 h-full w-0.5 bg-white/50"
              style={{ left: `${milestonePosition}%` }}
            />
          );
        })}
      </div>

      {/* Percentage label */}
      <div className="mt-2 flex items-center justify-between">
        <span
          className="text-sm font-semibold"
          style={{ color: statusColor }}
        >
          {current.toFixed(1)}%
        </span>
        <span className="text-sm text-gray-500">
          Target: {target}%
        </span>
      </div>
    </div>
  );
}
