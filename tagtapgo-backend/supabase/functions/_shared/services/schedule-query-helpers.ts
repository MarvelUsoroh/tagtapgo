/**
 * Schedule Query Helpers Service
 * 
 * Centralized, reusable functions for querying student class schedules with proper joins.
 * 
 * IMPORTANT: class_schedules is a COURSE TEMPLATE (e.g., "CS101 meets Mon/Wed/Fri 9-10am"),
 * NOT individual student sessions. Students are linked to courses via enrollments.
 * 
 * Correct query pattern:
 *   students → enrollments → courses → class_schedules
 * 
 * Requirements: 3
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Represents a class schedule for a student on a specific date
 */
export interface StudentSchedule {
  schedule_id: string;
  course_id: string;
  course_code: string;
  course_name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  location: string | null;
  class_id: string | null;
}

/**
 * Represents an upcoming class for a student with calculated datetime
 */
export interface StudentUpcomingClass {
  schedule_id: string;
  course_id: string;
  course_code: string;
  course_name: string;
  start_datetime: Date;
  end_datetime: Date;
  location: string | null;
  minutes_until_start: number;
}

/**
 * Represents a student enrolled in a course
 */
export interface EnrolledStudent {
  student_id: string;
  enrollment_id: string;
  course_id: string;
  course_code: string;
  course_name: string;
}

// ============================================================================
// Core Query Functions
// ============================================================================

/**
 * Get all class schedules for a student on a specific date
 * 
 * Joins: enrollments → courses → class_schedules
 * Filters: day_of_week matches date, effective date range, active enrollments
 * 
 * @param supabase - Supabase client with service role
 * @param studentId - Student ID to query schedules for
 * @param date - Date to find schedules for
 * @returns Array of student schedules for the date
 * 
 * @example
 * const schedules = await getStudentSchedulesForDate(
 *   supabase,
 *   'student-uuid',
 *   new Date('2024-10-30')
 * );
 * // Returns schedules for all courses student is enrolled in on that day
 */
export async function getStudentSchedulesForDate(
  supabase: SupabaseClient,
  studentId: string,
  date: Date
): Promise<StudentSchedule[]> {
  try {
    const dayOfWeek = getDayOfWeekName(date);
    const dateStr = date.toISOString().split('T')[0];
    
    console.log(`[Schedule Query] Getting schedules for student ${studentId} on ${dateStr} (${dayOfWeek})`);
    
    // Query: enrollments → courses → class_schedules
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        id,
        course_id,
        courses:course_id (
          id,
          code,
          name,
          class_schedules:class_schedules (
            id,
            day_of_week,
            start_time,
            end_time,
            location,
            class_id,
            effective_from,
            effective_to
          )
        )
      `)
      .eq('student_id', studentId)
      .eq('status', 'active');
    
    if (error) {
      console.error('[Schedule Query] Error fetching student schedules:', error);
      throw new Error(`Failed to fetch student schedules: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      console.log(`[Schedule Query] No active enrollments found for student ${studentId}`);
      return [];
    }
    
    // Flatten and filter schedules
    const schedules: StudentSchedule[] = [];
    
    for (const enrollment of data) {
      const course = enrollment.courses as any;
      if (!course || !course.class_schedules) continue;
      
      for (const schedule of course.class_schedules) {
        // Filter by day of week
        if (schedule.day_of_week !== dayOfWeek) continue;
        
        // Filter by effective date range
        if (!isWithinEffectiveDates(dateStr, schedule.effective_from, schedule.effective_to)) {
          continue;
        }
        
        schedules.push({
          schedule_id: schedule.id,
          course_id: course.id,
          course_code: course.code,
          course_name: course.name,
          day_of_week: schedule.day_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          location: schedule.location,
          class_id: schedule.class_id,
        });
      }
    }
    
    console.log(`[Schedule Query] Found ${schedules.length} schedules for student ${studentId}`);
    return schedules;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Schedule Query] Error in getStudentSchedulesForDate:`, errorMessage);
    throw error;
  }
}

/**
 * Get upcoming classes for a student within a time window
 * 
 * Joins: enrollments → courses → class_schedules
 * Filters: day_of_week matches today, start_time within window, effective dates
 * 
 * @param supabase - Supabase client with service role
 * @param studentId - Student ID to query upcoming classes for
 * @param fromTime - Start of time window
 * @param toTime - End of time window
 * @returns Array of upcoming classes sorted by start time
 * 
 * @example
 * const now = new Date();
 * const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
 * const upcoming = await getStudentUpcomingClasses(
 *   supabase,
 *   'student-uuid',
 *   now,
 *   twoHoursLater
 * );
 * // Returns classes starting within next 2 hours
 */
export async function getStudentUpcomingClasses(
  supabase: SupabaseClient,
  studentId: string,
  fromTime: Date,
  toTime: Date
): Promise<StudentUpcomingClass[]> {
  try {
    const today = new Date(fromTime);
    const dayOfWeek = getDayOfWeekName(today);
    const dateStr = today.toISOString().split('T')[0];
    
    console.log(`[Schedule Query] Getting upcoming classes for student ${studentId} from ${fromTime.toISOString()} to ${toTime.toISOString()}`);
    
    // Get all schedules for today
    const schedules = await getStudentSchedulesForDate(supabase, studentId, today);
    
    // Filter by time window and calculate datetimes
    const upcomingClasses: StudentUpcomingClass[] = [];
    
    for (const schedule of schedules) {
      // Combine date with time to get full datetime
      const startDatetime = combineDateAndTime(dateStr, schedule.start_time);
      const endDatetime = combineDateAndTime(dateStr, schedule.end_time);
      
      // Check if class starts within time window
      if (startDatetime >= fromTime && startDatetime <= toTime) {
        const minutesUntilStart = Math.floor(
          (startDatetime.getTime() - fromTime.getTime()) / (1000 * 60)
        );
        
        upcomingClasses.push({
          schedule_id: schedule.schedule_id,
          course_id: schedule.course_id,
          course_code: schedule.course_code,
          course_name: schedule.course_name,
          start_datetime: startDatetime,
          end_datetime: endDatetime,
          location: schedule.location,
          minutes_until_start: minutesUntilStart,
        });
      }
    }
    
    // Sort by start time
    upcomingClasses.sort((a, b) => 
      a.start_datetime.getTime() - b.start_datetime.getTime()
    );
    
    console.log(`[Schedule Query] Found ${upcomingClasses.length} upcoming classes for student ${studentId}`);
    return upcomingClasses;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Schedule Query] Error in getStudentUpcomingClasses:`, errorMessage);
    throw error;
  }
}

/**
 * Get all students enrolled in a specific class schedule
 * 
 * Joins: class_schedules → courses → enrollments
 * Filters: active enrollments only
 * 
 * @param supabase - Supabase client with service role
 * @param scheduleId - Class schedule ID to find enrolled students for
 * @returns Array of enrolled students with course details
 * 
 * @example
 * const students = await getStudentsForClassSchedule(
 *   supabase,
 *   'schedule-uuid'
 * );
 * // Returns all students enrolled in the course for this schedule
 */
export async function getStudentsForClassSchedule(
  supabase: SupabaseClient,
  scheduleId: string
): Promise<EnrolledStudent[]> {
  try {
    console.log(`[Schedule Query] Getting enrolled students for schedule ${scheduleId}`);
    
    // First get the schedule to find the course_id
    const { data: schedule, error: scheduleError } = await supabase
      .from('class_schedules')
      .select('course_id')
      .eq('id', scheduleId)
      .single();
    
    if (scheduleError) {
      console.error('[Schedule Query] Error fetching schedule:', scheduleError);
      throw new Error(`Failed to fetch schedule: ${scheduleError.message}`);
    }
    
    if (!schedule) {
      console.log(`[Schedule Query] Schedule ${scheduleId} not found`);
      return [];
    }
    
    // Query: enrollments → courses (for course details)
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        id,
        student_id,
        course_id,
        courses:course_id (
          id,
          code,
          name
        )
      `)
      .eq('course_id', schedule.course_id)
      .eq('status', 'active');
    
    if (error) {
      console.error('[Schedule Query] Error fetching enrollments:', error);
      throw new Error(`Failed to fetch enrollments: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      console.log(`[Schedule Query] No active enrollments found for course ${schedule.course_id}`);
      return [];
    }
    
    // Map to EnrolledStudent interface
    const students: EnrolledStudent[] = data.map(enrollment => {
      const course = enrollment.courses as any;
      return {
        student_id: enrollment.student_id,
        enrollment_id: enrollment.id,
        course_id: enrollment.course_id,
        course_code: course?.code || 'Unknown',
        course_name: course?.name || 'Unknown Course',
      };
    });
    
    console.log(`[Schedule Query] Found ${students.length} enrolled students for schedule ${scheduleId}`);
    return students;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Schedule Query] Error in getStudentsForClassSchedule:`, errorMessage);
    throw error;
  }
}

/**
 * Get course information for a class schedule
 * 
 * Joins: class_schedules → courses
 * 
 * @param supabase - Supabase client with service role
 * @param scheduleId - Class schedule ID to get course details for
 * @returns Course details or null if not found
 * 
 * @example
 * const course = await getCourseDetailsForSchedule(
 *   supabase,
 *   'schedule-uuid'
 * );
 * // Returns { course_id: '...', code: 'CS101', name: 'Intro to CS' }
 */
export async function getCourseDetailsForSchedule(
  supabase: SupabaseClient,
  scheduleId: string
): Promise<{ course_id: string; code: string; name: string } | null> {
  try {
    console.log(`[Schedule Query] Getting course details for schedule ${scheduleId}`);
    
    const { data, error } = await supabase
      .from('class_schedules')
      .select(`
        course_id,
        courses:course_id (
          id,
          code,
          name
        )
      `)
      .eq('id', scheduleId)
      .single();
    
    if (error) {
      console.error('[Schedule Query] Error fetching course details:', error);
      throw new Error(`Failed to fetch course details: ${error.message}`);
    }
    
    if (!data || !data.courses) {
      console.log(`[Schedule Query] No course found for schedule ${scheduleId}`);
      return null;
    }
    
    const course = data.courses as any;
    return {
      course_id: data.course_id,
      code: course.code,
      name: course.name,
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Schedule Query] Error in getCourseDetailsForSchedule:`, errorMessage);
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get day of week name from a date
 * 
 * @param date - Date to get day name for
 * @returns Day name (e.g., "Monday", "Tuesday")
 */
function getDayOfWeekName(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

/**
 * Check if a date falls within effective_from and effective_to range
 * 
 * @param date - Date string in YYYY-MM-DD format
 * @param effectiveFrom - Start date of effective range
 * @param effectiveTo - End date of effective range
 * @returns True if date is within range
 */
function isWithinEffectiveDates(
  date: string,
  effectiveFrom: string,
  effectiveTo: string
): boolean {
  return date >= effectiveFrom && date <= effectiveTo;
}

/**
 * Combine a date string and time string into a full Date object
 * 
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param timeStr - Time string in HH:MM:SS format
 * @returns Combined Date object
 */
function combineDateAndTime(dateStr: string, timeStr: string): Date {
  // timeStr is in format "HH:MM:SS"
  return new Date(`${dateStr}T${timeStr}`);
}
