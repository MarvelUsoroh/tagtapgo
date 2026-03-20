'use client';

import { supabase } from './supabase';

export type NotificationType = 
  | 'achievement'
  | 'streak'
  | 'challenge'
  | 'rank'
  | 'reward'

  | 'points_milestone'
  | 'perfect_week'
  | 'perfect_month'
  | 'goal_achieved'
  | 'goal_behind'
  | 'goal_progress';

export type NotificationPreferences = {
  achievement: boolean;
  streak: boolean;
  challenge: boolean;
  rank: boolean;
  reward: boolean;

  points_milestone: boolean;
  perfect_week: boolean;
  perfect_month: boolean;
  goal_achieved: boolean;
  goal_behind: boolean;
  goal_progress: boolean;
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  achievement: true,
  streak: true,
  challenge: true,
  rank: true,
  reward: true,

  points_milestone: true,
  perfect_week: true,
  perfect_month: true,
  goal_achieved: true,
  goal_behind: true,
  goal_progress: true,
};

/**
 * Register service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers are not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    console.log('Service worker registered:', registration);
    return registration;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('Notifications are not supported');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(
  studentId: string
): Promise<PushSubscription | null> {
  const registration = await registerServiceWorker();
  if (!registration) {
    return null;
  }

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    return null;
  }

  try {
    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      // Create new subscription
      // Note: In production, you'll need a VAPID public key from your push service
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
        ),
      });
    }

    // Save subscription to Supabase
    await saveSubscription(studentId, subscription);

    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(
  studentId: string
): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      await removeSubscription(studentId);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Failed to unsubscribe from push notifications:', error);
    return false;
  }
}

/**
 * Save push subscription to Supabase
 */
async function saveSubscription(
  studentId: string,
  subscription: PushSubscription
): Promise<void> {
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      student_id: studentId,
      subscription: subscription.toJSON(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'student_id',
    });

  if (error) {
    console.error('Failed to save subscription:', error);
    throw error;
  }
}

/**
 * Remove push subscription from Supabase
 */
async function removeSubscription(studentId: string): Promise<void> {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('student_id', studentId);

  if (error) {
    console.error('Failed to remove subscription:', error);
    throw error;
  }
}

/**
 * Get notification preferences
 */
export async function getNotificationPreferences(
  studentId: string
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from('students')
    .select('settings')
    .eq('id', studentId)
    .single();

  if (error || !data) {
    return DEFAULT_PREFERENCES;
  }

  return {
    ...DEFAULT_PREFERENCES,
    ...(data.settings?.notifications || {}),
  };
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  studentId: string,
  preferences: Partial<NotificationPreferences>
): Promise<void> {
  // Get current settings
  const { data: currentData } = await supabase
    .from('students')
    .select('settings')
    .eq('id', studentId)
    .single();

  const currentSettings = currentData?.settings || {};
  
  // Merge preferences
  const updatedSettings = {
    ...currentSettings,
    notifications: {
      ...(currentSettings.notifications || {}),
      ...preferences,
    },
  };

  const { error } = await supabase
    .from('students')
    .update({ settings: updatedSettings })
    .eq('id', studentId);

  if (error) {
    console.error('Failed to update notification preferences:', error);
    throw error;
  }
}

/**
 * Check notification permission status
 */
export function getNotificationPermissionStatus(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Show local notification (for testing)
 */
export async function showLocalNotification(
  title: string,
  body: string,
  data?: unknown
): Promise<void> {
  if (Notification.permission !== 'granted') {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, {
    body,
    icon: '/icons/ttg-icon.svg',
    badge: '/icons/ttg-icon.svg',
    data,
  });
}

/**
 * Helper function to convert VAPID key
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as Uint8Array<ArrayBuffer>;
}
