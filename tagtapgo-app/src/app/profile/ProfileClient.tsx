/**
 * Profile Client Component
 * Handles interactivity and animations
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  IoTrophyOutline,
  IoGiftOutline,
  IoCalendarOutline,
  IoSettingsOutline,
  IoLogOutOutline,
  IoChevronForwardOutline
} from 'react-icons/io5';
import { supabase } from '@/lib/supabase';
import type { Student, Streak } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { Container } from '@/components/layout/Container';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileStats } from '@/components/profile/ProfileStats';
import { colors } from '@/lib/theme';
import { formatDate } from '@/lib/utils';
import { useCountUp } from '@/hooks/useCountUp';

interface ProfileStats {
  attendanceRate: number;
  achievementsUnlocked: number;
  totalAchievements: number;
  rewardsRedeemed: number;
  totalPointsEarned: number;
  memberSince: string;
}

interface Props {
  student: Student;
  totalPoints: number;
  currentStreak: Streak | null;
  stats: ProfileStats;
}

export default function ProfileClient({
  student,
  totalPoints,
  currentStreak,
  stats,
}: Props) {
  const router = useRouter();
  const { reset } = useStore();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  // Count-up animations for statistics
  const achievementsAnimated = useCountUp(stats.achievementsUnlocked, { duration: 0.8 });
  const rewardsAnimated = useCountUp(stats.rewardsRedeemed, { duration: 0.8 });

  // Determine if profile is incomplete (minimal gating fields)
  const incompleteProfile = !student?.university_id || !student?.full_name || student.full_name.trim().length < 2;

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      reset();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FFFFFF', paddingBottom: 'var(--bottom-nav-height)' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 pb-4" style={{ 
        paddingTop: 'calc(24px + env(safe-area-inset-top))',
        borderColor: colors.gray[200]
      }}>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold" style={{ color: colors.gray[900] }}>
              Profile
            </h1>
            <button
              onClick={() => router.push('/settings')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              style={{ minHeight: '44px', minWidth: '44px' }}
            >
              <IoSettingsOutline size={24} style={{ color: colors.gray[600] }} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Container className="pt-4 pb-8">
        {incompleteProfile && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <IoGiftOutline size={18} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-800">Complete your profile to redeem rewards</p>
                <p className="text-sm text-amber-700">Add your name and university to unlock redemptions and personalized features.</p>
              </div>
              <button
                onClick={() => router.push('/settings')}
                className="px-3 py-2 text-sm font-medium text-white rounded-lg"
                style={{ backgroundColor: colors.primary.DEFAULT, minHeight: '36px' }}
              >
                Complete profile
              </button>
            </div>
          </motion.div>
        )}

        {/* Profile Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <ProfileHeader
            avatarUrl={student.avatar_url || undefined}
            name={student.full_name || 'Student'}
            level={Math.floor((stats.totalPointsEarned || 0) / 100) + 1}
            points={totalPoints}
            studentId={student.external_id}
          />

          {/* Member Since - Below Card */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-3 px-2">
            <IoCalendarOutline size={16} />
            <span>Member since {formatDate(stats.memberSince)}</span>
          </div>
        </motion.div>

        {/* Statistics Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl p-6 mb-4"
          style={{ boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' }}
        >
          <h3 className="text-lg font-bold text-gray-900 mb-4">Statistics</h3>
          
          <ProfileStats
            stats={{
              attendance: stats.attendanceRate,
              achievements: stats.achievementsUnlocked,
              streak: currentStreak?.current_streak || 0,
              totalPoints: stats.totalPointsEarned,
            }}
          />

          {/* Additional Stats */}
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            {/* Achievements Unlocked */}
            <Link 
              href="/achievements"
              className="flex items-center justify-between py-2 hover:bg-gray-50 transition-colors -mx-2 px-2 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <IoTrophyOutline size={20} style={{ color: colors.rank.gold }} />
                <span className="text-sm font-medium text-gray-700">Achievements Unlocked</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-900">
                  <motion.span>{achievementsAnimated}</motion.span>/{stats.totalAchievements}
                </span>
                <IoChevronForwardOutline size={16} className="text-gray-400" />
              </div>
            </Link>

            {/* Rewards Redeemed */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <IoGiftOutline size={20} style={{ color: colors.primary.DEFAULT }} />
                <span className="text-sm font-medium text-gray-700">Rewards Redeemed</span>
              </div>
              <span className="text-lg font-bold text-gray-900">
                <motion.span>{rewardsAnimated}</motion.span>
              </span>
            </div>
          </div>
        </motion.div>

        {/* Settings Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl overflow-hidden"
          style={{ boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' }}
        >
          <h3 className="text-lg font-bold text-gray-900 p-6 pb-4">Settings</h3>
          
          <div className="divide-y divide-gray-100">
            {/* Settings Button */}
            <button
              onClick={() => router.push('/settings')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              style={{ minHeight: '44px' }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <IoSettingsOutline size={20} className="text-gray-600" />
                </div>
                <span className="font-medium text-gray-700">Account Settings</span>
              </div>
              <IoChevronForwardOutline size={20} className="text-gray-400" />
            </button>

            {/* Logout Button */}
            <button
              onClick={() => setShowLogoutDialog(true)}
              className="w-full flex items-center justify-between p-4 hover:bg-red-50 transition-colors"
              style={{ minHeight: '44px' }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <IoLogOutOutline size={20} className="text-red-600" />
                </div>
                <span className="font-medium text-red-600">Logout</span>
              </div>
              <IoChevronForwardOutline size={20} className="text-red-400" />
            </button>
          </div>
        </motion.div>
      </Container>

      {/* Logout Confirmation Dialog */}
      {showLogoutDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-sm w-full"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-2">Logout</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to logout? You&apos;ll need to sign in again to access your account.
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowLogoutDialog(false)}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                style={{ minHeight: '44px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 px-4 py-3 text-white font-medium rounded-lg transition-colors"
                style={{ 
                  backgroundColor: colors.danger,
                  minHeight: '44px'
                }}
              >
                Logout
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
