/**
 * Idempotent Data Processing Utilities
 * 
 * Handles upsert operations with:
 * - Composite ID generation for deduplication
 * - Timezone conversions (store all dates in UTC)
 * - Data validation before insert
 * - Change detection for updates
 */

// deno-lint-ignore no-import-prefix
import { generate } from "https://deno.land/std@0.168.0/uuid/v5.ts";

/**
 * Generate a deterministic UUID v5 based on a namespace (university ID) and a value (SIS ID)
 */
export async function generateId(namespace: string, value: string | number): Promise<string> {
  // Ensure namespace is a valid UUID, otherwise use a nil UUID or hash it
  // For now, we assume universityId is a valid UUID.
  // If value is number, convert to string.
  const data = new TextEncoder().encode(String(value));
  return await generate(namespace, data);
}

import type {
  CanonicalCourse,
  CanonicalStudent,
  CanonicalAttendance,
  CanonicalSchedule,
} from '../types/canonical-schema.ts';

// ============================================================================
// Composite ID Generation
// ============================================================================

/**
 * Generate deterministic composite ID for attendance record
 * Format: "courseId-sessionId-userId"
 */
export function generateAttendanceId(
  courseId: number,
  sessionId: number,
  userId: number
): string {
  return `${courseId}-${sessionId}-${userId}`;
}

/**
 * Generate deterministic composite ID for schedule entry
 * Format: "courseId-dayOfWeek-period"
 */
export function generateScheduleId(
  courseId: number,
  dayOfWeek: string,
  period: string
): string {
  return `${courseId}-${dayOfWeek}-${period}`;
}

/**
 * Generate deterministic composite ID for enrollment
 * Format: "courseId-studentId"
 */
export function generateEnrollmentId(
  courseId: number,
  studentId: number
): string {
  return `${courseId}-${studentId}`;
}

// ============================================================================
// Timezone Conversion
// ============================================================================

/**
 * Convert ISO-8601 timestamp to UTC
 * Preserves original timezone in sourceTz field for audit trail
 */
export function toUTC(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toISOString();
}

/**
 * Convert time string (HH:MM:SS) to UTC time
 * Assumes time is in the source timezone
 */
// deno-lint-ignore no-unused-vars
export function timeToUTC(timeString: string, _sourceTz: string): string {
  // For MVP, we'll store times as-is since they're relative to the schedule
  // In production, you'd use a library like date-fns-tz for proper conversion
  return timeString;
}

/**
 * Extract timezone from ISO-8601 timestamp
 */
export function extractTimezone(isoTimestamp: string): string {
  const match = isoTimestamp.match(/([+-]\d{2}:\d{2}|Z)$/);
  if (!match) return 'UTC';
  if (match[1] === 'Z') return 'UTC';
  return match[1];
}

// ============================================================================
// Data Validation
// ============================================================================

/**
 * Validate course data before insert
 */
export function validateCourse(course: CanonicalCourse): string[] {
  const errors: string[] = [];
  
  if (!course.id) errors.push('Course ID is required');
  if (!course.code) errors.push('Course code is required');
  if (!course.name) errors.push('Course name is required');
  if (!course.startAt) errors.push('Course start date is required');
  if (!course.endAt) errors.push('Course end date is required');
  
  // Validate date format
  if (course.startAt && isNaN(Date.parse(course.startAt))) {
    errors.push('Invalid start date format');
  }
  if (course.endAt && isNaN(Date.parse(course.endAt))) {
    errors.push('Invalid end date format');
  }
  
  // Validate date logic
  if (course.startAt && course.endAt) {
    const start = new Date(course.startAt);
    const end = new Date(course.endAt);
    if (start > end) {
      errors.push('Start date must be before end date');
    }
  }
  
  return errors;
}

/**
 * Validate student data before insert
 */
export function validateStudent(student: CanonicalStudent): string[] {
  const errors: string[] = [];
  
  if (!student.id) errors.push('Student ID is required');
  if (!student.email) errors.push('Student email is required');
  if (!student.firstName) errors.push('Student first name is required');
  if (!student.lastName) errors.push('Student last name is required');
  
  // Validate email format
  if (student.email && !isValidEmail(student.email)) {
    errors.push('Invalid email format');
  }
  
  // Validate status
  const validStatuses = ['active', 'inactive', 'suspended'];
  if (student.status && !validStatuses.includes(student.status)) {
    errors.push(`Invalid status: ${student.status}`);
  }
  
  return errors;
}

/**
 * Validate attendance data before insert
 */
export function validateAttendance(attendance: CanonicalAttendance): string[] {
  const errors: string[] = [];
  
  if (!attendance.id) errors.push('Attendance ID is required');
  if (!attendance.courseId) errors.push('Course ID is required');
  if (!attendance.sessionId) errors.push('Session ID is required');
  if (!attendance.userId) errors.push('User ID is required');
  if (!attendance.status) errors.push('Status is required');
  if (!attendance.recordedAt) errors.push('Recorded timestamp is required');
  
  // Validate status
  const validStatuses = ['present', 'late', 'excused', 'absent', 'unknown'];
  if (attendance.status && !validStatuses.includes(attendance.status)) {
    errors.push(`Invalid status: ${attendance.status}`);
  }
  
  // Validate timestamp format
  if (attendance.recordedAt && isNaN(Date.parse(attendance.recordedAt))) {
    errors.push('Invalid recorded timestamp format');
  }
  
  return errors;
}

/**
 * Validate schedule data before insert
 */
export function validateSchedule(schedule: CanonicalSchedule): string[] {
  const errors: string[] = [];
  
  if (!schedule.id) errors.push('Schedule ID is required');
  if (!schedule.courseId) errors.push('Course ID is required');
  if (!schedule.dayOfWeek) errors.push('Day of week is required');
  if (!schedule.startTime) errors.push('Start time is required');
  if (!schedule.endTime) errors.push('End time is required');
  if (!schedule.effectiveFrom) errors.push('Effective from date is required');
  if (!schedule.effectiveTo) errors.push('Effective to date is required');
  
  // Validate day of week
  const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', '1', '2', '3', '4', '5', '6', '7'];
  if (schedule.dayOfWeek && !validDays.includes(schedule.dayOfWeek)) {
    errors.push(`Invalid day of week: ${schedule.dayOfWeek}`);
  }
  
  // Validate time format (HH:MM:SS)
  const timeRegex = /^\d{2}:\d{2}:\d{2}$/;
  if (schedule.startTime && !timeRegex.test(schedule.startTime)) {
    errors.push('Invalid start time format (expected HH:MM:SS)');
  }
  if (schedule.endTime && !timeRegex.test(schedule.endTime)) {
    errors.push('Invalid end time format (expected HH:MM:SS)');
  }
  
  // Validate date format
  if (schedule.effectiveFrom && isNaN(Date.parse(schedule.effectiveFrom))) {
    errors.push('Invalid effective from date format');
  }
  if (schedule.effectiveTo && isNaN(Date.parse(schedule.effectiveTo))) {
    errors.push('Invalid effective to date format');
  }
  
  return errors;
}

// ============================================================================
// Change Detection
// ============================================================================

/**
 * Compare two objects and return changed fields
 */
export function detectChanges(
  // deno-lint-ignore no-explicit-any
  oldData: Record<string, any>,
  // deno-lint-ignore no-explicit-any
  newData: Record<string, any>
  // deno-lint-ignore no-explicit-any
): Record<string, any> {
  // deno-lint-ignore no-explicit-any
  const changes: Record<string, any> = {};
  
  for (const key in newData) {
    if (oldData[key] !== newData[key]) {
      changes[key] = {
        old: oldData[key],
        new: newData[key],
      };
    }
  }
  
  return changes;
}

/**
 * Check if attendance status has changed
 */
export function hasAttendanceChanged(
  oldStatus: string,
  newStatus: string
): boolean {
  return oldStatus !== newStatus;
}

// ============================================================================
// Data Normalization
// ============================================================================

/**
 * Normalize course data for database insert
 */
export async function normalizeCourse(
  universityId: string,
  course: CanonicalCourse
  // deno-lint-ignore no-explicit-any
): Promise<Record<string, any>> {
  return {
    id: await generateId(universityId, `course-${course.id}`),
    university_id: universityId,
    external_id: course.id.toString(),
    code: course.code,
    name: course.name,
    short_name: course.shortName,
    start_at: toUTC(course.startAt),
    end_at: toUTC(course.endAt),
    updated_at: new Date().toISOString(),
    metadata: { sis_id: course.id }
  };
}

/**
 * Normalize student data for database insert
 */
export async function normalizeStudent(
  universityId: string,
  student: CanonicalStudent
  // deno-lint-ignore no-explicit-any
): Promise<Record<string, any>> {
  return {
    id: await generateId(universityId, `student-${student.id}`),
    university_id: universityId,
    external_id: student.id.toString(),
    username: student.username || null,
    email: student.email,
    first_name: student.firstName,
    last_name: student.lastName,
    // full_name is a generated column, do not insert
    status: student.status,
    grade_level: student.gradeLevel || null,
    student_number: student.studentNumber || null,
    updated_at: new Date().toISOString(),
    metadata: { sis_id: student.id }
  };
}

/**
 * Normalize attendance data for database insert
 */
export async function normalizeAttendance(
  universityId: string,
  attendance: CanonicalAttendance,
  actualStudentUuid?: string
  // deno-lint-ignore no-explicit-any
): Promise<Record<string, any>> {
  const courseUuid = await generateId(universityId, `course-${attendance.courseId}`);
  const studentUuid = actualStudentUuid || await generateId(universityId, `student-${attendance.userId}`);

  return {
    id: await generateId(universityId, `attendance-${attendance.id}`),
    university_id: universityId,
    course_id: courseUuid,
    session_id: attendance.sessionId.toString(),
    student_id: studentUuid,
    status: attendance.status,
    status_code: attendance.statusCode,
    recorded_at: toUTC(attendance.recordedAt),
    source_tz: attendance.sourceTz,
    period: attendance.period || null,
    date: attendance.date || null,
    metadata: { ...attendance.metadata, sis_id: attendance.id } || { sis_id: attendance.id },
    updated_at: new Date().toISOString(),
  };
}

/**
 * Normalize schedule data for database insert
 */
export async function normalizeSchedule(
  universityId: string,
  schedule: CanonicalSchedule
  // deno-lint-ignore no-explicit-any
): Promise<Record<string, any>> {
  const courseUuid = await generateId(universityId, `course-${schedule.courseId}`);

  return {
    id: await generateId(universityId, `schedule-${schedule.id}`),
    university_id: universityId,
    course_id: courseUuid,
    day_of_week: schedule.dayOfWeek,
    period: schedule.period || null,
    start_time: schedule.startTime,
    end_time: schedule.endTime,
    location: schedule.location || null,
    instructor_id: schedule.instructorId ? schedule.instructorId.toString() : null,
    effective_from: schedule.effectiveFrom,
    effective_to: schedule.effectiveTo,
    updated_at: new Date().toISOString(),
    metadata: { sis_id: schedule.id }
  };
}

/**
 * Normalize enrollment data for database insert
 */
export async function normalizeEnrollment(
  universityId: string,
  courseId: number | string,
  studentId: number | string,
  actualStudentUuid?: string
  // deno-lint-ignore no-explicit-any
): Promise<Record<string, any>> {
  const courseUuid = await generateId(universityId, `course-${courseId}`);
  const studentUuid = actualStudentUuid || await generateId(universityId, `student-${studentId}`);

  return {
    id: await generateId(universityId, `enrollment-${courseId}-${studentId}`),
    course_id: courseUuid,
    student_id: studentUuid,
    enrolled_at: new Date().toISOString(),
    status: 'active',
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize string for database insert
 */
export function sanitizeString(str: string | null | undefined): string | null {
  if (!str) return null;
  return str.trim();
}

/**
 * Ensure value is within range
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Process data in batches to avoid overwhelming the database
 */
export function* batchIterator<T>(
  items: T[],
  batchSize: number = 100
): Generator<T[], void, unknown> {
  for (let i = 0; i < items.length; i += batchSize) {
    yield items.slice(i, i + batchSize);
  }
}

/**
 * Process items in batches with a callback
 */
export async function processBatches<T>(
  items: T[],
  batchSize: number,
  callback: (batch: T[]) => Promise<void>
): Promise<void> {
  for (const batch of batchIterator(items, batchSize)) {
    await callback(batch);
  }
}
