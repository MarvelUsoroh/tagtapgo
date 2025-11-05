'use client';

import { motion } from 'framer-motion';
import { Target, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { colors, animations } from '@/lib/theme';
import AttendanceGoalProgress from './AttendanceGoalProgress';

interface AttendanceGoalCardProps {
  current: number;
  target: number;
  status: 'on_track' | 'behind' | 'achieved';
  goalType: 'weekly' | 'monthly';
  classesAttended: number;
  totalClasses: number;
  onClick?: () => void;
  className?: string;
}

// Status messages
const statusMessages = {
  achieved: "🎉 Goal achieved! Keep it up!",
  on_track: "💪 You're on track! Keep going!",
  behind: "⚠️ You're falling behind. Let's catch up!",
} as const;

// Status icons
const statusIcons = {
  achieved: CheckCircle,
  on_track: TrendingUp,
  behind: AlertCircle,
} as const;

export default function AttendanceGoalCard({
  current,
  target,
  status,
  goalType,
  classesAttended,
  totalClasses,
  onClick,
  className,
}: AttendanceGoalCardProps) {
  const StatusIcon = statusIcons[status];
  const message = statusMessages[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: parseFloat(animations.duration.normal) / 1000 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'bg-white rounded-xl shadow-md p-5',
        'transition-shadow duration-300 hover:shadow-lg',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target size={24} style={{ color: colors.primary.DEFAULT }} />
          <h3 className="text-lg font-semibold text-gray-900">
            Attendance Goal
          </h3>
        </div>
        <span className="text-xs font-medium text-gray-500 uppercase">
          {goalType}
        </span>
      </div>

      {/* Progress display */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-bold text-gray-900">
            {current.toFixed(1)}%
          </span>
          <span className="text-lg text-gray-500">
            / {target}%
          </span>
        </div>
        <p className="text-sm text-gray-600">
          {classesAttended} of {totalClasses} classes attended
        </p>
      </div>

      {/* Progress bar */}
      <AttendanceGoalProgress
        current={current}
        target={target}
        status={status}
        animated={true}
        className="mb-4"
      />

      {/* Status message */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
        <StatusIcon
          size={20}
          style={{
            color:
              status === 'achieved'
                ? colors.success
                : status === 'on_track'
                ? colors.primary.DEFAULT
                : colors.danger,
          }}
        />
        <p className="text-sm font-medium text-gray-700">{message}</p>
      </div>

      {/* Click hint */}
      {onClick && (
        <p className="text-xs text-gray-500 text-center mt-3">
          Tap to customize your goal
        </p>
      )}
    </motion.div>
  );
}
