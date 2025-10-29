/**
 * Schedule Helper Utilities
 * 
 * Provides utilities for working with class schedules to support time-based features:
 * - Feedback prompts (15 min after class ends)
 * - Streak at-risk detection (2 hours before next class)
 * - Dashboard countdown (time until next class)
 * 
 * Reference: .kiro/specs/gamification-mvp/tasks.md - Task 12.6
 */

import type { CanonicalSchedule } from '../types/canonical-schema.ts';

// ============================================================================
// Types
// ============================================================================

export interface NextClass {
  courseId: number;
  courseName?: string;
  dayOfWeek: string;
  period?: string;
  startTime: string;
  endTime: string;
  location?: string;
  startsAt: Date;           // Absolute datetime when class starts
  endsAt: Date;             // Absolute datetime when class ends
  minutesUntilStart: number;
  isToday: boolean;
}

export interface ClassSession {
  scheduleId: string;
  courseId: number;
  startTime: string;
  endTime: string;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;        // Currently in session
  hasEnded: boolean;        // Session has ended
}

// ============================================================================
// Date/Time Utilities
// ============================================================================

/**
 * Get current day of week (0 = Sunday, 6 = Saturday)
 */
function getCurrentDayOfWeek(): number {
  return new Date().getDay();
}

/**
 * Convert day name to number (0 = Sunday, 6 = Saturday)
 */
function dayNameToNumber(dayName: string): number {
  const days: Record<string, number> = {
    'Sunday': 0,
    'Monday': 1,
    'Tuesday': 2,
    'Wednesday': 3,
    'Thursday': 4,
    'Friday': 5,
    'Saturday': 6,
  };
  return days[dayName] ?? parseInt(dayName);
}

/**
 * Convert day number to name
 */
function dayNumberToName(dayNumber: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNumber] || 'Unknown';
}

/**
 * Calculate days until target day of week
 */
function daysUntilDayOfWeek(targetDay: number): number {
  const today = getCurrentDayOfWeek();
  let daysUntil = targetDay - today;
  if (daysUntil <= 0) {
    daysUntil += 7; // Next week
  }
  return daysUntil;
}

/**
 * Parse time string (HH:MM:SS or HH:MM) to hours and minutes
 */
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const parts = timeStr.split(':');
  return {
    hours: parseInt(parts[0]),
    minutes: parseInt(parts[1] || '0'),
  };
}

/**
 * Create absolute datetime from schedule entry
 */
function createAbsoluteDatetime(schedule: CanonicalSchedule, timeStr: string, timezone: string): Date {
  const now = new Date();
  const dayNumber = typeof schedule.dayOfWeek === 'number' 
    ? schedule.dayOfWeek 
    : dayNameToNumber(schedule.dayOfWeek);
  
  const daysUntil = daysUntilDayOfWeek(dayNumber);
  const { hours, minutes } = parseTime(timeStr);
  
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + daysUntil);
  targetDate.setHours(hours, minutes, 0, 0);
  
  return targetDate;
}

// ============================================================================
// Schedule Queries
// ============================================================================

/**
 * Get next scheduled class for a student
 * Returns the soonest upcoming class across all courses
 */
export function getNextClass(
  schedules: CanonicalSchedule[],
  timezone: string = 'UTC'
): NextClass | null {
  if (!schedules || schedules.length === 0) {
    return null;
  }

  const now = new Date();
  let nextClass: NextClass | null = null;
  let minMinutesUntil = Infinity;

  for (const schedule of schedules) {
    // Check if schedule is currently effective
    const effectiveFrom = new Date(schedule.effectiveFrom);
    const effectiveTo = new Date(schedule.effectiveTo);
    if (now < effectiveFrom || now > effectiveTo) {
      continue;
    }

    const startsAt = createAbsoluteDatetime(schedule, schedule.startTime, timezone);
    const endsAt = createAbsoluteDatetime(schedule, schedule.endTime, timezone);
    
    // Skip if class has already ended today
    if (endsAt < now) {
      continue;
    }

    const minutesUntilStart = Math.floor((startsAt.getTime() - now.getTime()) / 1000 / 60);
    
    if (minutesUntilStart >= 0 && minutesUntilStart < minMinutesUntil) {
      minMinutesUntil = minutesUntilStart;
      nextClass = {
        courseId: schedule.courseId,
        dayOfWeek: typeof schedule.dayOfWeek === 'number' 
          ? dayNumberToName(schedule.dayOfWeek) 
          : schedule.dayOfWeek,
        period: schedule.period,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        location: schedule.location,
        startsAt,
        endsAt,
        minutesUntilStart,
        isToday: minutesUntilStart < 1440, // Less than 24 hours
      };
    }
  }

  return nextClass;
}

/**
 * Get class end time for a specific session
 * Used for triggering feedback prompts 15 minutes after class ends
 */
export function getClassEndTime(
  schedules: CanonicalSchedule[],
  sessionId: number,
  timezone: string = 'UTC'
): Date | null {
  // Find schedule by session ID (stored in schedule.id)
  const schedule = schedules.find(s => s.id.includes(String(sessionId)));
  
  if (!schedule) {
    return null;
  }

  return createAbsoluteDatetime(schedule, schedule.endTime, timezone);
}

/**
 * Check if a class is currently active (in session)
 */
export function isClassActive(
  schedules: CanonicalSchedule[],
  sessionId: number,
  timezone: string = 'UTC'
): boolean {
  const schedule = schedules.find(s => s.id.includes(String(sessionId)));
  
  if (!schedule) {
    return false;
  }

  const now = new Date();
  const startsAt = createAbsoluteDatetime(schedule, schedule.startTime, timezone);
  const endsAt = createAbsoluteDatetime(schedule, schedule.endTime, timezone);
  
  return now >= startsAt && now <= endsAt;
}

/**
 * Get all classes for today
 */
export function getTodayClasses(
  schedules: CanonicalSchedule[],
  timezone: string = 'UTC'
): ClassSession[] {
  const now = new Date();
  const todayDayOfWeek = getCurrentDayOfWeek();
  const todayDayName = dayNumberToName(todayDayOfWeek);

  return schedules
    .filter(schedule => {
      // Check if schedule is for today
      const scheduleDayNumber = typeof schedule.dayOfWeek === 'number'
        ? schedule.dayOfWeek
        : dayNameToNumber(schedule.dayOfWeek);
      
      if (scheduleDayNumber !== todayDayOfWeek) {
        return false;
      }

      // Check if schedule is currently effective
      const effectiveFrom = new Date(schedule.effectiveFrom);
      const effectiveTo = new Date(schedule.effectiveTo);
      return now >= effectiveFrom && now <= effectiveTo;
    })
    .map(schedule => {
      const startsAt = createAbsoluteDatetime(schedule, schedule.startTime, timezone);
      const endsAt = createAbsoluteDatetime(schedule, schedule.endTime, timezone);
      
      return {
        scheduleId: schedule.id,
        courseId: schedule.courseId,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        startsAt,
        endsAt,
        isActive: now >= startsAt && now <= endsAt,
        hasEnded: now > endsAt,
      };
    })
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/**
 * Check if student is at risk of losing streak
 * Returns true if next class is within 2 hours and student hasn't attended yet
 */
export function isStreakAtRisk(
  schedules: CanonicalSchedule[],
  lastAttendanceDate: Date,
  timezone: string = 'UTC'
): boolean {
  const nextClass = getNextClass(schedules, timezone);
  
  if (!nextClass) {
    return false;
  }

  // Check if next class is within 2 hours
  const twoHoursInMinutes = 120;
  if (nextClass.minutesUntilStart > twoHoursInMinutes) {
    return false;
  }

  // Check if student attended today
  const now = new Date();
  const lastAttendance = new Date(lastAttendanceDate);
  const isSameDay = 
    lastAttendance.getFullYear() === now.getFullYear() &&
    lastAttendance.getMonth() === now.getMonth() &&
    lastAttendance.getDate() === now.getDate();

  // Streak is at risk if they haven't attended today and class is soon
  return !isSameDay;
}

/**
 * Calculate time until feedback prompt should be sent
 * Returns minutes until 15 minutes after class ends
 */
export function minutesUntilFeedbackPrompt(
  classEndTime: Date
): number {
  const now = new Date();
  const feedbackTime = new Date(classEndTime.getTime() + 15 * 60 * 1000); // +15 minutes
  const minutesUntil = Math.floor((feedbackTime.getTime() - now.getTime()) / 1000 / 60);
  return Math.max(0, minutesUntil);
}

/**
 * Format time until next class for display
 */
export function formatTimeUntilClass(minutesUntil: number): string {
  if (minutesUntil < 0) {
    return 'Class in progress';
  }
  
  if (minutesUntil === 0) {
    return 'Starting now';
  }
  
  if (minutesUntil < 60) {
    return `${minutesUntil} minute${minutesUntil === 1 ? '' : 's'}`;
  }
  
  const hours = Math.floor(minutesUntil / 60);
  const minutes = minutesUntil % 60;
  
  if (minutes === 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  
  return `${hours}h ${minutes}m`;
}
