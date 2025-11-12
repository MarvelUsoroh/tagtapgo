/**
 * Achievements Client Component
 * Handles interactivity and filtering
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Sparkles } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import BadgeIcon from '@/components/BadgeIcon';
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
    <div className="min-h-screen bg-gray-50" style={{ paddingBottom: 'var(--bottom-nav-height)' }}>
      {/* Header */}
      <PageHeader
        title="Achievements"
        subtitle="Unlock badges and earn bonus points"
        icon={Trophy}
        variant="white"
      >
        {/* Stats */}
        <div className="flex gap-4">
            <div 
              className="flex-1 p-4 rounded-xl"
              style={{ backgroundColor: colors.gray[50] }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Trophy size={16} style={{ color: colors.primary.DEFAULT }} />
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
                <Sparkles size={16} style={{ color: colors.warning }} />
                <span className="text-xs font-medium" style={{ color: colors.gray[600] }}>
                  Bonus Points
                </span>
              </div>
              <p className="text-2xl font-bold" style={{ color: colors.gray[900] }}>
                {formatNumber(initialBonusPoints)}
              </p>
            </div>
          </div>
      </PageHeader>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-8">
        {/* Category Filters */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex gap-2 pb-2">
            {/* All category */}
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all duration-300',
                'min-h-[44px] flex items-center gap-2'
              )}
              style={{
                backgroundColor: selectedCategory === 'all' ? colors.primary.DEFAULT : colors.gray[100],
                color: selectedCategory === 'all' ? 'white' : colors.gray[700],
              }}
            >
              <span>🎯</span>
              <span>All</span>
            </button>

            {/* Category buttons */}
            {Object.entries(achievementCategories).map(([key, { label, icon }]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key as CategoryKey)}
                className={cn(
                  'px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all duration-300',
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
        
        {/* Achievement Badges Grid */}
        {filteredAchievements.length === 0 ? (
          <div className="text-center py-12">
            <Trophy size={48} style={{ color: colors.gray[300] }} className="mx-auto mb-4" />
            <p className="text-lg font-medium mb-2" style={{ color: colors.gray[600] }}>
              No achievements found
            </p>
            <p className="text-sm" style={{ color: colors.gray[500] }}>
              Try selecting a different category
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredAchievements.map((achievement, index) => (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  duration: 0.4, 
                  delay: index * 0.05,
                  ease: 'easeOut'
                }}
              >
                <BadgeIcon
                  achievement={achievement}
                  studentAchievement={achievement.studentAchievement}
                  size="md"
                  showProgress={true}
                />
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
