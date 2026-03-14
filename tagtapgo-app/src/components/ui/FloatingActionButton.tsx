/**
 * FloatingActionButton (FAB) Component
 * A circular floating button for primary actions
 * Commonly used for quick access to key features like messaging
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Icon, IconName } from '@/components/icons';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/utils';

interface FloatingActionButtonProps {
  icon: IconName;
  onClick: () => void;
  label?: string;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  color?: string;
  className?: string;
  badgeCount?: number;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  icon,
  onClick,
  label,
  position = 'bottom-right',
  color = colors.primary.DEFAULT,
  className,
  badgeCount,
}) => {
  const positionClasses = {
    'bottom-right': 'bottom-20 right-4',
    'bottom-left': 'bottom-20 left-4',
    'bottom-center': 'bottom-20 left-1/2 -translate-x-1/2',
  };

  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={cn(
        'fixed z-50',
        'w-14 h-14 rounded-full',
        'flex items-center justify-center',
        'shadow-lg',
        'transition-shadow hover:shadow-xl',
        positionClasses[position],
        className
      )}
      style={{ backgroundColor: color }}
      aria-label={label}
    >
      <Icon name={icon} size="lg" color="#FFFFFF" />
      {/* Badge rendering logic */}
      {badgeCount !== undefined && badgeCount > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 min-w-[24px] h-6 rounded-full flex items-center justify-center px-1 text-xs font-bold text-white shadow-sm border-2 border-white"
          style={{ backgroundColor: colors.danger, zIndex: 60 }}
        >
          {badgeCount > 99 ? '99+' : badgeCount}
        </motion.div>
      )}
    </motion.button>
  );
};
