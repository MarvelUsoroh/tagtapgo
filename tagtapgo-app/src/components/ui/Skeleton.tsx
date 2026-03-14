import React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  className?: string;
}

/**
 * Skeleton Component
 * Loading placeholder with shimmer animation
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rectangular',
  width,
  height,
  className,
}) => {
  const baseStyles = 'bg-neutral-200 animate-pulse';
  
  const variantStyles = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  };
  
  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;
  
  return (
    <div
      className={cn(
        baseStyles,
        variantStyles[variant],
        className
      )}
      style={style}
      aria-hidden="true"
    />
  );
};
