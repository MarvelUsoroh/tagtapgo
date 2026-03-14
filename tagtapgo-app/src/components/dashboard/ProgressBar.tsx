/**
 * ProgressBar Component
 * Displays a progress bar with optional label and percentage
 */

'use client';

import { motion } from 'framer-motion';
import { colors } from '@/lib/theme';

interface ProgressBarProps {
  value: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  height?: 'sm' | 'md' | 'lg';
  color?: string;
}

export function ProgressBar({ 
  value, 
  label, 
  showPercentage = false,
  height = 'md',
  color = colors.primary.DEFAULT
}: ProgressBarProps) {
  // Clamp value between 0 and 100
  const clampedValue = Math.min(100, Math.max(0, value));
  
  const heightClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-2">
          {label && <span className="text-sm text-gray-700">{label}</span>}
          {showPercentage && (
            <span className="text-sm font-medium text-gray-900">
              {Math.round(clampedValue)}%
            </span>
          )}
        </div>
      )}
      <div 
        className={`w-full bg-gray-200 rounded-full overflow-hidden ${heightClasses[height]}`}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${clampedValue}%` }}
          transition={{ 
            duration: 0.5, 
            ease: 'easeOut' 
          }}
        />
      </div>
    </div>
  );
}
