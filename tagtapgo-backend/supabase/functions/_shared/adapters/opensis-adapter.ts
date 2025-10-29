/**
 * openSIS Adapter with Discovery + Fallback
 * 
 * Implements school-agnostic openSIS integration using capability discovery.
 * Supports both PostgreSQL direct access (self-hosted) and REST API (cloud-hosted).
 * Detects available modules at runtime and gracefully degrades when features are disabled.
 * 
 * Reference: .kiro/specs/gamification-mvp/OpenAPI.md
 */

import {
  BaseAdapter,
  type OpenSISConfig,
  FetchError,
  DiscoveryError,
  AuthenticationError,
} from './adapter-interface.ts';
import type {
  CanonicalCourse,
  CanonicalStudent,
  CanonicalAttendance,
  CanonicalSchedule,
  AdapterCapabilities,
} from '../types/canonical-schema.ts';
import {
  normalizeAttendanceStatus,
  generateAttendanceId,
  generateScheduleId,
} from '../types/canonical-schema.ts';

// ============================================================================
// openSIS API Types
// ============================================================================

interface OpenSISCourse {
  course_id: number;
  course_code: string;
  course_title: string;
  course_short_name?: string;
  start_date: string;
  end_date: string;
}

interface OpenSISStudent {
  student_id: number;
  student_number: string;
  first_name: string;
  last_name: string;
  email: string;
  grade_level?: string;
  status?: string;
}

interface OpenSISAttendance {
  attendance_id?: number;
  student_id: number;
  course_id: number;
  date: string;
  period?: string;
  status: string;              // Present, Late, Excused, Absent
  recorded_at?: string;
}

interface OpenSISSchedule {
  schedule_id?: number;
  course_id: number;
  day_of_week: string | number;
  period: string;
  start_time: string;
  end_time: string;
  room?: string;
  teacher_id?: number;
  start_date: string;
  end_date: string;
}

// ============================================================================
// openSIS Client (REST API)
// ============================================================================

class OpenSISRestClient {
  private baseUrl: string;
  private apiKey: string;
  private timezone: string;

  constructor(config: OpenSISConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey || '';
    this.timezone = config.timezone;
  }

  /**
   * Make an openSIS REST API request
   */
  async request<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}/api/${endpoint}`);
    
    // Add query parameters
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new AuthenticationError(
            `openSIS authentication failed: ${response.status} ${response.statusText}`,
            { status: response.status }
          );
        }
        throw new FetchError(
          `openSIS API request failed: ${response.status} ${response.statusText}`,
          { endpoint, status: response.status }
        );
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof FetchError) {
        throw error;
      }
      throw new FetchError(
        `Network error calling openSIS API: ${error.message}`,
        { endpoint, originalError: error }
      );
    }
  }
}

// ============================================================================
// openSIS Adapter
// ============================================================================

export class OpenSISAdapter extends BaseAdapter {
  private client: OpenSISRestClient | null = null;
  private useDirectAccess: boolean;

  constructor(config: OpenSISConfig) {
    super(config);
    this.useDirectAccess = config.useDirectAccess;
    
    if (!this.useDirectAccess) {
      this.client = new OpenSISRestClient(config);
    }
  }

  /**
   * Discover available capabilities
   * For openSIS, we check which modules are enabled via API metadata
   */
  async discover(): Promise<AdapterCapabilities> {
    this.log('info', 'Starting capability discovery...');

    try {
      if (this.useDirectAccess) {
        // PostgreSQL direct access - assume all core features available
        this.log('info', 'Using PostgreSQL direct access - assuming all core features available');
        this.capabilities = {
          courses: true,
          roster: true,
          attendance: true,
          schedule: true,
        };
      } else {
        // REST API - check available endpoints
        try {
          // Try to fetch a test course to verify API access
          await this.client!.request('courses', { limit: 1 });
          this.capabilities.courses = true;
          this.capabilities.roster = true;

          // Try attendance endpoint
          try {
            await this.client!.request('attendance', { limit: 1 });
            this.capabilities.attendance = true;
          } catch (error) {
            this.log('warn', 'Attendance module not available');
            this.capabilities.attendance = false;
          }

          // Try schedule endpoint
          try {
            await this.client!.request('schedules', { limit: 1 });
            this.capabilities.schedule = true;
          } catch (error) {
            this.log('warn', 'Schedule module not available');
            this.capabilities.schedule = false;
          }
        } catch (error) {
          throw new DiscoveryError(
            `Failed to verify openSIS API access: ${error.message}`,
            { originalError: error }
          );
        }
      }

      this.discovered = true;
      this.log('info', 'Capability discovery complete', this.capabilities);

      return this.capabilities;
    } catch (error) {
      throw new DiscoveryError(
        `Failed to discover openSIS capabilities: ${error.message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Fetch all courses
   */
  async fetchCourses(): Promise<CanonicalCourse[]> {
    if (!this.capabilities.courses) {
      this.log('warn', 'Courses capability not available');
      return [];
    }

    try {
      this.log('info', 'Fetching courses...');

      let courses: OpenSISCourse[];

      if (this.useDirectAccess) {
        courses = await this.fetchCoursesFromDB();
      } else {
        const response = await this.client!.request<{ courses: OpenSISCourse[] }>('courses');
        courses = response.courses || [];
      }

      const canonicalCourses: CanonicalCourse[] = courses.map(course => ({
        id: course.course_id,
        code: course.course_code,
        name: course.course_title,
        shortName: course.course_short_name || course.course_code,
        startAt: new Date(course.start_date).toISOString(),
        endAt: new Date(course.end_date).toISOString(),
        roster: [],
        attendance: [],
        schedule: [],
      }));

      this.log('info', `Fetched ${canonicalCourses.length} courses`);

      return canonicalCourses;
    } catch (error) {
      throw new FetchError(
        `Failed to fetch courses: ${error.message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Fetch roster for a specific course
   */
  async fetchRoster(courseId: number): Promise<CanonicalStudent[]> {
    if (!this.capabilities.roster) {
      this.log('warn', 'Roster capability not available');
      return [];
    }

    try {
      this.log('info', `Fetching roster for course ${courseId}...`);

      let students: OpenSISStudent[];

      if (this.useDirectAccess) {
        students = await this.fetchRosterFromDB(courseId);
      } else {
        const response = await this.client!.request<{ students: OpenSISStudent[] }>(
          `courses/${courseId}/students`
        );
        students = response.students || [];
      }

      const canonicalStudents: CanonicalStudent[] = students.map(student => ({
        id: student.student_id,
        email: student.email,
        firstName: student.first_name,
        lastName: student.last_name,
        fullName: `${student.first_name} ${student.last_name}`,
        status: student.status === 'Active' ? 'active' : 'inactive',
        gradeLevel: student.grade_level,
        studentNumber: student.student_number,
      }));

      this.log('info', `Fetched ${canonicalStudents.length} students for course ${courseId}`);

      return canonicalStudents;
    } catch (error) {
      throw new FetchError(
        `Failed to fetch roster for course ${courseId}: ${error.message}`,
        { courseId, originalError: error }
      );
    }
  }

  /**
   * Fetch attendance records for a specific course
   */
  async fetchAttendance(courseId: number, since?: Date): Promise<CanonicalAttendance[]> {
    if (!this.capabilities.attendance) {
      this.log('warn', 'Attendance capability not available - skipping');
      return [];
    }

    try {
      this.log('info', `Fetching attendance for course ${courseId}...`);

      let attendanceRecords: OpenSISAttendance[];

      if (this.useDirectAccess) {
        attendanceRecords = await this.fetchAttendanceFromDB(courseId, since);
      } else {
        const params: Record<string, any> = { course_id: courseId };
        if (since) {
          params.since = since.toISOString().split('T')[0];
        }
        const response = await this.client!.request<{ attendance: OpenSISAttendance[] }>(
          'attendance',
          params
        );
        attendanceRecords = response.attendance || [];
      }

      const canonicalAttendance: CanonicalAttendance[] = attendanceRecords.map(record => {
        // Generate session ID from date and period
        const sessionId = record.period
          ? parseInt(`${courseId}${record.date.replace(/-/g, '')}${record.period.charCodeAt(0)}`)
          : parseInt(`${courseId}${record.date.replace(/-/g, '')}`);

        return {
          id: generateAttendanceId(courseId, sessionId, record.student_id),
          courseId: courseId,
          sessionId: sessionId,
          userId: record.student_id,
          status: normalizeAttendanceStatus(record.status),
          statusCode: record.status,
          recordedAt: record.recorded_at || new Date(record.date).toISOString(),
          sourceTz: this.config.timezone,
          period: record.period,
          date: record.date,
        };
      });

      this.log('info', `Fetched ${canonicalAttendance.length} attendance records for course ${courseId}`);

      return canonicalAttendance;
    } catch (error) {
      throw new FetchError(
        `Failed to fetch attendance for course ${courseId}: ${error.message}`,
        { courseId, originalError: error }
      );
    }
  }

  /**
   * Fetch schedule for a specific course
   */
  async fetchSchedule(courseId: number): Promise<CanonicalSchedule[]> {
    if (!this.capabilities.schedule) {
      this.log('warn', 'Schedule capability not available - skipping');
      return [];
    }

    try {
      this.log('info', `Fetching schedule for course ${courseId}...`);

      let scheduleRecords: OpenSISSchedule[];

      if (this.useDirectAccess) {
        scheduleRecords = await this.fetchScheduleFromDB(courseId);
      } else {
        const response = await this.client!.request<{ schedules: OpenSISSchedule[] }>(
          `courses/${courseId}/schedules`
        );
        scheduleRecords = response.schedules || [];
      }

      const canonicalSchedule: CanonicalSchedule[] = scheduleRecords.map(record => ({
        id: generateScheduleId(courseId, String(record.day_of_week), record.period),
        courseId: courseId,
        dayOfWeek: typeof record.day_of_week === 'number'
          ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][record.day_of_week]
          : record.day_of_week,
        period: record.period,
        startTime: record.start_time,
        endTime: record.end_time,
        location: record.room,
        instructorId: record.teacher_id,
        effectiveFrom: record.start_date,
        effectiveTo: record.end_date,
      }));

      this.log('info', `Fetched ${canonicalSchedule.length} schedule entries for course ${courseId}`);

      return canonicalSchedule;
    } catch (error) {
      this.log('warn', `Failed to fetch schedule for course ${courseId}`, error);
      // Don't throw - schedule is optional
      return [];
    }
  }

  // ============================================================================
  // PostgreSQL Direct Access Methods (Placeholder)
  // ============================================================================

  private async fetchCoursesFromDB(): Promise<OpenSISCourse[]> {
    // TODO: Implement PostgreSQL direct access
    // This would use a PostgreSQL client to query the openSIS database directly
    throw new Error('PostgreSQL direct access not yet implemented');
  }

  private async fetchRosterFromDB(courseId: number): Promise<OpenSISStudent[]> {
    // TODO: Implement PostgreSQL direct access
    throw new Error('PostgreSQL direct access not yet implemented');
  }

  private async fetchAttendanceFromDB(courseId: number, since?: Date): Promise<OpenSISAttendance[]> {
    // TODO: Implement PostgreSQL direct access
    throw new Error('PostgreSQL direct access not yet implemented');
  }

  private async fetchScheduleFromDB(courseId: number): Promise<OpenSISSchedule[]> {
    // TODO: Implement PostgreSQL direct access
    throw new Error('PostgreSQL direct access not yet implemented');
  }
}
