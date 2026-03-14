/**
 * Achievements Client Component
 * Handles interactivity and filtering
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  IoTrophyOutline,
  IoSparklesOutline,
  IoArrowBackOutline
} from 'react-icons/io5';
import { Container } from '@/components/layout/Container';
import AchievementGrid from '@/components/achievements/AchievementGrid';
import { Icon } from '@/components/icons';
import { colors, achievementCategories, categoryPalette, categoryAccents } from '@/lib/theme';
import { cn, formatNumber, triggerConfetti } from '@/lib/utils';
import type { Achievement, StudentAchievement } from '@/lib/supabase';

type CategoryKey = keyof typeof achievementCategories | 'all';

interface AchievementWithProgress extends Achievement {
  studentAchievement?: StudentAchievement;
}

interface Props {
  achievements: AchievementWithProgress[];
  unlockedCount: number;
  bonusPoints: number;
}

export default function AchievementsClient({
  achievements: initialAchievements,
  unlockedCount: initialUnlockedCount,
  bonusPoints: initialBonusPoints,
}: Props) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('all');
  const [celebratedAchievements, setCelebratedAchievements] = useState<Set<string>>(new Set());

  // Check for newly unlocked achievements and celebrate
  useEffect(() => {
    const newlyUnlocked = initialAchievements.filter(
      a => a.studentAchievement?.unlocked_at && !celebratedAchievements.has(a.id)
    );

    if (newlyUnlocked.length > 0) {
      // Celebrate the first newly unlocked achievement
      const achievement = newlyUnlocked[0];
      const unlockedDate = new Date(achievement.studentAchievement!.unlocked_at);
      const now = new Date();
      const timeDiff = now.getTime() - unlockedDate.getTime();
      
      // Only celebrate if unlocked within the last 5 seconds (likely just unlocked)
      if (timeDiff < 5000) {
        setTimeout(() => {
          const catColors = categoryPalette[achievement.category] ?? { gradFrom: colors.primary.light, gradTo: colors.primary.dark };
          const accent = categoryAccents[achievement.category] ?? colors.primary.DEFAULT;
          const confettiColors = [catColors.gradFrom, catColors.gradTo, accent];

          triggerConfetti({
            particleCount: achievement.rarity === 'legendary' ? 75 : 50,
            spread: achievement.rarity === 'legendary' ? 90 : 70,
            colors: confettiColors,
          });
        }, 500);
      }

      // Mark as celebrated
      setCelebratedAchievements(prev => {
        const newSet = new Set(prev);
        newlyUnlocked.forEach(a => newSet.add(a.id));
        return newSet;
      });
    }
  }, [initialAchievements, celebratedAchievements]);

  // Filter achievements by category
  const filteredAchievements = selectedCategory === 'all'
    ? initialAchievements
    : initialAchievements.filter(a => a.category === selectedCategory);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FFFFFF', paddingBottom: 'var(--bottom-nav-height)' }}>
      {/* Header with Back Button */}
      <div className="bg-white border-b px-6 pb-4" style={{ 
        paddingTop: 'calc(24px + env(safe-area-inset-top))',
        borderColor: colors.gray[200]
      }}>
        <div className="max-w-5xl mx-auto">
          {/* Back Button and Title */}
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
              style={{ minHeight: '44px', minWidth: '44px' }}
            >
              <IoArrowBackOutline size={24} style={{ color: colors.gray[700] }} />
            </button>
            <h1 className="text-2xl font-bold" style={{ color: colors.gray[900] }}>
              Achievements
            </h1>
          </div>
          <p className="text-sm mb-4 ml-12" style={{ color: colors.gray[600] }}>
            Unlock badges and earn bonus points
          </p>

          {/* Stats */}
          <div className="flex gap-4">
            <div 
              className="flex-1 p-4 rounded-xl"
              style={{ backgroundColor: colors.gray[50] }}
            >
              <div className="flex items-center gap-2 mb-1">
                <IoTrophyOutline size={16} style={{ color: colors.primary.DEFAULT }} />
                <span className="text-xs font-medium" style={{ color: colors.gray[600] }}>
                  Unlocked
                </span>
              </div>
              <p className="text-2xl font-bold" style={{ color: colors.gray[900] }}>
                {initialUnlockedCount}
              </p>
            </div>

            <div 
              className="flex-1 p-4 rounded-xl"
              style={{ backgroundColor: colors.gray[50] }}
            >
              <div className="flex items-center gap-2 mb-1">
                <IoSparklesOutline size={16} style={{ color: colors.warning }} />
                <span className="text-xs font-medium" style={{ color: colors.gray[600] }}>
                  Bonus Points
                </span>
              </div>
              <p className="text-2xl font-bold" style={{ color: colors.gray[900] }}>
                {formatNumber(initialBonusPoints)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Container className="pt-4 pb-8">
        {/* Category Filters */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex gap-2 pb-2">
            {/* All category */}
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all',
                'min-h-[44px] flex items-center gap-2'
              )}
              style={{
                backgroundColor: selectedCategory === 'all' ? colors.primary.DEFAULT : colors.gray[100],
                color: selectedCategory === 'all' ? 'white' : colors.gray[700],
              }}
            >
              <Icon name="target" size="sm" />
              <span>All</span>
            </button>

            {/* Category buttons */}
            {Object.entries(achievementCategories).map(([key, { label, icon }]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key as CategoryKey)}
                className={cn(
                  'px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all',
                  'min-h-[44px] flex items-center gap-2'
                )}
                style={{
                  backgroundColor: selectedCategory === key ? colors.primary.DEFAULT : colors.gray[100],
                  color: selectedCategory === key ? 'white' : colors.gray[700],
                }}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Achievement Grid */}
        <AchievementGrid
          achievements={filteredAchievements.map(a => ({
            ...a,
            student_achievement: a.studentAchievement
          }))}
          isLoading={false}
        />
      </Container>
    </div>
  );
}
