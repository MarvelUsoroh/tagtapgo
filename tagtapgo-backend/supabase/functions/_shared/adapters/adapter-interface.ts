/**
 * Adapter Interface for SIS/LMS Integration
 * 
 * Defines the contract that all adapters (Moodle, openSIS, Generic REST) must implement.
 * Uses the discovery + fallback pattern to handle varying capabilities across institutions.
 * 
 * Reference: .kiro/specs/gamification-mvp/OpenAPI.md
 */

import type {
  CanonicalSchema,
  CanonicalCourse,
  CanonicalStudent,
  CanonicalAttendance,
  CanonicalSchedule,
  AdapterCapabilities,
} from '../types/canonical-schema.ts';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Base adapter configuration
 * Extended by specific adapter types (Moodle, openSIS, etc.)
 */
export interface AdapterConfig {
  type: 'moodle' | 'opensis' | 'generic';
  universityId: string;
  baseUrl: string;
  timezone: string;              // Target timezone (e.g., "Europe/Dublin")
}

/**
 * Moodle-specific configuration
 */
export interface MoodleConfig extends AdapterConfig {
  type: 'moodle';
  token: string;                 // Moodle web service token
  serviceName?: string;          // Optional service name
}

/**
 * openSIS-specific configuration
 */
export interface OpenSISConfig extends AdapterConfig {
  type: 'opensis';
  apiKey?: string;               // API key (if using REST API)
  dbHost?: string;               // PostgreSQL host (if using direct access)
  dbPort?: number;               // PostgreSQL port
  dbName?: string;               // Database name
  dbUser?: string;               // Database user
  dbPassword?: string;           // Database password
  useDirectAccess: boolean;      // true = PostgreSQL, false = REST API
}

/**
 * Generic REST adapter configuration
 */
export interface GenericConfig extends AdapterConfig {
  type: 'generic';
  apiKey?: string;
  authHeader?: string;           // Custom auth header name
  endpoints: {
    courses?: string;
    roster?: string;
    attendance?: string;
    grades?: string;
    schedule?: string;
  };
  fieldMappings?: Record<string, string>;  // Custom field name mappings
}

export type AnyAdapterConfig = MoodleConfig | OpenSISConfig | GenericConfig;

// ============================================================================
// Error Types
// ============================================================================

export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

export class DiscoveryError extends AdapterError {
  constructor(message: string, details?: unknown) {
    super(message, 'DISCOVERY_ERROR', details);
    this.name = 'DiscoveryError';
  }
}

export class FetchError extends AdapterError {
  constructor(message: string, details?: unknown) {
    super(message, 'FETCH_ERROR', details);
    this.name = 'FetchError';
  }
}

export class NormalizationError extends AdapterError {
  constructor(message: string, details?: unknown) {
    super(message, 'NORMALIZATION_ERROR', details);
    this.name = 'NormalizationError';
  }
}

export class AuthenticationError extends AdapterError {
  constructor(message: string, details?: unknown) {
    super(message, 'AUTHENTICATION_ERROR', details);
    this.name = 'AuthenticationError';
  }
}

// ============================================================================
// Adapter Interface
// ============================================================================

/**
 * Core adapter interface
 * All adapters must implement these methods
 */
export interface IAdapter {
  /**
   * Discover available capabilities
   * Called on startup to detect which features are available
   * 
   * @returns Promise<AdapterCapabilities>
   * @throws DiscoveryError if discovery fails
   */
  discover(): Promise<AdapterCapabilities>;

  /**
   * Get current capabilities
   * Returns cached capabilities from last discovery
   * 
   * @returns AdapterCapabilities
   */
  getCapabilities(): AdapterCapabilities;

  /**
   * Fetch all data (courses, roster, attendance, schedule)
   * Returns complete canonical schema
   * Note: Grades excluded from MVP - gamification is attendance-based only
   * 
   * @param since - Optional timestamp to fetch only records since this time
   * @returns Promise<CanonicalSchema>
   * @throws FetchError if fetch fails
   */
  fetchAll(since?: Date): Promise<CanonicalSchema>;

  /**
   * Fetch courses only
   * 
   * @returns Promise<CanonicalCourse[]>
   * @throws FetchError if fetch fails
   */
  fetchCourses(): Promise<CanonicalCourse[]>;

  /**
   * Fetch roster for a specific course
   * 
   * @param courseId - Course identifier
   * @returns Promise<CanonicalStudent[]>
   * @throws FetchError if fetch fails
   */
  fetchRoster(courseId: number): Promise<CanonicalStudent[]>;

  /**
   * Fetch attendance records for a specific course
   * 
   * @param courseId - Course identifier
   * @param since - Optional timestamp to fetch only records since this time
   * @returns Promise<CanonicalAttendance[]>
   * @throws FetchError if fetch fails
   */
  fetchAttendance(courseId: number, since?: Date): Promise<CanonicalAttendance[]>;



  /**
   * Fetch schedule for a specific course
   * 
   * @param courseId - Course identifier
   * @returns Promise<CanonicalSchedule[]>
   * @throws FetchError if fetch fails
   */
  fetchSchedule(courseId: number): Promise<CanonicalSchedule[]>;

  /**
   * Health check
   * Verifies connectivity and authentication
   * 
   * @returns Promise<boolean> - true if healthy, false otherwise
   */
  healthCheck(): Promise<boolean>;
}

// ============================================================================
// Base Adapter Class
// ============================================================================

/**
 * Base adapter class with common functionality
 * Specific adapters (Moodle, openSIS) extend this class
 */
export abstract class BaseAdapter implements IAdapter {
  protected capabilities: AdapterCapabilities = {
    courses: false,
    roster: false,
    attendance: false,
    schedule: false,
  };

  protected discovered = false;

  constructor(protected config: AnyAdapterConfig) {}

  /**
   * Discover capabilities (must be implemented by subclasses)
   */
  abstract discover(): Promise<AdapterCapabilities>;

  /**
   * Get current capabilities
   */
  getCapabilities(): AdapterCapabilities {
    if (!this.discovered) {
      throw new Error('Capabilities not discovered yet. Call discover() first.');
    }
    return { ...this.capabilities };
  }

  /**
   * Fetch all data
   * Default implementation calls individual fetch methods
   */
  async fetchAll(since?: Date): Promise<CanonicalSchema> {
    const courses = await this.fetchCourses();

    // Fetch nested data for each course
    for (const course of courses) {
      if (this.capabilities.roster) {
        course.roster = await this.fetchRoster(course.id);
      }
      if (this.capabilities.attendance) {
        course.attendance = await this.fetchAttendance(course.id, since);
      }
      if (this.capabilities.schedule) {
        course.schedule = await this.fetchSchedule(course.id);
      }
    }

    return {
      courses,
      meta: {
        source: this.config.type,
        version: '1.1',
        fetchedAt: new Date().toISOString(),
        capabilities: this.getCapabilities(),
      },
    };
  }

  /**
   * Fetch methods (must be implemented by subclasses)
   * Note: fetchGrades removed from MVP - gamification is attendance-based only
   */
  abstract fetchCourses(): Promise<CanonicalCourse[]>;
  abstract fetchRoster(courseId: number): Promise<CanonicalStudent[]>;
  abstract fetchAttendance(courseId: number, since?: Date): Promise<CanonicalAttendance[]>;
  abstract fetchSchedule(courseId: number): Promise<CanonicalSchedule[]>;

  /**
   * Health check (default implementation)
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.discover();
      return true;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * Utility: Log with adapter context
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, details?: unknown): void {
    const logMessage = `[${this.config.type.toUpperCase()}] [${this.config.universityId}] ${message}`;
    
    if (level === 'error') {
      console.error(logMessage, details);
    } else if (level === 'warn') {
      console.warn(logMessage, details);
    } else {
      console.log(logMessage, details);
    }
  }
}
