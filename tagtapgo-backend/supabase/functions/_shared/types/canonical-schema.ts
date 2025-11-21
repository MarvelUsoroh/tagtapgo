/**
 * Unified Canonical Schema for SIS/LMS Integration
 * 
 * This schema provides a consistent data contract for both Moodle (LMS) and openSIS (SIS).
 * Downstream systems (gamification engine, dashboards, analytics) consume this schema
 * regardless of the source system.
 * 
 * Reference: .kiro/specs/gamification-mvp/OpenAPI.md
 * Version: 1.1
 */

// ============================================================================
// Core Entities
// ============================================================================

/**
 * Student roster entry
 * Combines LMS (Moodle) and SIS (openSIS) student data
 */
export interface CanonicalStudent {
  id: number;
  username?: string;              // LMS-specific (Moodle)
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: 'active' | 'inactive' | 'suspended';
  gradeLevel?: string;            // SIS-specific (e.g., "Undergraduate", "Year 2")
  studentNumber?: string;         // SIS-specific (e.g., "S12345")
}

/**
 * Attendance record
 * Normalized from both session-based (Moodle) and period-based (openSIS) attendance
 */
export interface CanonicalAttendance {
  id: string;                     // Composite: "courseId-sessionId-userId"
  courseId: number;
  sessionId: number;              // Session/period identifier
  userId: number;
  status: 'present' | 'late' | 'excused' | 'absent' | 'unknown';
  statusCode: string;             // Raw code from source system (e.g., "P", "L", "E", "A")
  recordedAt: string;             // ISO-8601 timestamp
  sourceTz: string;               // Source timezone (e.g., "Europe/Dublin")
  period?: string;                // SIS-specific (e.g., "Morning", "Period 1")
  date?: string;                  // SIS-specific (e.g., "2025-10-25")
  metadata?: Record<string, any>; // Additional context (e.g., session topic)
}



/**
 * Class schedule entry
 * Supports both session-based (Moodle) and period-based (openSIS) scheduling
 */
export interface CanonicalSchedule {
  id: string;                     // Composite: "courseId-dayOfWeek-period"
  courseId: number;
  dayOfWeek: string;              // ISO weekday name (e.g., "Monday") or number (1-7)
  period?: string;                // SIS-specific (e.g., "Morning", "Period 1")
  startTime: string;              // Local time (e.g., "09:00:00")
  endTime: string;                // Local time (e.g., "10:30:00")
  location?: string;              // Room/building (e.g., "Room 201", "Building A")
  instructorId?: number;          // Optional link to staff/instructor
  effectiveFrom: string;          // Date when schedule starts (e.g., "2025-09-01")
  effectiveTo: string;            // Date when schedule ends (e.g., "2025-12-15")
}

/**
 * Course with nested roster, attendance, and schedule
 * Note: Grades are NOT included in MVP - gamification is attendance-based only
 */
export interface CanonicalCourse {
  id: number;
  code: string;                   // Course code (e.g., "CS101")
  name: string;                   // Full course name
  shortName: string;              // Short name/abbreviation
  startAt: string;                // ISO-8601 timestamp
  endAt: string;                  // ISO-8601 timestamp
  roster: CanonicalStudent[];
  attendance: CanonicalAttendance[];
  schedule: CanonicalSchedule[];
}

// ============================================================================
// Metadata & Capabilities
// ============================================================================

/**
 * Capability flags indicating which features are available from the source system
 * Note: Grades removed from MVP - gamification is attendance-based only
 */
export interface AdapterCapabilities {
  courses: boolean;               // Always true (core feature)
  roster: boolean;                // Always true (core feature)
  attendance: boolean;            // Optional (depends on plugin/module)
  schedule: boolean;              // Optional (depends on plugin/module)
}

/**
 * Metadata about the data source and fetch operation
 */
export interface CanonicalMeta {
  source: 'moodle' | 'opensis' | 'generic';
  version: string;                // Schema version (e.g., "1.1")
  fetchedAt: string;              // ISO-8601 timestamp
  capabilities: AdapterCapabilities;
}

// ============================================================================
// Root Schema
// ============================================================================

/**
 * Root canonical schema
 * This is the top-level object returned by all adapters
 */
export interface CanonicalSchema {
  courses: CanonicalCourse[];
  meta: CanonicalMeta;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Attendance status mapping
 * Maps raw status codes to canonical status values
 */
export const ATTENDANCE_STATUS_MAP: Record<string, CanonicalAttendance['status']> = {
  // Moodle codes
  'P': 'present',
  'L': 'late',
  'E': 'excused',
  'A': 'absent',
  
  // openSIS codes
  'Present': 'present',
  'Late': 'late',
  'Excused': 'excused',
  'Absent': 'absent',
  
  // Generic fallback
  'present': 'present',
  'late': 'late',
  'excused': 'excused',
  'absent': 'absent',
};

/**
 * Normalize attendance status code to canonical value
 */
export function normalizeAttendanceStatus(statusCode: string): CanonicalAttendance['status'] {
  return ATTENDANCE_STATUS_MAP[statusCode] || 'unknown';
}

/**
 * Generate deterministic composite ID for attendance record
 */
export function generateAttendanceId(courseId: number, sessionId: number, userId: number): string {
  return `${courseId}-${sessionId}-${userId}`;
}



/**
 * Generate deterministic composite ID for schedule entry
 */
export function generateScheduleId(courseId: number, dayOfWeek: string, period: string): string {
  return `${courseId}-${dayOfWeek}-${period}`;
}

/**
 * Validate canonical schema
 * Returns array of validation errors (empty if valid)
 */
export function validateCanonicalSchema(schema: CanonicalSchema): string[] {
  const errors: string[] = [];
  
  if (!schema.courses || !Array.isArray(schema.courses)) {
    errors.push('Missing or invalid courses array');
  }
  
  if (!schema.meta) {
    errors.push('Missing meta object');
  } else {
    if (!['moodle', 'opensis', 'generic'].includes(schema.meta.source)) {
      errors.push(`Invalid source: ${schema.meta.source}`);
    }
    if (!schema.meta.capabilities) {
      errors.push('Missing capabilities object');
    }
  }
  
  return errors;
}
