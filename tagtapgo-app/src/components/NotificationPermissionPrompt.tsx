'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { colors } from '@/lib/theme';
import {
  requestNotificationPermission,
  subscribeToPushNotifications,
  getNotificationPermissionStatus,
} from '@/lib/notifications';

interface NotificationPermissionPromptProps {
  studentId: string;
  onClose?: () => void;
}

export default function NotificationPermissionPrompt({
  studentId,
  onClose,
}: NotificationPermissionPromptProps) {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    // Check if service worker is supported and ready
    const checkServiceWorker = async () => {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return false;
      }

      // Check if service worker is enabled in dev mode
      if (process.env.NODE_ENV === 'development') {
        const enableSWInDev = localStorage.getItem('enable-sw-dev') === 'true';
        if (!enableSWInDev) {
          console.log('Service worker disabled in development. Enable with: localStorage.setItem("enable-sw-dev", "true")');
          return false;
        }
      }

      // Check if service worker is registered
      const registration = await navigator.serviceWorker.getRegistration();

      // If not registered yet, wait a bit and check again
      if (!registration) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const retryRegistration = await navigator.serviceWorker.getRegistration();
        return !!retryRegistration;
      }

      return true;
    };

    const initialize = async () => {
      // Check if already dismissed
      const isDismissed = localStorage.getItem('notification-prompt-dismissed') === 'true';
      setDismissed(isDismissed);

      // Check current permission
      const currentPermission = getNotificationPermissionStatus();
      setPermission(currentPermission);

      // Check service worker
      const swReady = await checkServiceWorker();

      // Only show if: not dismissed, permission not granted, and service worker ready
      const show = !isDismissed && currentPermission !== 'granted' && swReady;
      setShouldShow(show);
    };

    initialize();
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const newPermission = await requestNotificationPermission();
      setPermission(newPermission);

      if (newPermission === 'granted') {
        await subscribeToPushNotifications(studentId);
        setTimeout(() => {
          setDismissed(true);
          setShouldShow(false);
          onClose?.();
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to enable notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('notification-prompt-dismissed', 'true');
    setDismissed(true);
    setShouldShow(false);
    onClose?.();
  };

  // Don't render anything until we've checked all conditions
  if (permission === null || dismissed === null || !shouldShow) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-8 md:w-96"
      >
        <div
          className={cn(
            'rounded-2xl p-6 shadow-2xl',
            'bg-white border border-gray-200'
          )}
        >
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-4">
            <div
              className={cn(
                'flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center',
                'bg-gradient-to-br from-primary to-primary-dark'
              )}
              style={{
                background: `linear-gradient(135deg, ${colors.primary.DEFAULT} 0%, ${colors.primary.dark} 100%)`,
              }}
            >
              <Bell className="w-6 h-6 text-white" />
            </div>

            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Stay on Track!
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Get notified about your streaks, achievements, and important updates so you never miss out.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={handleEnable}
                  disabled={loading}
                  className={cn(
                    'flex-1 py-2.5 px-4 rounded-xl font-semibold',
                    'text-white transition-all duration-200',
                    'hover:scale-105 active:scale-95',
                    loading && 'opacity-50 cursor-not-allowed'
                  )}
                  style={{
                    backgroundColor: colors.primary.DEFAULT,
                  }}
                >
                  {loading ? 'Enabling...' : 'Enable Notifications'}
                </button>

                <button
                  onClick={handleDismiss}
                  className={cn(
                    'px-4 py-2.5 rounded-xl font-semibold',
                    'text-gray-600 hover:bg-gray-100',
                    'transition-colors duration-200'
                  )}
                >
                  Not Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
