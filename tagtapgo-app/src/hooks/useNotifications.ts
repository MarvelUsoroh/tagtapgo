'use client';

import { useState, useEffect } from 'react';
import {
  getNotificationPermissionStatus,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/notifications';

export function useNotifications(studentId: string | null) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    // Check permission status
    const currentPermission = getNotificationPermissionStatus();
    setPermission(currentPermission);

    // Check if already subscribed
    if ('serviceWorker' in navigator && currentPermission === 'granted') {
      navigator.serviceWorker.ready.then(async (registration) => {
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      });
    }

    // Load preferences
    if (!studentId) return;
    let cancelled = false;
    (async () => {
      try {
        const prefs = await getNotificationPreferences(studentId);
        if (!cancelled) setPreferences(prefs);
      } catch (error) {
        console.error('Failed to load notification preferences:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const subscribe = async () => {
    if (!studentId) return false;
    
    setLoading(true);
    try {
      const subscription = await subscribeToPushNotifications(studentId);
      if (subscription) {
        const newPermission = getNotificationPermissionStatus();
        setPermission(newPermission);
        setIsSubscribed(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to subscribe:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    if (!studentId) return false;
    
    setLoading(true);
    try {
      const success = await unsubscribeFromPushNotifications(studentId);
      if (success) {
        setIsSubscribed(false);
      }
      return success;
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (newPreferences: Partial<NotificationPreferences>) => {
    if (!studentId) return false;
    
    setLoading(true);
    try {
      await updateNotificationPreferences(studentId, newPreferences);
      setPreferences((prev) => (prev ? { ...prev, ...newPreferences } : null));
      return true;
    } catch (error) {
      console.error('Failed to update preferences:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    permission,
    preferences,
    loading,
    subscribe,
    unsubscribe,
    updatePreferences,
    isGranted: permission === 'granted' && isSubscribed,
    isDenied: permission === 'denied',
    isDefault: permission === 'default',
    isSubscribed,
  };
}
