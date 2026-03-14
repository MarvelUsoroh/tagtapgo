import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps {
  count: number;
  max?: number;
  variant?: 'primary' | 'danger' | 'warning';
  size?: 'sm' | 'md';
  show?: boolean;
  className?: string;
}

/**
 * Badge Component
 * Notification badge for displaying counts
 * Automatically hides when count is 0
 */
export const Badge: React.FC<BadgeProps> = ({
  count,
  max = 99,
  variant = 'primary',
  size = 'md',
  show = true,
  className,
}) => {
  // Hide badge when count is 0 or show is false
  if (count === 0 || !show) {
    return null;
  }
  
  const displayCount = count > max ? `${max}+` : count;
  
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-full';
  
  const variantStyles = {
    primary: 'bg-brand text-white',
    danger: 'bg-error text-white',
    warning: 'bg-warning text-white',
  };
  
  const sizeStyles = {
    sm: 'min-w-[16px] h-4 px-1 text-xs',
    md: 'min-w-[20px] h-5 px-1.5 text-xs',
  };
  
  return (
    <span
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      aria-label={`${count} notifications`}
    >
      {displayCount}
    </span>
  );
};
