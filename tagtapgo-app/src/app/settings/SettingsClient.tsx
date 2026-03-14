/**
 * Settings Client Component
 * Handles settings interactivity
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { IoArrowBackOutline } from 'react-icons/io5';
import { Container } from '@/components/layout/Container';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsItem } from '@/components/settings/SettingsItem';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { colors } from '@/lib/theme';

interface Props {
  studentId: string;
  studentName: string;
  studentEmail: string;
}

export default function SettingsClient({
  studentName,
  studentEmail,
}: Props) {
  const router = useRouter();
  const { reset } = useStore();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  // Settings state (these would typically come from a settings store or database)
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [achievementAlerts, setAchievementAlerts] = useState(true);

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
    <div className="min-h-screen" style={{ backgroundColor: '#F9FAFB', paddingBottom: 'var(--bottom-nav-height)' }}>
      {/* Header with Back Button */}
      <div className="bg-white border-b px-6 pb-4" style={{ 
        paddingTop: 'calc(24px + env(safe-area-inset-top))',
        borderColor: colors.gray[200]
      }}>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/profile')}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
              style={{ minHeight: '44px', minWidth: '44px' }}
            >
              <IoArrowBackOutline size={24} style={{ color: colors.gray[700] }} />
            </button>
            <h1 className="text-2xl font-bold" style={{ color: colors.gray[900] }}>
              Settings
            </h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Container className="pt-6 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Account Section */}
          <SettingsSection
            title="Account"
            description="Manage your account information"
          >
            <SettingsItem
              icon="person"
              iconColor="#4ADE80"
              iconBgColor="rgba(74, 222, 128, 0.1)"
              label="Name"
              description={studentName}
              type="info"
            />
            <SettingsItem
              icon="mail"
              iconColor="#3B82F6"
              iconBgColor="rgba(59, 130, 246, 0.1)"
              label="Email"
              description={studentEmail}
              type="info"
            />
            <SettingsItem
              icon="person"
              iconColor="#F59E0B"
              iconBgColor="rgba(245, 158, 11, 0.1)"
              label="Edit Profile Picture"
              onClick={() => router.push('/profile/edit')}
            />
            <SettingsItem
              icon="lock"
              iconColor="#8B5CF6"
              iconBgColor="rgba(139, 92, 246, 0.1)"
              label="Change Password"
              onClick={() => router.push('/update-password')}
            />
          </SettingsSection>

          {/* Notifications Section */}
          <SettingsSection
            title="Notifications"
            description="Manage how you receive notifications"
          >
            <SettingsItem
              icon="notification"
              iconColor="#F59E0B"
              iconBgColor="rgba(245, 158, 11, 0.1)"
              label="Push Notifications"
              description="Receive push notifications on your device"
              type="toggle"
              value={pushNotifications}
              onChange={setPushNotifications}
            />
            <SettingsItem
              icon="mail"
              iconColor="#3B82F6"
              iconBgColor="rgba(59, 130, 246, 0.1)"
              label="Email Notifications"
              description="Receive notifications via email"
              type="toggle"
              value={emailNotifications}
              onChange={setEmailNotifications}
            />
            <SettingsItem
              icon="trophy"
              iconColor="#4ADE80"
              iconBgColor="rgba(74, 222, 128, 0.1)"
              label="Achievement Alerts"
              description="Get notified when you unlock achievements"
              type="toggle"
              value={achievementAlerts}
              onChange={setAchievementAlerts}
            />
          </SettingsSection>

          {/* Privacy Section */}
          <SettingsSection
            title="Privacy & Security"
            description="Control your privacy settings"
          >
            <SettingsItem
              icon="lock"
              iconColor="#8B5CF6"
              iconBgColor="rgba(139, 92, 246, 0.1)"
              label="Privacy Policy"
              onClick={() => router.push('/coming-soon')}
            />
            <SettingsItem
              icon="lock"
              iconColor="#8B5CF6"
              iconBgColor="rgba(139, 92, 246, 0.1)"
              label="Terms of Service"
              onClick={() => router.push('/coming-soon')}
            />
          </SettingsSection>

          {/* About Section */}
          <SettingsSection
            title="About"
            description="App information and support"
          >
            <SettingsItem
              icon="info"
              iconColor="#6B7280"
              iconBgColor="#F3F4F6"
              label="App Version"
              description="1.0.0"
              type="info"
            />
            <SettingsItem
              icon="info"
              iconColor="#6B7280"
              iconBgColor="#F3F4F6"
              label="Help & Support"
              onClick={() => router.push('/coming-soon')}
            />
          </SettingsSection>

          {/* Logout Section */}
          <SettingsSection title="Account Actions">
            <SettingsItem
              icon="close"
              iconColor="#EF4444"
              iconBgColor="rgba(239, 68, 68, 0.1)"
              label="Logout"
              onClick={() => setShowLogoutDialog(true)}
            />
          </SettingsSection>
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
            
            <div className="flex gap-3">
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
                  backgroundColor: '#EF4444',
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
