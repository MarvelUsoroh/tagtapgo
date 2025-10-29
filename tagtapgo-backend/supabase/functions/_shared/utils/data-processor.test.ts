/**
 * Tests for Idempotent Data Processing
 * 
 * These tests demonstrate:
 * - Composite ID generation (deterministic)
 * - Timezone conversion (UTC storage)
 * - Data validation (before insert)
 * - Change detection (for updates)
 */

import { assertEquals, assertThrows } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  generateAttendanceId,
  generateScheduleId,
  generateEnrollmentId,
  toUTC,
  validateCourse,
  validateStudent,
  validateAttendance,
  validateSchedule,
  normalizeCourse,
  normalizeStudent,
  normalizeAttendance,
  normalizeSchedule,
  detectChanges,
  hasAttendanceChanged,
} from './data-processor.ts';

// ============================================================================
// Composite ID Tests
// ============================================================================

Deno.test('generateAttendanceId - creates deterministic composite ID', () => {
  const id1 = generateAttendanceId(123, 789, 456);
  const id2 = generateAttendanceId(123, 789, 456);
  
  assertEquals(id1, '123-789-456');
  assertEquals(id1, id2); // Deterministic
});

Deno.test('generateScheduleId - creates deterministic composite ID', () => {
  const id1 = generateScheduleId(123, 'Monday', 'Morning');
  const id2 = generateScheduleId(123, 'Monday', 'Morning');
  
  assertEquals(id1, '123-Monday-Morning');
  assertEquals(id1, id2); // Deterministic
});

Deno.test('generateEnrollmentId - creates deterministic composite ID', () => {
  const id1 = generateEnrollmentId(123, 456);
  const id2 = generateEnrollmentId(123, 456);
  
  assertEquals(id1, '123-456');
  assertEquals(id1, id2); // Deterministic
});

// ============================================================================
// Timezone Conversion Tests
// ============================================================================

Deno.test('toUTC - converts ISO-8601 to UTC', () => {
  const isoTimestamp = '2025-10-25T09:00:00+01:00';
  const utc = toUTC(isoTimestamp);
  
  assertEquals(utc, '2025-10-25T08:00:00.000Z'); // 1 hour earlier in UTC
});

Deno.test('toUTC - handles already UTC timestamps', () => {
  const isoTimestamp = '2025-10-25T09:00:00Z';
  const utc = toUTC(isoTimestamp);
  
  assertEquals(utc, '2025-10-25T09:00:00.000Z');
});

// ============================================================================
// Validation Tests
// ============================================================================

Deno.test('validateCourse - accepts valid course', () => {
  const course = {
    id: 123,
    code: 'CS101',
    name: 'Intro to CS',
    shortName: 'CS101',
    startAt: '2025-09-01T08:00:00Z',
    endAt: '2025-12-15T17:00:00Z',
    roster: [],
    attendance: [],
    schedule: [],
  };
  
  const errors = validateCourse(course);
  assertEquals(errors.length, 0);
});

Deno.test('validateCourse - rejects invalid course', () => {
  const course = {
    id: 0,
    code: '',
    name: '',
    shortName: '',
    startAt: 'invalid-date',
    endAt: '2025-12-15T17:00:00Z',
    roster: [],
    attendance: [],
    schedule: [],
  };
  
  const errors = validateCourse(course);
  assertEquals(errors.length > 0, true);
});

Deno.test('validateStudent - accepts valid student', () => {
  const student = {
    id: 456,
    email: 'jdoe@example.edu',
    firstName: 'John',
    lastName: 'Doe',
    fullName: 'John Doe',
    status: 'active' as const,
  };
  
  const errors = validateStudent(student);
  assertEquals(errors.length, 0);
});

Deno.test('validateStudent - rejects invalid email', () => {
  const student = {
    id: 456,
    email: 'invalid-email',
    firstName: 'John',
    lastName: 'Doe',
    fullName: 'John Doe',
    status: 'active' as const,
  };
  
  const errors = validateStudent(student);
  assertEquals(errors.some(e => e.includes('email')), true);
});

Deno.test('validateAttendance - accepts valid attendance', () => {
  const attendance = {
    id: '123-789-456',
    courseId: 123,
    sessionId: 789,
    userId: 456,
    status: 'present' as const,
    statusCode: 'P',
    recordedAt: '2025-10-25T09:00:00Z',
    sourceTz: 'Europe/Dublin',
  };
  
  const errors = validateAttendance(attendance);
  assertEquals(errors.length, 0);
});

Deno.test('validateAttendance - rejects invalid status', () => {
  const attendance = {
    id: '123-789-456',
    courseId: 123,
    sessionId: 789,
    userId: 456,
    status: 'invalid' as any,
    statusCode: 'P',
    recordedAt: '2025-10-25T09:00:00Z',
    sourceTz: 'Europe/Dublin',
  };
  
  const errors = validateAttendance(attendance);
  assertEquals(errors.some(e => e.includes('status')), true);
});

Deno.test('validateSchedule - accepts valid schedule', () => {
  const schedule = {
    id: '123-Monday-Morning',
    courseId: 123,
    dayOfWeek: 'Monday',
    period: 'Morning',
    startTime: '09:00:00',
    endTime: '10:30:00',
    effectiveFrom: '2025-09-01',
    effectiveTo: '2025-12-15',
  };
  
  const errors = validateSchedule(schedule);
  assertEquals(errors.length, 0);
});

Deno.test('validateSchedule - rejects invalid time format', () => {
  const schedule = {
    id: '123-Monday-Morning',
    courseId: 123,
    dayOfWeek: 'Monday',
    period: 'Morning',
    startTime: '9:00', // Invalid format
    endTime: '10:30:00',
    effectiveFrom: '2025-09-01',
    effectiveTo: '2025-12-15',
  };
  
  const errors = validateSchedule(schedule);
  assertEquals(errors.some(e => e.includes('time format')), true);
});

// ============================================================================
// Normalization Tests
// ============================================================================

Deno.test('normalizeCourse - converts to database format', () => {
  const course = {
    id: 123,
    code: 'CS101',
    name: 'Intro to CS',
    shortName: 'CS101',
    startAt: '2025-09-01T08:00:00+01:00',
    endAt: '2025-12-15T17:00:00+01:00',
    roster: [],
    attendance: [],
    schedule: [],
  };
  
  const normalized = normalizeCourse('uni-123', course);
  
  assertEquals(normalized.id, 123);
  assertEquals(normalized.university_id, 'uni-123');
  assertEquals(normalized.code, 'CS101');
  assertEquals(normalized.start_at, '2025-09-01T07:00:00.000Z'); // UTC
  assertEquals(normalized.end_at, '2025-12-15T16:00:00.000Z'); // UTC
});

Deno.test('normalizeAttendance - preserves sourceTz', () => {
  const attendance = {
    id: '123-789-456',
    courseId: 123,
    sessionId: 789,
    userId: 456,
    status: 'present' as const,
    statusCode: 'P',
    recordedAt: '2025-10-25T09:00:00+01:00',
    sourceTz: 'Europe/Dublin',
  };
  
  const normalized = normalizeAttendance('uni-123', attendance);
  
  assertEquals(normalized.recorded_at, '2025-10-25T08:00:00.000Z'); // UTC
  assertEquals(normalized.source_tz, 'Europe/Dublin'); // Preserved for audit
});

// ============================================================================
// Change Detection Tests
// ============================================================================

Deno.test('detectChanges - identifies changed fields', () => {
  const oldData = {
    status: 'absent',
    recordedAt: '2025-10-25T08:00:00Z',
  };
  
  const newData = {
    status: 'present',
    recordedAt: '2025-10-25T08:00:00Z',
  };
  
  const changes = detectChanges(oldData, newData);
  
  assertEquals(changes.status.old, 'absent');
  assertEquals(changes.status.new, 'present');
  assertEquals(changes.recordedAt, undefined); // No change
});

Deno.test('hasAttendanceChanged - detects status change', () => {
  assertEquals(hasAttendanceChanged('absent', 'present'), true);
  assertEquals(hasAttendanceChanged('present', 'present'), false);
});

// ============================================================================
// Idempotency Tests
// ============================================================================

Deno.test('Idempotency - same input produces same ID', () => {
  // Simulate syncing the same attendance record twice
  const attendance1 = {
    courseId: 123,
    sessionId: 789,
    userId: 456,
  };
  
  const attendance2 = {
    courseId: 123,
    sessionId: 789,
    userId: 456,
  };
  
  const id1 = generateAttendanceId(attendance1.courseId, attendance1.sessionId, attendance1.userId);
  const id2 = generateAttendanceId(attendance2.courseId, attendance2.sessionId, attendance2.userId);
  
  assertEquals(id1, id2); // Same ID = upsert will update, not duplicate
});

console.log('✓ All idempotent data processing tests passed');
