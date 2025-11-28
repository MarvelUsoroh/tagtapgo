/**
 * Moodle Adapter v2 - Minimal & Robust
 *
 * Uses only 3 essential Moodle functions for maximum compatibility:
 * 1. core_webservice_get_site_info - Discovery & health check
 * 2. core_enrol_get_users_courses - Get courses for the service user (alternative discovery)
 * 3. mod_attendance_get_sessions - THE KEY FUNCTION: Returns sessions, users, AND attendance logs
 *
 * Design Principles:
 * - Purpose Limitation: Only fetch data needed for attendance gamification
 * - Data Minimization: Use the fewest API calls possible
 * - Robustness: Graceful degradation when functions aren't available
 * - Scalability: Simple architecture that works across different Moodle setups
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
// Moodle API Types (Minimal Set)
// ============================================================================

interface MoodleSiteInfo {
  sitename: string;
  username: string;
  userid: number;
  functions: Array<{ name: string; version: string }>;
}

interface MoodleUserCourse {
  id: number;
  shortname: string;
  fullname: string;
  startdate: number;
  enddate: number;
}

interface MoodleSessionUser {
  id: number;
  firstname: string;
  lastname: string;
}

interface MoodleAttendanceLog {
  studentid: number;
  statusid: number;
  timetaken: number;
}

interface MoodleStatus {
  id: number;
  acronym: string; // P, L, E, A
  description: string;
}

interface MoodleSession {
  id: number;
  attendanceid: number;
  courseid: number;
  sessdate: number;
  duration: number;
  description: string;
  statuses: MoodleStatus[];
  attendance_log: MoodleAttendanceLog[];
  users: MoodleSessionUser[];
}

// ============================================================================
// Moodle Client (Minimal)
// ============================================================================

class MoodleClient {
  private baseUrl: string;
  private token: string;

  constructor(config: MoodleConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.token = config.token;
  }

  async request<T>(wsfunction: string, params: Record<string, any> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}/webservice/rest/server.php`);
    url.searchParams.set("wstoken", this.token);
    url.searchParams.set("wsfunction", wsfunction);
    url.searchParams.set("moodlewsrestformat", "json");

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new FetchError(`HTTP ${response.status}`, { wsfunction });
    }

    const data = await response.json();
    
    if (data.exception) {
      if (data.errorcode === "invalidtoken") {
        throw new AuthenticationError(data.message, { errorcode: data.errorcode });
      }
      throw new FetchError(data.message, { errorcode: data.errorcode, wsfunction });
    }

    return data as T;
  }

  async createOrGetUserByEmail(payload: {
    email?: string | null;
    fullName: string;
    externalId?: string | null;
  }): Promise<{ id: number }> {
    const { email, fullName, externalId } = payload;

    const nameParts = fullName.split(" ");
    const firstname = nameParts[0] || fullName;
    const lastname = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Student";

    // If we have an email, try to find existing user first
    if (email) {
      try {
        const existing = await this.request<any[]>("core_user_get_users_by_field", {
          field: "email",
          values: [email],
        });
        if (Array.isArray(existing) && existing.length > 0 && typeof existing[0].id === "number") {
          return { id: existing[0].id };
        }
      } catch (_err) {
        // Fall through to create
      }
    }

    const usernameBase = email ? email.split("@")[0] : externalId || `tgg_${Date.now()}`;

    const created = await this.request<any[]>("core_user_create_users", {
      users: [
        {
          username: usernameBase,
          firstname,
          lastname,
          email: email || `${usernameBase}@placeholder.edu`,
          auth: "manual",
        },
      ],
    });

    if (!Array.isArray(created) || created.length === 0 || typeof created[0].id !== "number") {
      throw new FetchError("Failed to create Moodle user", { wsfunction: "core_user_create_users" });
    }

    return { id: created[0].id };
  }

  toISO(timestamp: number): string {
    return new Date(timestamp * 1000).toISOString();
  }
}

// ============================================================================
// Moodle Adapter (Minimal & Robust)
// ============================================================================

export class MoodleAdapter extends BaseAdapter {
  private client: MoodleClient;
  private availableFunctions: Set<string> = new Set();
  private serviceUserId: number = 0;

  constructor(config: MoodleConfig) {
    super(config);
    this.client = new MoodleClient(config);
  }

  /**
   * Discover capabilities using core_webservice_get_site_info
   */
  async discover(): Promise<AdapterCapabilities> {
    this.log("info", "Starting capability discovery...");

    try {
      const siteInfo = await this.client.request<MoodleSiteInfo>("core_webservice_get_site_info");
      
      this.serviceUserId = siteInfo.userid;
      this.availableFunctions = new Set(siteInfo.functions.map(f => f.name));

      this.log("info", `Discovered ${this.availableFunctions.size} functions`);

      // We only need mod_attendance_get_sessions - it provides everything
      const hasAttendanceSessions = this.availableFunctions.has("mod_attendance_get_sessions");
      
      this.capabilities = {
        courses: true, // We derive courses from attendance sessions
        roster: hasAttendanceSessions, // Users come from sessions
        attendance: hasAttendanceSessions,
        schedule: hasAttendanceSessions, // Sessions ARE the schedule
      };

      this.discovered = true;
      this.log("info", "Discovery complete", this.capabilities);

      if (!hasAttendanceSessions) {
        this.log("error", "mod_attendance_get_sessions not available - sync will fail");
      }

      return this.capabilities;
    } catch (error) {
      throw new DiscoveryError(`Discovery failed: ${(error as any).message}`, { error });
    }
  }

  /**
   * Fetch all data from a single mod_attendance_get_sessions call
   * This is the core of the minimal approach - one function does it all
   */
  async fetchAllFromAttendance(attendanceId: number, since?: Date): Promise<{
    course: CanonicalCourse;
    students: CanonicalStudent[];
    attendance: CanonicalAttendance[];
    schedule: CanonicalSchedule[];
  }> {
    const sessions = await this.client.request<MoodleSession[]>(
      "mod_attendance_get_sessions",
      { attendanceid: attendanceId }
    );

    if (!sessions || sessions.length === 0) {
      return { course: null as any, students: [], attendance: [], schedule: [] };
    }

    // Get course info from first session
    const firstSession = sessions[0];
    const courseId = firstSession.courseid;

    // Build course (minimal info from session)
    const course: CanonicalCourse = {
      id: courseId,
      code: `course-${courseId}`,
      name: `Course ${courseId}`, // Will be enriched if core_enrol_get_users_courses available
      shortName: `course-${courseId}`,
      startAt: this.client.toISO(Math.min(...sessions.map(s => s.sessdate))),
      endAt: this.client.toISO(Math.max(...sessions.map(s => s.sessdate + s.duration))),
      roster: [],
      attendance: [],
      schedule: [],
    };

    // Extract unique students from all sessions (users array)
    const studentMap = new Map<number, CanonicalStudent>();
    for (const session of sessions) {
      for (const user of session.users || []) {
        if (!studentMap.has(user.id)) {
          studentMap.set(user.id, {
            id: user.id,
            username: `user${user.id}`,
            email: `student${user.id}@placeholder.edu`, // Minimal - no email in session data
            firstName: user.firstname,
            lastName: user.lastname,
            fullName: `${user.firstname} ${user.lastname}`,
            status: "active",
          });
        }
      }
    }
    const students = Array.from(studentMap.values());

    // Filter sessions by date
    const filteredSessions = since
      ? sessions.filter(s => s.sessdate >= Math.floor(since.getTime() / 1000))
      : sessions;

    // Extract attendance from attendance_log
    const attendance: CanonicalAttendance[] = [];
    for (const session of filteredSessions) {
      const statusMap = new Map(session.statuses.map(s => [s.id, s.acronym]));
      
      for (const log of session.attendance_log || []) {
        const statusCode = statusMap.get(log.statusid) || "U";
        attendance.push({
          id: generateAttendanceId(courseId, session.id, log.studentid),
          courseId: courseId,
          sessionId: session.id,
          userId: log.studentid,
          status: normalizeAttendanceStatus(statusCode),
          statusCode: statusCode,
          recordedAt: this.client.toISO(log.timetaken),
          sourceTz: this.config.timezone,
          metadata: { topic: session.description },
        });
      }
    }

    // Extract schedule from sessions
    const schedule: CanonicalSchedule[] = sessions.map(session => {
      const startDate = new Date(session.sessdate * 1000);
      const endDate = new Date((session.sessdate + session.duration) * 1000);
      
      return {
        id: generateScheduleId(courseId, startDate.toLocaleDateString("en-US", { weekday: "long" }), `s${session.id}`),
        courseId: courseId,
        dayOfWeek: startDate.toLocaleDateString("en-US", { weekday: "long" }),
        startTime: startDate.toTimeString().split(" ")[0],
        endTime: endDate.toTimeString().split(" ")[0],
        location: session.description || undefined,
        effectiveFrom: startDate.toISOString().split("T")[0],
        effectiveTo: endDate.toISOString().split("T")[0],
      };
    });

    this.log("info", `Fetched: ${students.length} students, ${attendance.length} attendance, ${schedule.length} sessions`);

    return { course, students, attendance, schedule };
  }

  // Required interface methods (simplified)
  async fetchCourses(): Promise<CanonicalCourse[]> {
    // In v2, courses are derived from attendance data
    this.log("info", "fetchCourses called - courses derived from attendance sessions");
    return [];
  }

  async fetchRoster(_courseId: number): Promise<CanonicalStudent[]> {
    // In v2, roster is derived from attendance sessions
    this.log("info", "fetchRoster called - roster derived from attendance sessions");
    return [];
  }

  async fetchAttendance(_courseId: number, _since?: Date): Promise<CanonicalAttendance[]> {
    // In v2, attendance is fetched via fetchAllFromAttendance
    this.log("info", "fetchAttendance called - use fetchAllFromAttendance instead");
    return [];
  }

  async fetchSchedule(_courseId: number): Promise<CanonicalSchedule[]> {
    // In v2, schedule is derived from attendance sessions
    this.log("info", "fetchSchedule called - schedule derived from attendance sessions");
    return [];
  }

  async enrolStudentInCourse(args: {
    courseId: number;
    email?: string | null;
    fullName: string;
    externalId?: string | null;
    roleId?: number;
  }): Promise<{ moodle_user_id: number }> {
    const { courseId, email, fullName, externalId, roleId } = args;

    const user = await this.client.createOrGetUserByEmail({ email, fullName, externalId });

    const enrolments = [
      {
        roleid: roleId ?? 5, // 5 is typically the student role in Moodle
        userid: user.id,
        courseid: courseId,
      },
    ];

    await this.client.request("enrol_manual_enrol_users", {
      enrolments,
    });

    this.log("info", `Enrolled user ${user.id} into course ${courseId}`);

    return { moodle_user_id: user.id };
  }
}
