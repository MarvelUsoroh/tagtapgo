/**
 * Optimized Animation Utilities
 * Performance-focused animation helpers using CSS transforms and RAF
 */

import { Variants } from 'framer-motion';

/**
 * Optimized fade-in animation using opacity and transform
 * Uses GPU-accelerated properties for 60 FPS
 */
export const fadeIn: Variants = {
  hidden: { 
    opacity: 0, 
    y: 20,
    transition: { duration: 0 }
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.3,
      ease: 'easeOut'
    }
  }
};

/**
 * Staggered children animation
 * Optimized for lists and grids
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

/**
 * Scale animation for buttons and cards
 * Uses transform: scale for GPU acceleration
 */
export const scaleOnHover: Variants = {
  rest: { scale: 1 },
  hover: { 
    scale: 1.05,
    transition: {
      duration: 0.2,
      ease: 'easeInOut'
    }
  },
  tap: { 
    scale: 0.95,
    transition: {
      duration: 0.1
    }
  }
};

/**
 * Button press animation
 * Provides tactile feedback for interactive elements
 */
export const buttonPress = {
  whileTap: { scale: 0.95 },
  transition: { duration: 0.1 }
};

/**
 * Card hover animation
 * Subtle lift effect for cards
 */
export const cardHover = {
  whileHover: { 
    scale: 1.02,
    y: -4,
    transition: { duration: 0.2 }
  },
  whileTap: { scale: 0.98 }
};

/**
 * Fade in up animation
 * Common entrance animation
 */
export const fadeInUp: Variants = {
  hidden: { 
    opacity: 0, 
    y: 20,
    transition: { duration: 0 }
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.4,
      ease: 'easeOut'
    }
  }
};

/**
 * Slide in from side
 * Optimized with transform: translateX
 */
export const slideIn: Variants = {
  hidden: { 
    x: -20, 
    opacity: 0,
    transition: { duration: 0 }
  },
  visible: { 
    x: 0, 
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut'
    }
  }
};

/**
 * Pulse animation for CTAs
 * Optimized with transform: scale
 */
export const pulse: Variants = {
  initial: { scale: 1 },
  animate: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  }
};

/**
 * Debounced scroll handler
 * Prevents excessive scroll event processing
 */
export function debounceScroll(callback: () => void, delay: number = 100) {
  let timeoutId: NodeJS.Timeout;
  let rafId: number;

  return () => {
    clearTimeout(timeoutId);
    cancelAnimationFrame(rafId);

    timeoutId = setTimeout(() => {
      rafId = requestAnimationFrame(callback);
    }, delay);
  };
}

/**
 * Throttled animation frame
 * Ensures animations run at most once per frame
 */
export function throttleRAF(callback: () => void) {
  let rafId: number | null = null;

  return () => {
    if (rafId !== null) return;

    rafId = requestAnimationFrame(() => {
      callback();
      rafId = null;
    });
  };
}

/**
 * Check if reduced motion is preferred
 * Respects user's accessibility preferences
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get optimized animation config based on user preferences
 */
export function getAnimationConfig() {
  const reduced = prefersReducedMotion();
  
  return {
    duration: reduced ? 0 : 0.3,
    ease: 'easeOut',
    stagger: reduced ? 0 : 0.1,
  };
}

/**
 * Optimized confetti configuration
 * Reduced particle count for better performance
 */
export const optimizedConfettiConfig = {
  particleCount: 50, // Reduced from default 100
  spread: 70,
  origin: { y: 0.6 },
  colors: ['#4ADE80', '#22C55E', '#86EFAC', '#F59E0B', '#EF4444'],
  disableForReducedMotion: true,
  scalar: 0.8, // Smaller particles for better performance
};
