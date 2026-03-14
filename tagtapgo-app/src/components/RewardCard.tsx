'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { IoTrendingUp, IoSparkles } from 'react-icons/io5';
import { colors } from '@/lib/theme';
import { cn, formatNumber } from '@/lib/utils';
import { cardHover, buttonPress } from '@/lib/animations';
import type { Reward } from '@/lib/supabase';
import { trackRewardView, getOrCreateSessionId } from '@/lib/reward-analytics';

interface RewardCardProps {
  reward: Reward;
  onRedeem: (rewardId: string) => void;
  disabled?: boolean;
  studentId?: string;
  referralSource?: 'browse' | 'notification' | 'leaderboard' | 'achievement' | 'search';
}

export default function RewardCard({ 
  reward, 
  onRedeem, 
  disabled = false,
  studentId,
  referralSource = 'browse'
}: RewardCardProps) {
  
  // Track view when card is clicked
  const handleClick = () => {
    if (disabled) return;
    
    // Track the view
    if (studentId) {
      const sessionId = getOrCreateSessionId();
      trackRewardView(studentId, reward.id, referralSource, sessionId);
    }
    
    // Call the redeem handler
    onRedeem(reward.id);
  };
  
  const getBadgeStyles = (badge: string) => {
    if (badge === 'popular') {
      return {
        bg: colors.primary.DEFAULT,
        text: 'white',
      };
    }
    return {
      bg: colors.secondary.DEFAULT,
      text: 'white',
    };
  };

  const badge = reward.stock > 100 ? 'popular' : reward.created_at && new Date(reward.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) ? 'new' : null;
  const badgeStyles = badge ? getBadgeStyles(badge) : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      {...(disabled ? {} : cardHover)}
      transition={{ duration: 0.2 }}
      className={cn(
        'bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-200 relative',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {/* Badge overlay */}
      {badge && badgeStyles && (
        <div
          className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-semibold flex items-center space-x-1 z-10"
          style={{ backgroundColor: badgeStyles.bg, color: badgeStyles.text }}
        >
          {badge === 'popular' ? (
            <>
              <IoTrendingUp size={12} />
              <span>Popular</span>
            </>
          ) : (
            <>
              <IoSparkles size={12} />
              <span>New</span>
            </>
          )}
        </div>
      )}

      {/* Image/Icon */}
      <div className="relative h-40 bg-gray-100 flex items-center justify-center">
        {reward.image_url ? (
          <Image
            src={reward.image_url}
            alt={reward.name}
            fill
            sizes="100vw"
            className="object-cover"
            priority={false}
          />
        ) : (
          <span className="text-6xl">🎁</span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="mb-2">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.gray[500] }}>
            {reward.brand}
          </p>
          <h3 className="text-lg font-bold mt-1" style={{ color: colors.gray[900] }}>
            {reward.name}
          </h3>
        </div>

        <p className="text-sm mb-4 line-clamp-2" style={{ color: colors.gray[600] }}>
          {reward.description || 'Redeem this reward with your points!'}
        </p>

        {/* Cost and Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            <span className="text-2xl">💎</span>
            <span className="text-xl font-bold" style={{ color: colors.primary.DEFAULT }}>
              {formatNumber(reward.points_cost)}
            </span>
            <span className="text-sm" style={{ color: colors.gray[500] }}>pts</span>
          </div>

          <motion.button
            {...(disabled ? {} : buttonPress)}
            onClick={handleClick}
            disabled={disabled}
            className="font-semibold px-4 py-2 rounded-lg transition-colors duration-200"
            style={{
              backgroundColor: disabled ? colors.gray[300] : colors.primary.DEFAULT,
              color: 'white',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            Redeem
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
