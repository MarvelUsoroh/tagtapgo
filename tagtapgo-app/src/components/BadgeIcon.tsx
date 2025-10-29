'use client';

import { motion } from 'framer-motion';
import { Lock, Trophy, Flame, Clock, Users, Gift, Star } from 'lucide-react';
import { colors, rarityPalette, categoryAccents, categoryPalette } from '@/lib/theme';
import { cn, formatDate, calculatePercentage, triggerConfetti } from '@/lib/utils';
import type { Achievement, StudentAchievement } from '@/lib/supabase';
import ProgressBar from './ProgressBar';

type BadgeState = 'earned' | 'locked' | 'in-progress';

interface BadgeIconProps {
  achievement: Achievement;
  studentAchievement?: StudentAchievement;
  size?: 'sm' | 'md' | 'lg';
  showProgress?: boolean;
  onClick?: () => void;
}

const categoryIcons = {
  attendance: Trophy,
  streak: Flame,
  time: Clock,
  social: Users,
  reward: Gift,
  special: Star,
};

export default function BadgeIcon({
  achievement,
  studentAchievement,
  size = 'md',
  showProgress = true,
  onClick,
}: BadgeIconProps) {
  // Type guard for progress payload shape
  function isNumericProgress(p: unknown): p is { current: number; target: number } {
    if (typeof p !== 'object' || p === null) return false;
    const rec = p as Record<string, unknown>;
    return (
      'current' in rec &&
      'target' in rec &&
      typeof rec.current === 'number' &&
      typeof rec.target === 'number'
    );
  }

  // Determine badge state
  const isEarned = !!studentAchievement?.unlocked_at;
  const progress = studentAchievement?.progress;
  const hasProgress = isNumericProgress(progress);
  const progressPercentage = hasProgress
    ? calculatePercentage(progress.current, progress.target)
    : 0;
  const isInProgress = !isEarned && progressPercentage > 0;
  
  const state: BadgeState = isEarned ? 'earned' : isInProgress ? 'in-progress' : 'locked';

  // Size configurations
  const sizeConfig = {
    sm: { container: 'w-20 h-20', icon: 20, text: 'text-xs' },
    md: { container: 'w-24 h-24', icon: 28, text: 'text-sm' },
    lg: { container: 'w-32 h-32', icon: 36, text: 'text-base' },
  };

  const config = sizeConfig[size];
  const Icon = categoryIcons[achievement.category] || Trophy;

  const rarityKey = achievement.rarity as keyof typeof rarityPalette;
  const rarityColors = rarityPalette[rarityKey] ?? rarityPalette.common;

  // Category accent colors for progress ring and accents (from theme)
  const accentColor = categoryAccents[achievement.category] ?? colors.primary.DEFAULT;
  const categoryColors = categoryPalette[achievement.category] ?? { gradFrom: colors.primary.light, gradTo: colors.primary.dark };

  // Handle click with confetti for earned badges
  const handleClick = () => {
    if (state === 'earned') {
      // Use category-based colors so confetti matches the badge visuals
      const categoryConfettiColors: string[] = [
        categoryColors.gradFrom,
        categoryColors.gradTo,
        accentColor,
      ];

      triggerConfetti({
        particleCount: achievement.rarity === 'legendary' ? 75 : 50,
        spread: achievement.rarity === 'legendary' ? 90 : 70,
        colors: categoryConfettiColors,
      });
    }
    
    if (onClick) {
      onClick();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: onClick || state === 'earned' ? 1.05 : 1 }}
      whileTap={{ scale: onClick || state === 'earned' ? 0.95 : 1 }}
      onClick={handleClick}
      className={cn(
        'relative flex flex-col items-center gap-2 p-4 rounded-xl transition-all duration-300 border-2',
        (onClick || state === 'earned') && 'cursor-pointer',
        state === 'earned' && 'bg-white shadow-lg',
        state === 'in-progress' && 'bg-white shadow-md',
        state === 'locked' && 'bg-gray-50'
      )}
      style={{
        borderColor: state === 'locked' ? colors.gray[200] : accentColor,
      }}
    >
      {/* Badge Icon Container */}
      <div className="relative">
        <div
          className={cn(
            config.container,
            'rounded-full flex items-center justify-center relative overflow-hidden transition-all duration-300',
            state === 'earned' && 'shadow-lg',
            state === 'locked' && 'grayscale opacity-40'
          )}
          style={{
            background: state === 'earned'
              ? `linear-gradient(135deg, ${categoryColors.gradFrom}, ${categoryColors.gradTo})`
              : colors.gray[200],
          }}
        >
          {state === 'in-progress' && (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${categoryColors.gradFrom}, ${categoryColors.gradTo})`,
                opacity: 0.3,
              }}
            />
          )}

          <Icon
            size={config.icon}
            className="relative z-10"
            style={{ 
              color: state === 'earned' ? 'white' : colors.gray[400],
              filter: state === 'earned' ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none',
            }}
          />

          {state === 'locked' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-20">
              <Lock size={config.icon * 0.5} color="white" />
            </div>
          )}
        </div>

        {/* Glow effect for earned badges */}
        {state === 'earned' && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: `linear-gradient(135deg, ${categoryColors.gradFrom}, ${categoryColors.gradTo})`,
              filter: 'blur(12px)',
              opacity: 0.4,
            }}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.4, 0.6, 0.4],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}

        {/* Progress ring for in-progress badges */}
        {state === 'in-progress' && showProgress && (
          <svg
            className="absolute inset-0 -rotate-90"
            style={{ width: '100%', height: '100%' }}
          >
            <circle
              cx="50%"
              cy="50%"
              r="45%"
              fill="none"
              stroke={colors.gray[200]}
              strokeWidth="3"
            />
            <circle
              cx="50%"
              cy="50%"
              r="45%"
              fill="none"
              stroke={accentColor}
              strokeWidth="3"
              strokeDasharray={`${progressPercentage * 2.83} 283`}
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>

      {/* Badge Name */}
      <div className="text-center">
        <p
          className={cn(config.text, 'font-semibold line-clamp-2')}
          style={{ color: state === 'locked' ? colors.gray[400] : colors.gray[900] }}
        >
          {achievement.name}
        </p>

        {/* Earned date or progress */}
        {state === 'earned' && studentAchievement?.unlocked_at && (
          <p className="text-xs mt-1" style={{ color: colors.gray[500] }}>
            {formatDate(studentAchievement.unlocked_at, 'short')}
          </p>
        )}

        {state === 'in-progress' && showProgress && hasProgress && (
          <div className="mt-2 w-full">
            <div className="flex justify-between text-xs mb-1" style={{ color: colors.gray[600] }}>
              <span>{hasProgress ? progress.current : 0}</span>
              <span>{hasProgress ? progress.target : 0}</span>
            </div>
            <ProgressBar
              value={progressPercentage}
              color="primary"
              height="sm"
              animate={true}
              duration={0.8}
            />
          </div>
        )}

        {state === 'locked' && (
          <p className="text-xs mt-1" style={{ color: colors.gray[400] }}>
            Locked
          </p>
        )}
      </div>

      {/* Rarity indicator */}
      {state === 'earned' && (
        <div
          className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium"
          style={{
            backgroundColor: rarityColors.pillBg,
            color: rarityColors.pillText,
          }}
        >
          {achievement.rarity}
        </div>
      )}
    </motion.div>
  );
}
