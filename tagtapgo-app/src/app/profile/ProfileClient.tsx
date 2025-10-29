/**
 * Profile Client Component
 * Handles interactivity and animations
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { 
  Coins, 
  Flame, 
  Trophy, 
  Gift, 
  Calendar,
  Settings,
  Bell,
  Lock,
  LogOut,
  TrendingUp,
  ChevronRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Student, Streak } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import BottomNav from '@/components/BottomNav';
import ProgressBar from '@/components/ProgressBar';
import { colors } from '@/lib/theme';
import { formatDate, getInitials } from '@/lib/utils';
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
  const attendanceRateAnimated = useCountUp(stats.attendanceRate, { duration: 0.8 });
  const achievementsAnimated = useCountUp(stats.achievementsUnlocked, { duration: 0.8 });
  const rewardsAnimated = useCountUp(stats.rewardsRedeemed, { duration: 0.8 });
  const totalPointsEarnedAnimated = useCountUp(stats.totalPointsEarned, { duration: 0.8 });
  const pointsAnimated = useCountUp(totalPoints, { duration: 0.8 });
  const streakAnimated = useCountUp(currentStreak?.current_streak || 0, { duration: 0.8 });

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
    <div className="min-h-screen bg-gray-50" style={{ paddingBottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))' }}>
      {/* Custom Profile Header with extended gradient for overlapping card */}
      <div className="bg-gradient-to-br from-primary via-primary-dark to-success text-white px-6 pb-20 safe-area-top" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Profile</h1>
            <button
              onClick={() => router.push('/settings')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              style={{ minHeight: '44px', minWidth: '44px' }}
            >
              <Settings size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Profile Card - Overlapping Header */}
      <div className="px-4 -mt-16">
        {incompleteProfile && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Gift size={18} className="text-amber-600" />
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-6"
        >
          {/* Avatar and Basic Info */}
          <div className="flex items-center space-x-4 mb-6">
            {/* Avatar with Fallback */}
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white"
              style={{ backgroundColor: colors.primary.DEFAULT }}
            >
              {student.avatar_url ? (
                <Image 
                  src={student.avatar_url} 
                  alt={student.full_name || 'Student'}
                  width={80}
                  height={80}
                  className="rounded-full object-cover"
                  priority
                />
              ) : (
                getInitials(student.full_name || 'Student')
              )}
            </div>

            {/* Name and ID */}
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">{student.full_name || 'Student'}</h2>
              <p className="text-sm text-gray-500">{student.external_id}</p>
              {student.major && (
                <p className="text-sm text-gray-600 mt-1">{student.major}</p>
              )}
            </div>
          </div>

          {/* Points and Streak Display */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Coins size={20} style={{ color: colors.rank.gold }} />
                <span className="text-xs text-gray-600 uppercase font-medium">Points</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: colors.rank.gold }}>
                <motion.span>{pointsAnimated}</motion.span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Flame size={20} style={{ color: colors.warning }} />
                <span className="text-xs text-gray-600 uppercase font-medium">Streak</span>
              </div>
              <div className="text-2xl font-bold text-orange-600">
                <motion.span>{streakAnimated}</motion.span> 🔥
              </div>
            </div>
          </div>

          {/* Member Since */}
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Calendar size={16} />
            <span>Member since {formatDate(stats.memberSince)}</span>
          </div>
        </motion.div>

        {/* Statistics Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6 bg-white rounded-2xl shadow-lg p-6"
        >
          <h3 className="text-lg font-bold text-gray-900 mb-4">Statistics</h3>
          
          <div className="space-y-4">
            {/* Attendance Rate */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <TrendingUp size={20} style={{ color: colors.success }} />
                  <span className="text-sm font-medium text-gray-700">Attendance Rate</span>
                </div>
                <span className="text-lg font-bold" style={{ color: colors.success }}>
                  <motion.span>{attendanceRateAnimated}</motion.span>%
                </span>
              </div>
              <ProgressBar
                value={stats.attendanceRate}
                color="success"
                height="md"
                animate={true}
                duration={0.8}
              />
            </div>

            {/* Achievements Unlocked */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <Trophy size={20} style={{ color: colors.rank.gold }} />
                <span className="text-sm font-medium text-gray-700">Achievements Unlocked</span>
              </div>
              <span className="text-lg font-bold text-gray-900">
                <motion.span>{achievementsAnimated}</motion.span>/{stats.totalAchievements}
              </span>
            </div>

            {/* Total Points Earned */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <Coins size={20} style={{ color: colors.rank.gold }} />
                <span className="text-sm font-medium text-gray-700">Total Points Earned</span>
              </div>
              <span className="text-lg font-bold text-gray-900">
                <motion.span>{totalPointsEarnedAnimated}</motion.span>
              </span>
            </div>

            {/* Rewards Redeemed */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center space-x-2">
                <Gift size={20} style={{ color: colors.primary.DEFAULT }} />
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
          className="mt-6 bg-white rounded-2xl shadow-lg overflow-hidden"
        >
          <h3 className="text-lg font-bold text-gray-900 p-6 pb-4">Settings</h3>
          
          <div className="divide-y divide-gray-100">
            {/* Settings Button */}
            <button
              onClick={() => router.push('/settings')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              style={{ minHeight: '44px' }}
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Settings size={20} className="text-gray-600" />
                </div>
                <span className="font-medium text-gray-700">Account Settings</span>
              </div>
              <ChevronRight size={20} className="text-gray-400" />
            </button>

            {/* Notifications Button */}
            <button
              onClick={() => router.push('/settings/notifications')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              style={{ minHeight: '44px' }}
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Bell size={20} className="text-blue-600" />
                </div>
                <span className="font-medium text-gray-700">Notifications</span>
              </div>
              <ChevronRight size={20} className="text-gray-400" />
            </button>

            {/* Privacy Button */}
            <button
              onClick={() => router.push('/settings/privacy')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              style={{ minHeight: '44px' }}
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Lock size={20} className="text-purple-600" />
                </div>
                <span className="font-medium text-gray-700">Privacy</span>
              </div>
              <ChevronRight size={20} className="text-gray-400" />
            </button>

            {/* Logout Button */}
            <button
              onClick={() => setShowLogoutDialog(true)}
              className="w-full flex items-center justify-between p-4 hover:bg-red-50 transition-colors"
              style={{ minHeight: '44px' }}
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <LogOut size={20} className="text-red-600" />
                </div>
                <span className="font-medium text-red-600">Logout</span>
              </div>
              <ChevronRight size={20} className="text-red-400" />
            </button>
          </div>
        </motion.div>
  </div>

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

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
