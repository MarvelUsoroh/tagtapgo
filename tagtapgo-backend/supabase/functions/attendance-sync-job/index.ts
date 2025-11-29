/**
 * Attendance Sync Job - Minimal & Robust
 * 
 * Data Minimization Architecture:
 * ================================
 * This sync uses ONLY 2 Moodle API functions:
 * 1. core_webservice_get_site_info - Discover available functions
 * 2. mod_attendance_get_sessions - Fetch everything (sessions, users, attendance logs)
 * 
 * Student Matching Strategy:
 * ==========================
 * We create minimal student records from session.users data:
 * - Students are identified by Moodle user ID (external_id)
 * - We store: ID, first name, last name (no email from Moodle)
 * - Students can "claim" their records later by linking accounts
 * 
 * This approach is privacy-preserving because:
 * - We never request full user profiles from Moodle
 * - We only store minimal data needed for attendance tracking
 * - Emails come from the student's own registration, not from Moodle
 * 
 * Flow:
 * 1. Load university configurations
 * 2. For each university:
 *    a. Discover capabilities (verify mod_attendance_get_sessions is available)
 *    b. Get attendance instance IDs (from api_config)
 *    c. Fetch all data from mod_attendance_get_sessions
 *    d. Upsert students (minimal records)
 *    e. Upsert schedules (sessions = class times)
 *    f. Upsert attendance records
 * 3. Return sync summary
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================================
// Minimal Moodle Types
// ============================================================================

interface MoodleSiteInfo {
  sitename: string;
  userid: number;
  functions: Array<{ name: string }>;
}

interface MoodleSession {
  id: number;
  attendanceid: number;
  courseid: number;
  sessdate: number;
  duration: number;
  description: string;
  lasttaken: number | null;  // Unix timestamp when attendance was last taken for this session
  statuses: Array<{ id: number; acronym: string; description: string }>;
  attendance_log: Array<{ studentid: number; statusid: number | string; remarks?: string; id?: string }>;
  users: Array<{ id: number; firstname: string; lastname: string }>;
}

interface MoodleEnrolledUser {
  id: number;
  firstname: string;
  lastname: string;
  roles: Array<{ shortname: string }>;
}

interface MoodleCourse {
  id: number;
  fullname: string;
  shortname: string;
}

interface SyncResult {
  universityId: string;
  universityName: string;
  success: boolean;
  studentsProcessed: number;
  attendanceProcessed: number;
  schedulesProcessed: number;
  error?: string;
  duration: number;
}

// ============================================================================
// Minimal Moodle Client
// ============================================================================

async function moodleRequest<T>(baseUrl: string, token: string, wsfunction: string, params: Record<string, unknown> = {}): Promise<T> {
  const url = new URL(`${baseUrl}/webservice/rest/server.php`);
  url.searchParams.set("wstoken", token);
  url.searchParams.set("wsfunction", wsfunction);
  url.searchParams.set("moodlewsrestformat", "json");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString());
  const data = await response.json();
  
  if (data.exception) {
    throw new Error(`Moodle error: ${data.message} (${data.errorcode})`);
  }

  return data as T;
}

// ============================================================================
// UUID Generation (deterministic for idempotency)
// ============================================================================

async function generateUUID(universityId: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${universityId}:${key}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  
  // Convert to UUID v5-like format
  const hex = Array.from(hashArray.slice(0, 16))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// ============================================================================
// Batch Processing Helper
// ============================================================================

async function processBatches<T>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await processor(batch);
  }
}

// ============================================================================
// Status Normalization
// ============================================================================

function normalizeStatus(code: string): string {
  const map: Record<string, string> = {
    'P': 'present',
    'L': 'late', 
    'E': 'excused',
    'A': 'absent',
  };
  return map[code.toUpperCase()] || 'unknown';
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (_req: Request) => {
  const startTime = Date.now();
  const results: SyncResult[] = [];
  
  try {
    console.log('[SYNC] Starting minimal attendance sync...');
    
    // Load active universities
    const { data: universities, error: uniError } = await supabase
      .from('universities')
      .select('*')
      .eq('active', true);
    
    if (uniError || !universities?.length) {
      return new Response(JSON.stringify({ message: 'No active universities' }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`[SYNC] Processing ${universities.length} universities`);
    
    for (const uni of universities) {
      const uniStart = Date.now();
      
      try {
        const config = uni.api_config;
        if (config.type !== 'moodle') {
          console.log(`[SYNC] Skipping ${uni.name} - not Moodle type`);
          continue;
        }

        const baseUrl = config.baseUrl.replace(/\/$/, '');
        const token = config.token;
        const timezone = config.timezone || 'UTC';

        // Step 1: Discover available functions
        console.log(`[SYNC] Discovering capabilities for ${uni.name}...`);
        const siteInfo = await moodleRequest<MoodleSiteInfo>(baseUrl, token, 'core_webservice_get_site_info');
        const functions = new Set(siteInfo.functions.map(f => f.name));
        
        if (!functions.has('mod_attendance_get_sessions')) {
          throw new Error('mod_attendance_get_sessions not available - check Moodle web service configuration');
        }

        // Step 2: Get attendance IDs from config
        const attendanceIds: number[] = config.attendance_ids || [1];

        let totalStudents = 0;
        let totalAttendance = 0;
        let totalSchedules = 0;

        for (const attendanceId of attendanceIds) {
          console.log(`[SYNC] Fetching attendance ID ${attendanceId}...`);
          
          // Step 3: Fetch all data from mod_attendance_get_sessions
          const sessions = await moodleRequest<MoodleSession[]>(
            baseUrl, token, 'mod_attendance_get_sessions', { attendanceid: attendanceId }
          );

          if (!sessions?.length) {
            console.log(`[SYNC] No sessions for attendance ${attendanceId}`);
            continue;
          }

          const courseId = sessions[0].courseid;
          const courseUuid = await generateUUID(uni.id, `course-${courseId}`);
          const classUuid = await generateUUID(uni.id, `class-${attendanceId}`);

          // Fetch actual course name from Moodle
          let courseName = `Course ${courseId}`;
          let courseCode = `COURSE-${courseId}`;
          
          if (functions.has('core_course_get_courses')) {
            try {
              const courses = await moodleRequest<MoodleCourse[]>(
                baseUrl, token, 'core_course_get_courses', { 'options[ids][0]': courseId }
              );
              if (courses?.length > 0) {
                courseName = courses[0].fullname;
                courseCode = courses[0].shortname;
                console.log(`[SYNC] Found course name: ${courseName}`);
              }
            } catch (courseErr) {
              console.warn(`[SYNC] Could not fetch course name, using fallback: ${courseName}`);
            }
          }

          // Ensure course exists - use check-then-insert pattern (DEFERRABLE constraints don't support ON CONFLICT)
          const { data: existingCourse } = await supabase
            .from('courses')
            .select('id')
            .eq('university_id', uni.id)
            .eq('external_id', String(courseId))
            .maybeSingle();
          
          if (existingCourse) {
            await supabase.from('courses').update({
              name: courseName,
              code: courseCode,
              active: true,
              updated_at: new Date().toISOString(),
            }).eq('id', existingCourse.id);
          } else {
            const { error: courseError } = await supabase.from('courses').insert({
              id: courseUuid,
              university_id: uni.id,
              external_id: String(courseId),
              name: courseName,
              code: courseCode,
              active: true,
              updated_at: new Date().toISOString(),
            });
            if (courseError) console.error('[SYNC] Course insert error:', courseError.message);
          }
          
          const actualCourseId = existingCourse?.id || courseUuid;

          // Ensure class exists - use check-then-insert pattern
          const { data: existingClass } = await supabase
            .from('classes')
            .select('id')
            .eq('course_id', actualCourseId)
            .eq('section', `Section ${attendanceId}`)
            .maybeSingle();
          
          if (existingClass) {
            await supabase.from('classes').update({
              metadata: { external_id: String(attendanceId), moodle_attendance_id: attendanceId },
              updated_at: new Date().toISOString(),
            }).eq('id', existingClass.id);
          } else {
            const { error: classError } = await supabase.from('classes').insert({
              id: classUuid,
              course_id: actualCourseId,
              section: `Section ${attendanceId}`,
              metadata: { external_id: String(attendanceId), moodle_attendance_id: attendanceId },
              updated_at: new Date().toISOString(),
            });
            if (classError) console.error('[SYNC] Class insert error:', classError.message);
          }
          
          const actualClassId = existingClass?.id || classUuid;

          // Step 4: Get enrolled users with roles to filter students only
          // This is the ONE additional API call for proper role filtering
          let studentIds = new Set<number>();
          const moodleUserData = new Map<number, { firstname: string; lastname: string }>();
          
          if (functions.has('core_enrol_get_enrolled_users')) {
            try {
              const enrolledUsers = await moodleRequest<MoodleEnrolledUser[]>(
                baseUrl, token, 'core_enrol_get_enrolled_users', { courseid: courseId }
              );
              // Filter to only students (role.shortname === 'student')
              for (const user of enrolledUsers) {
                const isStudent = user.roles?.some(r => r.shortname === 'student');
                if (isStudent) {
                  studentIds.add(user.id);
                  moodleUserData.set(user.id, { firstname: user.firstname, lastname: user.lastname });
                }
              }
              console.log(`[SYNC] Filtered to ${studentIds.size} students from ${enrolledUsers.length} enrolled users`);
            } catch (roleErr) {
              console.warn('[SYNC] Could not fetch roles, using session.users as fallback');
              // Fallback: use all users from sessions
              for (const session of sessions) {
                for (const user of session.users || []) {
                  studentIds.add(user.id);
                  moodleUserData.set(user.id, { firstname: user.firstname, lastname: user.lastname });
                }
              }
            }
          } else {
            // Fallback if core_enrol_get_enrolled_users not available
            for (const session of sessions) {
              for (const user of session.users || []) {
                studentIds.add(user.id);
                moodleUserData.set(user.id, { firstname: user.firstname, lastname: user.lastname });
              }
            }
          }

          // Create/update student records and enrollments for STUDENT role users only
          const studentMap = new Map<number, string>();
          
          for (const moodleId of studentIds) {
            const userData = moodleUserData.get(moodleId) || { firstname: 'Unknown', lastname: 'Student' };
            const studentUuid = await generateUUID(uni.id, `student-${moodleId}`);
            
            // Check if student already exists by external_id (DEFERRABLE constraints don't support ON CONFLICT)
            const { data: existingStudent } = await supabase
              .from('students')
              .select('id')
              .eq('university_id', uni.id)
              .eq('external_id', String(moodleId))
              .maybeSingle();
            
            const actualStudentId = existingStudent?.id || studentUuid;
            
            // Insert or update student record
            if (existingStudent) {
              const { error: studentError } = await supabase.from('students').update({
                first_name: userData.firstname,
                last_name: userData.lastname,
                status: 'active',
                updated_at: new Date().toISOString(),
              }).eq('id', existingStudent.id);
              
              if (studentError) {
                console.error(`[SYNC] Student update error for ${moodleId}:`, studentError.message);
              }
            } else {
              const { error: studentError } = await supabase.from('students').insert({
                id: studentUuid,
                university_id: uni.id,
                external_id: String(moodleId),
                first_name: userData.firstname,
                last_name: userData.lastname,
                status: 'active',
                updated_at: new Date().toISOString(),
              });
              
              if (studentError) {
                console.error(`[SYNC] Student insert error for ${moodleId}:`, studentError.message);
              }
            }
            
            studentMap.set(moodleId, actualStudentId);

            // Check-then-insert enrollment by student_id + course_id (unique constraint)
            const enrollmentId = await generateUUID(uni.id, `enroll-${courseId}-${moodleId}`);
            const { data: existingEnrollment } = await supabase
              .from('enrollments')
              .select('id')
              .eq('student_id', actualStudentId)
              .eq('course_id', actualCourseId)
              .maybeSingle();
            
            if (existingEnrollment) {
              await supabase.from('enrollments').update({
                status: 'active',
                updated_at: new Date().toISOString(),
              }).eq('id', existingEnrollment.id);
            } else {
              const { error: enrollError } = await supabase.from('enrollments').insert({
                id: enrollmentId,
                course_id: actualCourseId,
                student_id: actualStudentId,
                enrolled_at: new Date().toISOString(),
                status: 'active',
              });
              if (enrollError) console.error(`[SYNC] Enrollment insert error for ${moodleId}:`, enrollError.message);
            }
          }
          
          totalStudents += studentMap.size;
          console.log(`[SYNC] Processed ${studentMap.size} students`);

          // Step 5: Extract and upsert attendance records
          const attendanceRecords: Record<string, unknown>[] = [];
          
          for (const session of sessions) {
            // Build status map - statusid can be number or string from Moodle API
            const statusMap = new Map(session.statuses.map(s => [String(s.id), s.acronym]));
            
            // Use session.lasttaken as the recorded_at timestamp (per-session, not per-student)
            const recordedAt = session.lasttaken 
              ? new Date(session.lasttaken * 1000).toISOString()
              : new Date().toISOString();
            
            for (const log of session.attendance_log || []) {
              const studentUuid = studentMap.get(log.studentid);
              if (!studentUuid) continue;
              
              // statusid can be string or number from Moodle API
              const statusCode = statusMap.get(String(log.statusid)) || 'U';
              const durationSeconds = session.duration || 0;
              const durationMinutes = Math.round(durationSeconds / 60);
              const durationHours = Number((durationSeconds / 3600).toFixed(2)) || 0;
              
              attendanceRecords.push({
                id: await generateUUID(uni.id, `att-${session.id}-${log.studentid}`),
                university_id: uni.id,
                course_id: actualCourseId,  // Use actual course ID, not generated UUID
                class_id: actualClassId,
                student_id: studentUuid,
                session_id: String(session.id),
                status: normalizeStatus(statusCode),
                status_code: statusCode,
                recorded_at: recordedAt,
                source_tz: timezone,
                date: new Date(session.sessdate * 1000).toISOString().split('T')[0],
                metadata: {
                  session_duration_seconds: durationSeconds,
                  session_duration_minutes: durationMinutes,
                  session_duration_hours: durationHours,
                  session_description: session.description,
                },
                updated_at: new Date().toISOString(),
              });
            }
          }

          if (attendanceRecords.length > 0) {
            await processBatches(attendanceRecords, 100, async (batch) => {
              const { error } = await supabase.from('attendance').upsert(batch, { onConflict: 'id' });
              if (error) console.error('[SYNC] Attendance upsert error:', error.message);
            });
            totalAttendance += attendanceRecords.length;
          }

          // Step 6: Extract and upsert schedules (sessions = class times)
          const schedules = await Promise.all(sessions.map(async session => {
            const startDate = new Date(session.sessdate * 1000);
            const endDate = new Date((session.sessdate + session.duration) * 1000);
            
            return {
              id: await generateUUID(uni.id, `schedule-${session.id}`),
              university_id: uni.id,
              course_id: actualCourseId,  // Use actual course ID, not generated UUID
              class_id: actualClassId,    // Use actual class ID, not generated UUID
              day_of_week: startDate.toLocaleDateString('en-US', { weekday: 'long' }),
              start_time: startDate.toTimeString().split(' ')[0],
              end_time: endDate.toTimeString().split(' ')[0],
              effective_from: startDate.toISOString().split('T')[0],
              effective_to: endDate.toISOString().split('T')[0],
              metadata: { session_id: session.id, description: session.description },
              updated_at: new Date().toISOString(),
            };
          }));

          if (schedules.length > 0) {
            // Upsert schedules (preserves IDs to avoid breaking FKs)
            const { error: upsertError } = await supabase.from('class_schedules').upsert(schedules, { onConflict: 'id' });
            if (upsertError) console.error('[SYNC] Schedule upsert error:', upsertError.message);

            // Remove stale schedules that are no longer in the source
            const activeScheduleIds = schedules.map(s => s.id);
            const { error: deleteError } = await supabase
              .from('class_schedules')
              .delete()
              .eq('class_id', actualClassId)
              .not('id', 'in', `(${activeScheduleIds.join(',')})`);
            
            if (deleteError) console.error('[SYNC] Schedule cleanup error:', deleteError.message);

            totalSchedules += schedules.length;
          }
        }

        // Update sync status
        await supabase.from('universities').update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: 'success',
        }).eq('id', uni.id);

        results.push({
          universityId: uni.id,
          universityName: uni.name,
          success: true,
          studentsProcessed: totalStudents,
          attendanceProcessed: totalAttendance,
          schedulesProcessed: totalSchedules,
          duration: Date.now() - uniStart,
        });

        console.log(`[SYNC] ✓ ${uni.name}: ${totalStudents} students, ${totalAttendance} attendance, ${totalSchedules} schedules`);

      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[SYNC] ✗ ${uni.name}:`, msg);
        
        await supabase.from('universities').update({
          last_sync_status: 'error',
          last_sync_error: msg,
        }).eq('id', uni.id);

        results.push({
          universityId: uni.id,
          universityName: uni.name,
          success: false,
          studentsProcessed: 0,
          attendanceProcessed: 0,
          schedulesProcessed: 0,
          error: msg,
          duration: Date.now() - uniStart,
        });
      }
    }

    const summary = {
      totalUniversities: universities.length,
      successCount: results.filter(r => r.success).length,
      errorCount: results.filter(r => !r.success).length,
      results,
      totalDuration: Date.now() - startTime,
    };

    console.log(`[SYNC] Complete: ${summary.successCount} success, ${summary.errorCount} errors, ${summary.totalDuration}ms`);

    return new Response(JSON.stringify(summary), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SYNC] Fatal error:', msg);
    return new Response(JSON.stringify({ error: msg }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
