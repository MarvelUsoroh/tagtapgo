/**
 * Generic REST Adapter with Configurable Mappings
 * 
 * Provides a flexible adapter for custom SIS/LMS systems that don't have
 * dedicated adapters. Supports:
 * - Configurable REST endpoints
 * - Custom field mappings
 * - Webhook receiver for push-based updates
 * - Polling fallback for systems without webhooks
 * 
 * Reference: .kiro/specs/gamification-mvp/OpenAPI.md
 */

import {
  BaseAdapter,
  type GenericConfig,
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
// Field Mapping Types
// ============================================================================

interface FieldMapping {
  // Course mappings
  'course.id'?: string;
  'course.code'?: string;
  'course.name'?: string;
  'course.shortName'?: string;
  'course.startAt'?: string;
  'course.endAt'?: string;
  
  // Student mappings
  'student.id'?: string;
  'student.username'?: string;
  'student.email'?: string;
  'student.firstName'?: string;
  'student.lastName'?: string;
  'student.fullName'?: string;
  'student.status'?: string;
  'student.gradeLevel'?: string;
  'student.studentNumber'?: string;
  
  // Attendance mappings
  'attendance.id'?: string;
  'attendance.courseId'?: string;
  'attendance.sessionId'?: string;
  'attendance.userId'?: string;
  'attendance.status'?: string;
  'attendance.recordedAt'?: string;
  'attendance.period'?: string;
  'attendance.date'?: string;
  
  // Schedule mappings
  'schedule.id'?: string;
  'schedule.courseId'?: string;
  'schedule.dayOfWeek'?: string;
  'schedule.period'?: string;
  'schedule.startTime'?: string;
  'schedule.endTime'?: string;
  'schedule.location'?: string;
  'schedule.instructorId'?: string;
  'schedule.effectiveFrom'?: string;
  'schedule.effectiveTo'?: string;
}

// ============================================================================
// Generic REST Client
// ============================================================================

class GenericRestClient {
  private baseUrl: string;
  private apiKey?: string;
  private authHeader?: string;
  private timezone: string;

  constructor(config: GenericConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.authHeader = config.authHeader || 'Authorization';
    this.timezone = config.timezone;
  }

  /**
   * Make a generic REST API request
   */
  async request<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    // Add query parameters
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    // Add authentication if configured
    if (this.apiKey && this.authHeader) {
      if (this.authHeader === 'Authorization') {
        headers[this.authHeader] = `Bearer ${this.apiKey}`;
      } else {
        headers[this.authHeader] = this.apiKey;
      }
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new AuthenticationError(
            `Authentication failed: ${response.status} ${response.statusText}`,
            { status: response.status }
          );
        }
        throw new FetchError(
          `API request failed: ${response.status} ${response.statusText}`,
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
        `Network error calling API: ${error.message}`,
        { endpoint, originalError: error }
      );
    }
  }
}

// ============================================================================
// Generic Adapter
// ============================================================================

export class GenericAdapter extends BaseAdapter {
  private client: GenericRestClient;
  private fieldMappings: FieldMapping;

  constructor(config: GenericConfig) {
    super(config);
    this.client = new GenericRestClient(config);
    this.fieldMappings = config.fieldMappings || {};
  }

  /**
   * Discover available capabilities
   * Tests each configured endpoint to see if it's available
   */
  async discover(): Promise<AdapterCapabilities> {
    this.log('info', 'Starting capability discovery...');

    const config = this.config as GenericConfig;

    try {
      // Test courses endpoint
      if (config.endpoints.courses) {
        try {
          await this.client.request(config.endpoints.courses, { limit: 1 });
          this.capabilities.courses = true;
          this.log('info', 'Courses endpoint available');
        } catch (error) {
          this.log('warn', 'Courses endpoint not available', error);
          this.capabilities.courses = false;
        }
      }

      // Test roster endpoint
      if (config.endpoints.roster) {
        try {
          await this.client.request(config.endpoints.roster, { limit: 1 });
          this.capabilities.roster = true;
          this.log('info', 'Roster endpoint available');
        } catch (error) {
          this.log('warn', 'Roster endpoint not available', error);
          this.capabilities.roster = false;
        }
      }

      // Test attendance endpoint
      if (config.endpoints.attendance) {
        try {
          await this.client.request(config.endpoints.attendance, { limit: 1 });
          this.capabilities.attendance = true;
          this.log('info', 'Attendance endpoint available');
        } catch (error) {
          this.log('warn', 'Attendance endpoint not available', error);
          this.capabilities.attendance = false;
        }
      }

      // Test schedule endpoint
      if (config.endpoints.schedule) {
        try {
          await this.client.request(config.endpoints.schedule, { limit: 1 });
          this.capabilities.schedule = true;
          this.log('info', 'Schedule endpoint available');
        } catch (error) {
          this.log('warn', 'Schedule endpoint not available', error);
          this.capabilities.schedule = false;
        }
      }

      this.discovered = true;
      this.log('info', 'Capability discovery complete', this.capabilities);

      return this.capabilities;
    } catch (error) {
      throw new DiscoveryError(
        `Failed to discover capabilities: ${error.message}`,
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

    const config = this.config as GenericConfig;
    if (!config.endpoints.courses) {
      return [];
    }

    try {
      this.log('info', 'Fetching courses...');
      
      const response = await this.client.request<any>(config.endpoints.courses);
      
      // Handle both array and object with array property
      const coursesData = Array.isArray(response) ? response : (response.courses || response.data || []);

      const canonicalCourses: CanonicalCourse[] = coursesData.map((course: any) => ({
        id: this.mapField(course, 'course.id', 'id'),
        code: this.mapField(course, 'course.code', 'code'),
        name: this.mapField(course, 'course.name', 'name'),
        shortName: this.mapField(course, 'course.shortName', 'shortName') || this.mapField(course, 'course.code', 'code'),
        startAt: this.normalizeDate(this.mapField(course, 'course.startAt', 'startAt')),
        endAt: this.normalizeDate(this.mapField(course, 'course.endAt', 'endAt')),
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

    const config = this.config as GenericConfig;
    if (!config.endpoints.roster) {
      return [];
    }

    try {
      this.log('info', `Fetching roster for course ${courseId}...`);
      
      // Replace {courseId} placeholder in endpoint
      const endpoint = config.endpoints.roster.replace('{courseId}', String(courseId));
      const response = await this.client.request<any>(endpoint);
      
      // Handle both array and object with array property
      const studentsData = Array.isArray(response) ? response : (response.students || response.data || []);

      const canonicalStudents: CanonicalStudent[] = studentsData.map((student: any) => ({
        id: this.mapField(student, 'student.id', 'id'),
        username: this.mapField(student, 'student.username', 'username'),
        email: this.mapField(student, 'student.email', 'email'),
        firstName: this.mapField(student, 'student.firstName', 'firstName'),
        lastName: this.mapField(student, 'student.lastName', 'lastName'),
        fullName: this.mapField(student, 'student.fullName', 'fullName') || 
                  `${this.mapField(student, 'student.firstName', 'firstName')} ${this.mapField(student, 'student.lastName', 'lastName')}`,
        status: this.normalizeStatus(this.mapField(student, 'student.status', 'status')),
        gradeLevel: this.mapField(student, 'student.gradeLevel', 'gradeLevel'),
        studentNumber: this.mapField(student, 'student.studentNumber', 'studentNumber'),
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

    const config = this.config as GenericConfig;
    if (!config.endpoints.attendance) {
      return [];
    }

    try {
      this.log('info', `Fetching attendance for course ${courseId}...`);
      
      // Replace {courseId} placeholder and add since parameter
      const endpoint = config.endpoints.attendance.replace('{courseId}', String(courseId));
      const params: Record<string, any> = {};
      if (since) {
        params.since = since.toISOString();
      }

      const response = await this.client.request<any>(endpoint, params);
      
      // Handle both array and object with array property
      const attendanceData = Array.isArray(response) ? response : (response.attendance || response.data || []);

      const canonicalAttendance: CanonicalAttendance[] = attendanceData.map((record: any) => {
        const courseIdMapped = this.mapField(record, 'attendance.courseId', 'courseId') || courseId;
        const sessionId = this.mapField(record, 'attendance.sessionId', 'sessionId');
        const userId = this.mapField(record, 'attendance.userId', 'userId');

        return {
          id: this.mapField(record, 'attendance.id', 'id') || generateAttendanceId(courseIdMapped, sessionId, userId),
          courseId: courseIdMapped,
          sessionId: sessionId,
          userId: userId,
          status: normalizeAttendanceStatus(this.mapField(record, 'attendance.status', 'status')),
          statusCode: this.mapField(record, 'attendance.status', 'status'),
          recordedAt: this.normalizeDate(this.mapField(record, 'attendance.recordedAt', 'recordedAt')),
          sourceTz: this.config.timezone,
          period: this.mapField(record, 'attendance.period', 'period'),
          date: this.mapField(record, 'attendance.date', 'date'),
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

    const config = this.config as GenericConfig;
    if (!config.endpoints.schedule) {
      return [];
    }

    try {
      this.log('info', `Fetching schedule for course ${courseId}...`);
      
      // Replace {courseId} placeholder
      const endpoint = config.endpoints.schedule.replace('{courseId}', String(courseId));
      const response = await this.client.request<any>(endpoint);
      
      // Handle both array and object with array property
      const scheduleData = Array.isArray(response) ? response : (response.schedule || response.data || []);

      const canonicalSchedule: CanonicalSchedule[] = scheduleData.map((record: any) => {
        const courseIdMapped = this.mapField(record, 'schedule.courseId', 'courseId') || courseId;
        const dayOfWeek = this.mapField(record, 'schedule.dayOfWeek', 'dayOfWeek');
        const period = this.mapField(record, 'schedule.period', 'period');

        return {
          id: this.mapField(record, 'schedule.id', 'id') || generateScheduleId(courseIdMapped, dayOfWeek, period),
          courseId: courseIdMapped,
          dayOfWeek: dayOfWeek,
          period: period,
          startTime: this.mapField(record, 'schedule.startTime', 'startTime'),
          endTime: this.mapField(record, 'schedule.endTime', 'endTime'),
          location: this.mapField(record, 'schedule.location', 'location'),
          instructorId: this.mapField(record, 'schedule.instructorId', 'instructorId'),
          effectiveFrom: this.mapField(record, 'schedule.effectiveFrom', 'effectiveFrom'),
          effectiveTo: this.mapField(record, 'schedule.effectiveTo', 'effectiveTo'),
        };
      });

      this.log('info', `Fetched ${canonicalSchedule.length} schedule entries for course ${courseId}`);
      
      return canonicalSchedule;
    } catch (error) {
      this.log('warn', `Failed to fetch schedule for course ${courseId}`, error);
      // Don't throw - schedule is optional
      return [];
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Map a field from source data using configured mappings
   */
  private mapField(data: any, mappingKey: keyof FieldMapping, defaultKey: string): any {
    const mappedKey = this.fieldMappings[mappingKey] as string | undefined;
    const key = mappedKey || defaultKey;
    
    // Support nested keys (e.g., "user.profile.name")
    if (key.includes('.')) {
      return key.split('.').reduce((obj, k) => obj?.[k], data);
    }
    
    return data[key];
  }

  /**
   * Normalize date to ISO-8601
   */
  private normalizeDate(value: any): string {
    if (!value) return new Date().toISOString();
    
    // Already ISO-8601
    if (typeof value === 'string' && value.includes('T')) {
      return value;
    }
    
    // Unix timestamp
    if (typeof value === 'number') {
      return new Date(value * 1000).toISOString();
    }
    
    // Date string
    return new Date(value).toISOString();
  }

  /**
   * Normalize status to canonical values
   */
  private normalizeStatus(value: any): 'active' | 'inactive' | 'suspended' {
    if (!value) return 'active';
    
    const status = String(value).toLowerCase();
    if (status === 'active' || status === '1' || status === 'true') return 'active';
    if (status === 'suspended' || status === 'banned') return 'suspended';
    return 'inactive';
  }
}
