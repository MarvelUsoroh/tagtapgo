/**
 * RewardCard Component
 * Displays individual reward with image, title, description, and points cost
 * Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 26.1-26.7
 */

'use client';

import React from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { Reward } from '@/lib/supabase';
import { trackRewardView, getOrCreateSessionId } from '@/lib/reward-analytics';
import {
  IoGiftOutline,
  IoStorefrontOutline,
  IoCafeOutline,
  IoFastFoodOutline,
  IoShirtOutline,
  IoGameControllerOutline,
  IoTicketOutline,
  IoCardOutline,
} from 'react-icons/io5';

interface RewardCardProps {
  reward: Reward;
  onRedeem: (rewardId: string) => void;
  disabled?: boolean;
  studentId?: string;
  referralSource?: 'browse' | 'notification' | 'leaderboard' | 'achievement' | 'search';
}

/**
 * Get category icon based on reward category
 * Uses Ionicons for professional appearance
 */
const getCategoryIcon = (category?: string) => {
  const iconProps = { size: 20, className: 'text-brand' };
  
  switch (category?.toLowerCase()) {
    case 'food':
    case 'dining':
      return <IoFastFoodOutline {...iconProps} />;
    case 'coffee':
    case 'cafe':
      return <IoCafeOutline {...iconProps} />;
    case 'retail':
    case 'shopping':
      return <IoStorefrontOutline {...iconProps} />;
    case 'clothing':
    case 'apparel':
      return <IoShirtOutline {...iconProps} />;
    case 'entertainment':
    case 'gaming':
      return <IoGameControllerOutline {...iconProps} />;
    case 'events':
    case 'tickets':
      return <IoTicketOutline {...iconProps} />;
    case 'gift card':
    case 'voucher':
      return <IoCardOutline {...iconProps} />;
    default:
      return <IoGiftOutline {...iconProps} />;
  }
};

/**
 * RewardCard Component
 * 
 * Features:
 * - Uses Card component as base with subtle shadow elevation
 * - Displays reward image optimized with Next.js Image component
 * - Shows title, description, and points cost
 * - Uses Ionicons for reward categories
 * - Brand color (#4ADE80) for redeem button
 * - Visual feedback on tap within 50ms (active:scale-98)
 * - No gradient backgrounds (flat design)
 * - Lazy loading for images
 */
export default function RewardCard({
  reward,
  onRedeem,
  disabled = false,
  studentId,
  referralSource = 'browse',
}: RewardCardProps) {
  const handleRedeem = () => {
    if (disabled) return;

    // Track the view
    if (studentId) {
      const sessionId = getOrCreateSessionId();
      trackRewardView(studentId, reward.id, referralSource, sessionId);
    }

    // Call the redeem handler
    onRedeem(reward.id);
  };

  return (
    <Card
      elevation="sm"
      padding="none"
      className={cn(
        'overflow-hidden transition-all duration-200',
        !disabled && 'active:scale-[0.98]',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {/* Image Section */}
      <div className="relative h-40 bg-neutral-50 flex items-center justify-center">
        {reward.image_url ? (
          <Image
            src={reward.image_url}
            alt={reward.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
            loading="lazy"
            placeholder="blur"
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWEREiMxUf/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
          />
        ) : (
          <div className="text-neutral-300">
            <IoGiftOutline size={64} />
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-md">
        {/* Category and Brand */}
        <div className="flex items-center gap-2 mb-sm">
          {getCategoryIcon(reward.category)}
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {reward.brand}
          </p>
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-neutral-900 mb-sm line-clamp-1">
          {reward.name}
        </h3>

        {/* Description */}
        <p className="text-sm text-neutral-600 mb-md line-clamp-2 min-h-[40px]">
          {reward.description || 'Redeem this reward with your points!'}
        </p>

        {/* Points Cost and Redeem Button */}
        <div className="flex items-center justify-between gap-md">
          {/* Points Cost */}
          <div className="flex items-center gap-1">
            <span className="text-2xl font-bold text-brand">
              {reward.points_cost.toLocaleString()}
            </span>
            <span className="text-sm text-neutral-500">pts</span>
          </div>

          {/* Redeem Button */}
          <Button
            variant="primary"
            size="md"
            onClick={handleRedeem}
            disabled={disabled}
            className="flex-shrink-0"
          >
            Redeem
          </Button>
        </div>
      </div>
    </Card>
  );
}
