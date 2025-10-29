/**
 * Skeleton Loading Components
 * Reusable skeleton loaders with shimmer animation
 */

'use client';

import { cn } from '@/lib/utils';
import type { ComponentType } from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animate?: boolean;
}

/**
 * Base Skeleton component
 */
export function Skeleton({
  className,
  variant = 'rectangular',
  width,
  height,
  animate = true,
}: SkeletonProps) {
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <div
      className={cn(
        'bg-gray-200',
        variantClasses[variant],
        animate && 'animate-shimmer',
        className
      )}
      style={{
        width: width || '100%',
        height: height || (variant === 'text' ? '1em' : '100%'),
      }}
    />
  );
}

/**
 * Skeleton Card - matches StatCard layout
 */
export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-md p-4 text-center min-w-[120px] sm:min-w-[140px]">
      <div className="mx-auto mb-2 flex justify-center">
        <Skeleton variant="circular" width={24} height={24} />
      </div>
      <Skeleton className="mx-auto mb-2" width="60%" height={32} />
      <Skeleton className="mx-auto" width="80%" height={16} />
    </div>
  );
}

/**
 * Skeleton Badge - matches BadgeIcon layout
 */
export function SkeletonBadge({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeConfig = {
    sm: { container: 80, icon: 20 },
    md: { container: 96, icon: 28 },
    lg: { container: 128, icon: 36 },
  };

  const config = sizeConfig[size];

  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white shadow-md">
      <Skeleton variant="circular" width={config.container} height={config.container} />
      <Skeleton width="80%" height={16} />
      <Skeleton width="60%" height={12} />
    </div>
  );
}

/**
 * Skeleton Reward Card - matches RewardCard layout
 */
export function SkeletonRewardCard() {
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <Skeleton height={160} className="rounded-none" />
      <div className="p-4">
        <Skeleton width="40%" height={12} className="mb-2" />
        <Skeleton width="80%" height={20} className="mb-2" />
        <Skeleton width="100%" height={40} className="mb-4" />
        <div className="flex items-center justify-between">
          <Skeleton width={80} height={32} />
          <Skeleton width={80} height={40} />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton List Item - for leaderboard entries
 */
export function SkeletonListItem() {
  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg">
      <div className="flex items-center space-x-3 flex-1">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1">
          <Skeleton width="60%" height={16} className="mb-2" />
          <Skeleton width="40%" height={12} />
        </div>
      </div>
      <Skeleton width={60} height={20} />
    </div>
  );
}

/**
 * Skeleton Class Item - for today's classes
 */
export function SkeletonClassItem() {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
      <div className="flex items-center space-x-3">
        <Skeleton variant="circular" width={12} height={12} />
        <div>
          <Skeleton width={120} height={16} className="mb-1" />
          <Skeleton width={60} height={12} />
        </div>
      </div>
      <Skeleton width={40} height={24} />
    </div>
  );
}

/**
 * Skeleton Grid - for achievement/reward grids
 */
export function SkeletonGrid({
  count = 6,
  columns = 2,
  itemComponent: ItemComponent = SkeletonBadge,
}: {
  count?: number;
  columns?: number;
  itemComponent?: ComponentType<object>;
}) {
  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <ItemComponent key={index} />
      ))}
    </div>
  );
}

/**
 * Skeleton Page - full page loading state
 */
export function SkeletonPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b p-6">
        <Skeleton width={200} height={32} className="mb-2" />
        <Skeleton width={150} height={16} />
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        <Skeleton height={100} />
        <Skeleton height={200} />
        <Skeleton height={150} />
      </div>
    </div>
  );
}
