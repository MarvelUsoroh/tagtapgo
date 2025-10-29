/**
 * Centralized Theme Configuration
 * Based on TagTapGo brand colors and design system
 */

export const colors = {
  // Primary brand colors
  primary: {
    DEFAULT: '#4ADE80', // Light green (from spec)
    dark: '#22C55E',
    light: '#86EFAC',
    hover: '#3BC970',
  },
  
  // Secondary colors
  secondary: {
    DEFAULT: '#6366F1',
    dark: '#4F46E5',
    light: '#818CF8',
  },
  
  // Status colors
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  
  // Achievement rarity colors
  rarity: {
    common: {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      border: 'border-gray-300',
      gradient: 'from-gray-400 to-gray-600',
    },
    rare: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      border: 'border-blue-300',
      gradient: 'from-blue-400 to-blue-600',
    },
    epic: {
      bg: 'bg-purple-100',
      text: 'text-purple-700',
      border: 'border-purple-300',
      gradient: 'from-purple-400 to-purple-600',
    },
    legendary: {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      border: 'border-amber-300',
      gradient: 'from-amber-400 to-amber-600',
    },
  },
  
  // Leaderboard rank colors
  rank: {
    gold: '#F59E0B',
    silver: '#9CA3AF',
    bronze: '#D97706',
  },
  
  // Neutral colors
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
} as const;

// Hex palettes for badge rarity styling (centralized to avoid component hardcoding)
export const rarityPalette = {
  common: {
    border: '#D1D5DB', // gray-300
    gradFrom: '#9CA3AF', // gray-400
    gradTo: '#4B5563', // gray-600
    pillBg: '#F3F4F6', // gray-100
    pillText: '#374151', // gray-700
  },
  rare: {
    border: '#93C5FD', // blue-300
    gradFrom: '#60A5FA', // blue-400
    gradTo: '#2563EB', // blue-600
    pillBg: '#DBEAFE', // blue-100
    pillText: '#1D4ED8', // blue-700
  },
  epic: {
    border: '#D8B4FE', // purple-300
    gradFrom: '#A855F7', // purple-500
    gradTo: '#6D28D9', // purple-700
    pillBg: '#F3E8FF', // purple-100
    pillText: '#6D28D9', // purple-700
  },
  legendary: {
    border: '#FCD34D', // amber-300
    gradFrom: '#F59E0B', // amber-500
    gradTo: '#B45309', // amber-700
    pillBg: '#FEF3C7', // amber-100
    pillText: '#92400E', // amber-800
  },
} as const;

// Category accent colors (progress rings, accents)
export const categoryAccents: Record<string, string> = {
  attendance: colors.primary.DEFAULT,
  streak: '#FCD34D', // light golden for fire/streak context
  time: '#60A5FA', // blue-400
  social: colors.secondary.DEFAULT,
  reward: colors.success,
  special: colors.secondary.dark,
};

// Category gradient palettes for badge backgrounds
export const categoryPalette: Record<string, { gradFrom: string; gradTo: string }> = {
  attendance: { gradFrom: '#86EFAC', gradTo: '#22C55E' }, // green light -> dark
  streak: { gradFrom: '#FDE68A', gradTo: '#F59E0B' },     // amber-200 -> amber-500
  time: { gradFrom: '#93C5FD', gradTo: '#2563EB' },       // blue-300 -> blue-600
  social: { gradFrom: '#A5B4FC', gradTo: '#4F46E5' },     // indigo-300 -> indigo-600
  reward: { gradFrom: '#6EE7B7', gradTo: '#059669' },     // emerald-300 -> emerald-600
  special: { gradFrom: '#C084FC', gradTo: '#7C3AED' },    // violet-300 -> violet-700
};

export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
} as const;

export const borderRadius = {
  sm: '0.375rem',  // 6px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  '2xl': '1.5rem', // 24px
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
} as const;

export const animations = {
  duration: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
  },
  easing: {
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

// Component-specific styles
export const componentStyles = {
  card: 'bg-white rounded-xl shadow-md',
  button: {
    primary: 'bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors',
    danger: 'bg-danger hover:bg-red-600 text-white font-medium rounded-lg transition-colors',
  },
  input: 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent',
} as const;

// Breakpoints (for reference in components)
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// Icon sizes
export const iconSizes = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
} as const;

// Achievement categories
export const achievementCategories = {
  attendance: { label: 'Attendance', icon: '📚' },
  streak: { label: 'Streaks', icon: '🔥' },
  time: { label: 'Early Bird', icon: '🐦' },
  social: { label: 'Social', icon: '👥' },
  reward: { label: 'Rewards', icon: '🎁' },
  special: { label: 'Special', icon: '⭐' },
} as const;

// Reward categories
export const rewardCategories = {
  all: { label: 'All', icon: '🎁' },
  campus: { label: 'Campus Perks', icon: '🎓' },
  fashion: { label: 'Fashion & Retail', icon: '👕' },
  tech: { label: 'Technology', icon: '💻' },
  food: { label: 'Food & Beverage', icon: '☕' },
  entertainment: { label: 'Entertainment', icon: '🎵' },
} as const;

// Leaderboard types
export const leaderboardTypes = {
  class: { label: 'My Class', icon: '📚' },
  year: { label: 'My Year', icon: '🎓' },
  school: { label: 'School-Wide', icon: '🏫' },
  friend: { label: 'Friends', icon: '👥' },
} as const;

// Time periods
export const timePeriods = {
  weekly: { label: 'This Week', icon: '📅' },
  monthly: { label: 'This Month', icon: '📆' },
  all_time: { label: 'All Time', icon: '🏆' },
} as const;
