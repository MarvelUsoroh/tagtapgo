/**
 * Application Constants
 * Centralized configuration values
 */

// API Configuration (for future use)
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3,
} as const;

// Points Configuration
export const POINTS_CONFIG = {
  ATTENDANCE: 10,
  EARLY_ARRIVAL_BONUS: 5,
  PERFECT_WEEK_BONUS: 50,
  PERFECT_MONTH_BONUS: 200,
  STREAK_MILESTONE_BONUS: 25,
} as const;

// Streak Configuration
export const STREAK_CONFIG = {
  FREEZE_PER_MONTH: 1,
  WARNING_HOURS_BEFORE_CLASS: 2,
  MILESTONE_DAYS: [7, 14, 30, 60, 100],
} as const;

// Achievement Configuration
export const ACHIEVEMENT_CONFIG = {
  CATEGORIES: ["attendance", "streak", "time", "social", "reward", "special"],
  RARITIES: ["common", "rare", "epic", "legendary"],
} as const;

// Leaderboard Configuration
export const LEADERBOARD_CONFIG = {
  ITEMS_PER_PAGE: 50,
  TOP_PODIUM_COUNT: 3,
  REFRESH_INTERVAL: 60000, // 1 minute
} as const;

// Reward Configuration
export const REWARD_CONFIG = {
  MIN_POINTS: 300,
  MAX_POINTS: 2000,
  COMMISSION_RATE: 0.15, // 15%
  EXPIRY_DAYS: 30,
} as const;

// UI Configuration
export const UI_CONFIG = {
  TOAST_DURATION: 3000,
  ANIMATION_DURATION: 300,
  DEBOUNCE_DELAY: 300,
  MIN_TOUCH_TARGET: 44, // pixels
} as const;

// Validation Rules
export const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_MIN_LENGTH: 8,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
} as const;

// Date/Time Formats
export const DATE_FORMATS = {
  DISPLAY: "MMM DD, YYYY",
  DISPLAY_WITH_TIME: "MMM DD, YYYY HH:mm",
  TIME_ONLY: "HH:mm",
  ISO: "YYYY-MM-DD",
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: "Network error. Please check your connection.",
  UNAUTHORIZED: "Please log in to continue.",
  FORBIDDEN: "You do not have permission to access this resource.",
  NOT_FOUND: "The requested resource was not found.",
  SERVER_ERROR: "Server error. Please try again later.",
  VALIDATION_ERROR: "Please check your input and try again.",
  INSUFFICIENT_POINTS: "You do not have enough points for this reward.",
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  ATTENDANCE_RECORDED: "Attendance recorded successfully!",
  ACHIEVEMENT_UNLOCKED: "Achievement unlocked!",
  REWARD_REDEEMED: "Reward redeemed successfully!",
  PROFILE_UPDATED: "Profile updated successfully!",
  SETTINGS_SAVED: "Settings saved successfully!",
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: "ttg_auth_token",
  USER_DATA: "ttg_user_data",
  THEME_PREFERENCE: "ttg_theme",
  LANGUAGE_PREFERENCE: "ttg_language",
} as const;

// Feature Flags (for gradual rollout)
export const FEATURE_FLAGS = {
  ENABLE_CHALLENGES: true,
  ENABLE_FRIENDS: true,
  ENABLE_NOTIFICATIONS: true,
  ENABLE_DARK_MODE: false,
  ENABLE_ANALYTICS: true,
} as const;

// Brand Partners (for rewards)
export const BRAND_PARTNERS = [
  { id: "starbucks", name: "Starbucks", logo: "/brands/starbucks.png" },
  { id: "asos", name: "ASOS", logo: "/brands/asos.png" },
  { id: "spotify", name: "Spotify", logo: "/brands/spotify.png" },
  { id: "apple", name: "Apple", logo: "/brands/apple.png" },
  { id: "nike", name: "Nike", logo: "/brands/nike.png" },
  { id: "amazon", name: "Amazon", logo: "/brands/amazon.png" },
] as const;

// App Metadata
export const APP_METADATA = {
  NAME: "TagTapGo",
  SHORT_NAME: "TTG",
  DESCRIPTION: "Gamified attendance tracking for students",
  VERSION: "1.0.0",
  SUPPORT_EMAIL: "support@tagtapgo.com",
  PRIVACY_URL: "/privacy",
  TERMS_URL: "/terms",
} as const;
