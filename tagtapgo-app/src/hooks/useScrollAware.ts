/**
 * useScrollAware Hook
 * 
 * Detects when the user is actively scrolling to pause expensive operations.
 * Uses passive scroll listeners for optimal performance.
 * 
 * @returns {boolean} isScrolling - true while user is actively scrolling
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const SCROLL_DEBOUNCE_MS = 150;

export function useScrollAware(): boolean {
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const handleScroll = useCallback(() => {
    // Use RAF to batch scroll events and reduce main thread blocking
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      if (!isScrolling) {
        setIsScrolling(true);
      }

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }

      // Set new timeout to detect scroll end
      scrollTimeoutRef.current = window.setTimeout(() => {
        setIsScrolling(false);
      }, SCROLL_DEBOUNCE_MS);
    });
  }, [isScrolling]);

  useEffect(() => {
    // Use passive listener for scroll events (critical for performance)
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Also listen to touchmove for iOS scroll detection
    window.addEventListener('touchmove', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchmove', handleScroll);
      
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [handleScroll]);

  return isScrolling;
}

export default useScrollAware;
