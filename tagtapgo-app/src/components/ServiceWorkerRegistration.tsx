'use client';

import { useEffect } from 'react';
import { registerServiceWorker as registerNotificationSW } from '@/lib/notifications';
import { registerServiceWorker as registerCachingSW } from '@/lib/serviceWorker';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    // Check if user wants to enable service worker in development
    const enableSWInDev = typeof window !== 'undefined' && 
                          localStorage.getItem('enable-sw-dev') === 'true';

    if (process.env.NODE_ENV === 'development' && !enableSWInDev) {
      console.log('Service worker disabled in development mode');
      console.log('To enable for testing, run: localStorage.setItem("enable-sw-dev", "true")');
      
      // Unregister any existing service workers in development
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            registration.unregister();
            console.log('Unregistered service worker in development');
          });
        });
      }
      return;
    }

    // Register service worker (in production or when explicitly enabled in dev)
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register caching service worker for offline support
      registerCachingSW();
      
      // Also register notification service worker if needed
      registerNotificationSW().catch((error) => {
        console.error('Failed to register notification service worker:', error);
      });
    }
  }, []);

  return null;
}
