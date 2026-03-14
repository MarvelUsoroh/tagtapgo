/**
 * useDataRefresh Hook
 * Provides debounced data refresh functionality to prevent excessive network requests
 */

'use client';

import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

const DEBOUNCE_DELAY = 5000; // 5 seconds

export function useDataRefresh() {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastRefreshRef = useRef<number>(0);

  const refreshGamification = useCallback(() => {
    // Clear any pending refresh
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Check if we recently refreshed (within debounce window)
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshRef.current;

    if (timeSinceLastRefresh < DEBOUNCE_DELAY) {
      // Schedule refresh for later
      timeoutRef.current = setTimeout(() => {
        lastRefreshRef.current = Date.now();
        router.refresh();
      }, DEBOUNCE_DELAY - timeSinceLastRefresh);
    } else {
      // Refresh immediately
      lastRefreshRef.current = now;
      router.refresh();
    }
  }, [router]);

  return { refreshGamification };
}
