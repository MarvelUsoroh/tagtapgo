/**
 * useCountUp Hook
 * Reusable hook for count-up animations using Framer Motion
 */

import { useEffect, useRef, useState } from 'react';
import { useMotionValue, animate } from 'framer-motion';

interface UseCountUpOptions {
  duration?: number; // Duration in seconds (default: 0.8)
  ease?: 'easeIn' | 'easeOut' | 'easeInOut' | 'linear'; // Easing function (default: 'easeOut')
  enabled?: boolean; // Whether animation is enabled (default: true)
}

/**
 * Hook for animating number count-up
 * @param value - Target value to count up to
 * @param options - Animation options
 * @returns Current animated value as a plain number
 */
export function useCountUp(
  value: number,
  options: UseCountUpOptions = {}
): number {
  const {
    duration = 0.8, // 800ms as per design spec
    ease = 'easeOut',
    enabled = true,
  } = options;

  const motionValue = useMotionValue(0);
  const [currentValue, setCurrentValue] = useState(0);
  const prevValueRef = useRef<number>(0);

  // Subscribe to motion value changes and update state
  useEffect(() => {
    const unsubscribe = motionValue.on('change', (latest) => {
      setCurrentValue(Math.round(latest));
    });

    return unsubscribe;
  }, [motionValue]);

  // Animate when target value changes
  useEffect(() => {
    if (!enabled) {
      motionValue.set(value);
      setCurrentValue(Math.round(value));
      prevValueRef.current = value;
      return;
    }

    const from = prevValueRef.current;
    const to = value;

    // Only animate if value changed
    if (from !== to) {
      const controls = animate(motionValue, to, {
        duration,
        ease,
        onComplete: () => {
          prevValueRef.current = to;
        },
      });

      return () => controls.stop();
    } else {
      // Set initial value without animation
      motionValue.set(to);
      setCurrentValue(Math.round(to));
      prevValueRef.current = to;
    }
  }, [value, duration, ease, enabled, motionValue]);

  return currentValue;
}
