/**
 * useTickLoop Hook
 * 
 * A scroll-aware timer that consolidates multiple intervals into one efficient loop.
 * Automatically pauses during scroll to prevent jank.
 * 
 * @param callbacks - Object mapping callback names to functions
 * @param intervals - Object mapping callback names to their intervals in ms
 * @param isScrolling - Whether user is currently scrolling (pauses all ticks)
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';

interface TickLoopConfig {
  callbacks: Record<string, () => void>;
  intervals: Record<string, number>;
  isScrolling: boolean;
  minInterval?: number; // Minimum tick interval, defaults to 1000ms
}

export function useTickLoop({
  callbacks,
  intervals,
  isScrolling,
  minInterval = 1000,
}: TickLoopConfig): void {
  const lastRunRef = useRef<Record<string, number>>({});
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  const tick = useCallback(() => {
    const now = Date.now();
    
    // Throttle ticks to minInterval
    if (now - lastTickRef.current < minInterval) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    lastTickRef.current = now;

    // Execute callbacks based on their intervals
    Object.entries(callbacks).forEach(([name, callback]) => {
      const interval = intervals[name] || minInterval;
      const lastRun = lastRunRef.current[name] || 0;

      if (now - lastRun >= interval) {
        try {
          callback();
        } catch (error) {
          console.error(`[useTickLoop] Error in callback "${name}":`, error);
        }
        lastRunRef.current[name] = now;
      }
    });

    rafRef.current = requestAnimationFrame(tick);
  }, [callbacks, intervals, minInterval]);

  useEffect(() => {
    // Don't run during scroll
    if (isScrolling) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    // Start the tick loop
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isScrolling, tick]);
}

export default useTickLoop;
