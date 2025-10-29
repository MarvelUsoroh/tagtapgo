'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Bell, BellOff, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { colors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/hooks/useNotifications';
import type { NotificationPreferences } from '@/lib/notifications';

export default function NotificationSettingsPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const {
    permission,
    preferences,
    loading,
    subscribe,
    unsubscribe,
    updatePreferences,
    isGranted,
  } = useNotifications(studentId);

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setStudentId(data.user.id);
      }
    });
  }, []);

  const handleToggleNotifications = async () => {
    if (isGranted) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const handleTogglePreference = async (key: keyof NotificationPreferences) => {
    if (!preferences) return;

    setSaving(true);
    const newValue = !preferences[key];
    const success = await updatePreferences({ [key]: newValue });
    
    if (success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  const notificationTypes = [
    {
      key: 'achievement' as keyof NotificationPreferences,
      icon: '🏆',
      title: 'Achievement Unlocked',
      description: 'Celebrate when you earn new badges and achievements',
    },
    {
      key: 'streak' as keyof NotificationPreferences,
      icon: '🔥',
      title: 'Streak Reminders',
      description: 'Get notified 2 hours before class to maintain your streak',
    },
    {
      key: 'rank' as keyof NotificationPreferences,
      icon: '📈',
      title: 'Rank Changes',
      description: 'Know when your leaderboard position changes significantly',
    },
    {
      key: 'points_milestone' as keyof NotificationPreferences,
      icon: '🎉',
      title: 'Points Milestones',
      description: 'Celebrate when you reach 100, 500, 1000+ points',
    },
    {
      key: 'perfect_week' as keyof NotificationPreferences,
      icon: '🌟',
      title: 'Perfect Week Bonus',
      description: 'Get notified when you attend all 5 days in a week',
    },
    {
      key: 'perfect_month' as keyof NotificationPreferences,
      icon: '🏅',
      title: 'Perfect Month Bonus',
      description: 'Get notified when you attend 20+ days in a month',
    },
    {
      key: 'feedback_prompt' as keyof NotificationPreferences,
      icon: '💬',
      title: 'Feedback Prompts',
      description: 'Reminders to share feedback after class and earn bonus points',
    },
    {
      key: 'reward' as keyof NotificationPreferences,
      icon: '🎁',
      title: 'Reward Updates',
      description: 'Receive confirmation when you redeem rewards',
    },
    {
      key: 'challenge' as keyof NotificationPreferences,
      icon: '⚡',
      title: 'Challenge Invitations',
      description: 'Get notified when friends challenge you',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-6 py-4 bg-white border-b border-gray-200"
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Notification Settings
            </h1>
            <p className="text-sm text-gray-600">
              Manage your notification preferences
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
        {/* Master Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center',
                  isGranted
                    ? 'bg-gradient-to-br from-primary to-primary-dark'
                    : 'bg-gray-200'
                )}
                style={
                  isGranted
                    ? {
                        background: `linear-gradient(135deg, ${colors.primary.DEFAULT} 0%, ${colors.primary.dark} 100%)`,
                      }
                    : undefined
                }
              >
                {isGranted ? (
                  <Bell className="w-6 h-6 text-white" />
                ) : (
                  <BellOff className="w-6 h-6 text-gray-500" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  Push Notifications
                </h3>
                <p className="text-sm text-gray-600">
                  {isGranted ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>

            <button
              onClick={handleToggleNotifications}
              disabled={loading}
              className={cn(
                'relative w-14 h-8 rounded-full transition-colors duration-200',
                isGranted ? 'bg-primary' : 'bg-gray-300',
                loading && 'opacity-50 cursor-not-allowed'
              )}
              style={
                isGranted
                  ? { backgroundColor: colors.primary.DEFAULT }
                  : undefined
              }
            >
              <motion.div
                className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md"
                animate={{ left: isGranted ? '28px' : '4px' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          {permission === 'denied' && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                Notifications are blocked. Please enable them in your browser settings.
              </p>
            </div>
          )}
        </motion.div>

        {/* Notification Types */}
        {isGranted && preferences && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">
                Notification Types
              </h3>
              <p className="text-sm text-gray-600">
                Choose which notifications you want to receive
              </p>
            </div>

            <div className="divide-y divide-gray-200">
              {notificationTypes.map((type, index) => (
                <motion.div
                  key={type.key}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                  className="px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-2xl">{type.icon}</span>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">
                          {type.title}
                        </h4>
                        <p className="text-sm text-gray-600 mt-0.5">
                          {type.description}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleTogglePreference(type.key)}
                      disabled={saving}
                      className={cn(
                        'relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ml-4',
                        preferences[type.key] ? 'bg-primary' : 'bg-gray-300',
                        saving && 'opacity-50 cursor-not-allowed'
                      )}
                      style={
                        preferences[type.key]
                          ? { backgroundColor: colors.primary.DEFAULT }
                          : undefined
                      }
                    >
                      <motion.div
                        className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
                        animate={{
                          left: preferences[type.key] ? '24px' : '4px',
                        }}
                        transition={{
                          type: 'spring',
                          stiffness: 500,
                          damping: 30,
                        }}
                      />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Save Indicator */}
        {saved && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50"
          >
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-full shadow-lg"
              style={{ backgroundColor: colors.success }}
            >
              <Check className="w-5 h-5 text-white" />
              <span className="text-white font-medium">Saved</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
