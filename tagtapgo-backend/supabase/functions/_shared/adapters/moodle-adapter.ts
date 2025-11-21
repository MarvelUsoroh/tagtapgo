/**
 * Moodle Adapter with Discovery + Fallback
 *
 * Implements school-agnostic Moodle integration using capability discovery.
 * Detects available web service functions at runtime and gracefully degrades
 * when optional plugins (attendance, schedule) are not available.
 *
 * Reference: .kiro/specs/gamification-mvp/OpenAPI.md
 */

import {
  BaseAdapter,
  type MoodleConfig,
  FetchError,
  DiscoveryError,
  AuthenticationError,
} from "./adapter-interface.ts";
import type {
  CanonicalCourse,
  CanonicalStudent,
  CanonicalAttendance,
  CanonicalSchedule,
  AdapterCapabilities,
} from "../types/canonical-schema.ts";
import {
  normalizeAttendanceStatus,
  generateAttendanceId,
  generateScheduleId,
} from "../types/canonical-schema.ts";

// ============================================================================
// Moodle API Types
// ============================================================================

interface MoodleSiteInfo {
  sitename: string;
  username: string;
  userid: number;
  functions: Array<{
    name: string;
    version: string;
  }>;
}

interface MoodleCourse {
  id: number;
  shortname: string;
  fullname: string;
  startdate: number; // Unix timestamp
  enddate: number; // Unix timestamp
}

interface MoodleUser {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  fullname: string;
  email: string;
  suspended: boolean;
}

interface MoodleAttendanceSession {
  id: number;
  courseid: number;
  sessdate: number; // Unix timestamp
  duration: number; // Duration in seconds
  description: string;
  statuses: Array<{
    id: number;
    acronym: string; // P, L, E, A
    description: string;
  }>;
}

interface MoodleAttendanceLog {
  sessionid: number;
  studentid: number;
  statusid: number;
  statusset: string;
  timetaken: number; // Unix timestamp
}

// ============================================================================
// Moodle Client
// ============================================================================

class MoodleClient {
  private baseUrl: string;
  private token: string;
  private timezone: string;

  constructor(config: MoodleConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.token = config.token;
    this.timezone = config.timezone;
  }

  /**
   * Make a Moodle web service request
   */
  async request<T>(
    wsfunction: string,
    params: Record<string, any> = {}
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}/webservice/rest/server.php`);
    url.searchParams.set("wstoken", this.token);
    url.searchParams.set("wsfunction", wsfunction);
    url.searchParams.set("moodlewsrestformat", "json");

    // Add function parameters
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === "object") {
            for (const [subKey, subValue] of Object.entries(item)) {
              url.searchParams.set(
                `${key}[${index}][${subKey}]`,
                String(subValue)
              );
            }
          } else {
            url.searchParams.set(`${key}[${index}]`, String(item));
          }
        });
      } else {
        url.searchParams.set(key, String(value));
      }
    }

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new FetchError(
          `Moodle API request failed: ${response.status} ${response.statusText}`,
          { wsfunction, status: response.status }
        );
      }

      const data = await response.json();

      // Check for Moodle error response
      if (data.exception) {
        if (
          data.errorcode === "invalidtoken" ||
          data.errorcode === "accessexception"
        ) {
          throw new AuthenticationError(
            `Moodle authentication failed: ${data.message}`,
            { errorcode: data.errorcode }
          );
        }
        throw new FetchError(`Moodle error: ${data.message}`, {
          errorcode: data.errorcode,
          wsfunction,
        });
      }

      return data as T;
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof FetchError) {
        throw error;
      }
      throw new FetchError(
        `Network error calling Moodle API: ${error.message}`,
        { wsfunction, originalError: error }
      );
    }
  }

  /**
   * Convert Unix timestamp to ISO-8601 string
   */
  timestampToISO(timestamp: number): string {
    return new Date(timestamp * 1000).toISOString();
  }
}

// ============================================================================
// Moodle Adapter
// ============================================================================

export class MoodleAdapter extends BaseAdapter {
  private client: MoodleClient;
  private availableFunctions: Set<string> = new Set();

  constructor(config: MoodleConfig) {
    super(config);
    this.client = new MoodleClient(config);
  }

  /**
   * Discover available capabilities
   * Calls core_webservice_get_site_info to detect which functions are exposed
   */
  async discover(): Promise<AdapterCapabilities> {
    this.log("info", "Starting capability discovery...");

    try {
      const siteInfo = await this.client.request<MoodleSiteInfo>(
        "core_webservice_get_site_info"
      );

      // Build set of available functions
      this.availableFunctions = new Set(siteInfo.functions.map((f) => f.name));

      this.log(
        "info",
        `Discovered ${this.availableFunctions.size} available functions`
      );

      // Core functions (always available)
      this.capabilities.courses = this.availableFunctions.has(
        "core_course_get_courses"
      );
      this.capabilities.roster = this.availableFunctions.has(
        "core_enrol_get_enrolled_users"
      );

      // Optional: Attendance plugin
      this.capabilities.attendance =
        this.availableFunctions.has("mod_attendance_get_sessions") &&
        this.availableFunctions.has("mod_attendance_get_session");

      // Optional: Schedule (calendar events or course sections)
      this.capabilities.schedule =
        this.availableFunctions.has("core_calendar_get_calendar_events") ||
        this.availableFunctions.has("core_course_get_contents");

      this.discovered = true;

      this.log("info", "Capability discovery complete", this.capabilities);

      // Log warnings for missing optional features
      if (!this.capabilities.attendance) {
        this.log(
          "warn",
          "Attendance plugin not available - attendance sync will be skipped"
        );
      }
      if (!this.capabilities.schedule) {
        this.log(
          "warn",
          "Schedule functions not available - schedule sync will be skipped"
        );
      }

      return this.capabilities;
    } catch (error) {
      throw new DiscoveryError(
        `Failed to discover Moodle capabilities: ${error.message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Fetch all courses
   */
  async fetchCourses(): Promise<CanonicalCourse[]> {
    if (!this.capabilities.courses) {
      this.log("warn", "Courses capability not available");
      return [];
    }

    try {
      this.log("info", "Fetching courses...");

      const courses = await this.client.request<MoodleCourse[]>(
        "core_course_get_courses"
      );

      const canonicalCourses: CanonicalCourse[] = courses.map((course) => ({
        id: course.id,
        code: course.shortname,
        name: course.fullname,
        shortName: course.shortname,
        startAt: this.client.timestampToISO(course.startdate),
        endAt: this.client.timestampToISO(course.enddate),
        roster: [],
        attendance: [],
        schedule: [],
      }));

      this.log("info", `Fetched ${canonicalCourses.length} courses`);

      return canonicalCourses;
    } catch (error) {
      throw new FetchError(`Failed to fetch courses: ${error.message}`, {
        originalError: error,
      });
    }
  }

  /**
   * Fetch roster for a specific course
   */
  async fetchRoster(courseId: number): Promise<CanonicalStudent[]> {
    if (!this.capabilities.roster) {
      this.log("warn", "Roster capability not available");
      return [];
    }

    try {
      this.log("info", `Fetching roster for course ${courseId}...`);

      const users = await this.client.request<MoodleUser[]>(
        "core_enrol_get_enrolled_users",
        {
          courseid: courseId,
        }
      );

      const canonicalStudents: CanonicalStudent[] = users.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstname,
        lastName: user.lastname,
        fullName: user.fullname,
        status: user.suspended ? "suspended" : "active",
      }));

      this.log(
        "info",
        `Fetched ${canonicalStudents.length} students for course ${courseId}`
      );

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
  async fetchAttendance(
    courseId: number,
    since?: Date
  ): Promise<CanonicalAttendance[]> {
    if (!this.capabilities.attendance) {
      this.log("warn", "Attendance capability not available - skipping");
      return [];
    }

    try {
      this.log("info", `Fetching attendance for course ${courseId}...`);

      // Get attendance sessions
      const sessions = await this.client.request<MoodleAttendanceSession[]>(
        "mod_attendance_get_sessions",
        { courseid: courseId }
      );

      if (!sessions || sessions.length === 0) {
        this.log("info", `No attendance sessions found for course ${courseId}`);
        return [];
      }

      // Filter sessions by date if 'since' is provided
      const filteredSessions = since
        ? sessions.filter(
            (s) => s.sessdate >= Math.floor(since.getTime() / 1000)
          )
        : sessions;

      // Get attendance logs for each session
      const allAttendance: CanonicalAttendance[] = [];

      for (const session of filteredSessions) {
        try {
          const logs = await this.client.request<MoodleAttendanceLog[]>(
            "mod_attendance_get_session",
            { sessionid: session.id }
          );

          // Find status mapping (P/L/E/A)
          const statusMap = new Map(
            session.statuses.map((s) => [s.id, s.acronym])
          );

          for (const log of logs) {
            const statusCode = statusMap.get(log.statusid) || "U";

            allAttendance.push({
              id: generateAttendanceId(courseId, session.id, log.studentid),
              courseId: courseId,
              sessionId: session.id,
              userId: log.studentid,
              status: normalizeAttendanceStatus(statusCode),
              statusCode: statusCode,
              recordedAt: this.client.timestampToISO(log.timetaken),
              sourceTz: this.config.timezone,
              metadata: {
                topic: session.description,
              },
            });
          }
        } catch (error) {
          this.log(
            "warn",
            `Failed to fetch attendance for session ${session.id}`,
            error
          );
          // Continue with other sessions
        }
      }

      this.log(
        "info",
        `Fetched ${allAttendance.length} attendance records for course ${courseId}`
      );

      return allAttendance;
    } catch (error) {
      throw new FetchError(
        `Failed to fetch attendance for course ${courseId}: ${error.message}`,
        { courseId, originalError: error }
      );
    }
  }

  /**
   * Fetch schedule for a specific course
   * Uses calendar events as a proxy for class schedule
   */
  async fetchSchedule(courseId: number): Promise<CanonicalSchedule[]> {
    if (!this.capabilities.schedule) {
      this.log("warn", "Schedule capability not available - skipping");
      return [];
    }

    try {
      this.log("info", `Fetching schedule for course ${courseId}...`);

      // Try to get calendar events for the course
      if (this.availableFunctions.has("core_calendar_get_calendar_events")) {
        const response = await this.client.request<{ events: any[] }>(
          "core_calendar_get_calendar_events",
          {
            events: {
              courseids: [courseId],
            },
          }
        );

        // Transform calendar events to schedule entries
        // Note: This is a simplified mapping - real implementation may need more logic
        const schedule: CanonicalSchedule[] =
          response.events?.map((event: any) => {
            const startDate = new Date(event.timestart * 1000);
            const endDate = new Date(
              (event.timestart + event.timeduration) * 1000
            );

            return {
              id: generateScheduleId(
                courseId,
                startDate.toLocaleDateString("en-US", { weekday: "long" }),
                "session"
              ),
              courseId: courseId,
              dayOfWeek: startDate.toLocaleDateString("en-US", {
                weekday: "long",
              }),
              startTime: startDate.toTimeString().split(" ")[0],
              endTime: endDate.toTimeString().split(" ")[0],
              location: event.location || undefined,
              effectiveFrom: startDate.toISOString().split("T")[0],
              effectiveTo: endDate.toISOString().split("T")[0],
            };
          }) || [];

        this.log(
          "info",
          `Fetched ${schedule.length} schedule entries for course ${courseId}`
        );

        return schedule;
      }

      this.log("warn", "No suitable schedule function available");
      return [];
    } catch (error) {
      this.log(
        "warn",
        `Failed to fetch schedule for course ${courseId}`,
        error
      );
      // Don't throw - schedule is optional
      return [];
    }
  }
}
