/**
 * Primary Class Calculator Service
 *
 * Determines a student's primary class based on attendance patterns during a specific period.
 * Used for unified class leaderboards where each student appears only once.
 *
 * Algorithm:
 * 1. Count attendance records per course for the student in the given period
 * 2. Rank courses by attendance count (descending)
 * 3. For ties, use the course with the most recent attendance
 * 4. If no attendance data, fall back to most recent enrollment
 *
 * Requirements: 1.2, 1.3, 4.1, 4.5
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface PrimaryClassResult {
  student_id: string;
  primary_course_id: string | null;
  attendance_count: number;
  calculation_method: 'attendance' | 'enrollment' | 'none';
  last_attendance_date?: string;
}

export interface AttendanceRecord {
  course_id: string;
  date: string;
  status: string;
}

export interface EnrollmentRecord {
  course_id: string;
  created_at: string;
}

/**
 * Calculate primary class for a single student based on attendance patterns
 *
 * @param supabase - Supabase client with service role
 * @param studentId - Student ID to calculate primary class for
 * @param periodStart - Start date of the period (YYYY-MM-DD format)
 * @param periodEnd - End date of the period (YYYY-MM-DD format)
 * @returns Primary class result with course ID and calculation details
 */
export async function calculatePrimaryClass(
  supabase: SupabaseClient,
  studentId: string,
  periodStart: string,
  periodEnd: string
): Promise<PrimaryClassResult> {
  try {
    // Step 1: Get attendance records in the period
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('course_id, date, status')
      .eq('student_id', studentId)
      .gte('date', periodStart)
      .lte('date', periodEnd)
      .in('status', ['present', 'late', 'excused']);

    if (attendanceError) {
      console.error(`[Primary Class Calculator] Error fetching attendance for student ${studentId}:`, attendanceError);
      return {
        student_id: studentId,
        primary_course_id: null,
        attendance_count: 0,
        calculation_method: 'none'
      };
    }

    // Step 2: If we have attendance data, calculate primary class from attendance
    if (attendance && attendance.length > 0) {
      return calculateFromAttendance(studentId, attendance);
    }

    // Step 3: Fallback to most recent enrollment if no attendance
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('student_id', studentId)
      .limit(1)
      .single();

    if (enrollmentError || !enrollment) {
      console.warn(`[Primary Class Calculator] No enrollment found for student ${studentId}`);
      return {
        student_id: studentId,
        primary_course_id: null,
        attendance_count: 0,
        calculation_method: 'none'
      };
    }

    return {
      student_id: studentId,
      primary_course_id: enrollment.course_id,
      attendance_count: 0,
      calculation_method: 'enrollment'
    };

  } catch (error) {
    console.error(`[Primary Class Calculator] Unexpected error for student ${studentId}:`, error);
    return {
      student_id: studentId,
      primary_course_id: null,
      attendance_count: 0,
      calculation_method: 'none'
    };
  }
}

/**
 * Calculate primary class from attendance records
 */
function calculateFromAttendance(
  studentId: string,
  attendance: AttendanceRecord[]
): PrimaryClassResult {
  // Count attendance per course
  const courseCounts = new Map<string, number>();
  const courseLatestDates = new Map<string, string>();

  for (const record of attendance) {
    // Update count
    const currentCount = courseCounts.get(record.course_id) || 0;
    courseCounts.set(record.course_id, currentCount + 1);

    // Track latest date for tie-breaking
    const currentLatest = courseLatestDates.get(record.course_id);
    if (!currentLatest || record.date > currentLatest) {
      courseLatestDates.set(record.course_id, record.date);
    }
  }

  // Find course with highest count, using latest date as tie-breaker
  let primaryCourseId: string | null = null;
  let maxCount = 0;
  let latestDate = '';

  for (const [courseId, count] of courseCounts.entries()) {
    const courseLatestDate = courseLatestDates.get(courseId) || '';
    
    const shouldUpdate = 
      count > maxCount || 
      (count === maxCount && courseLatestDate > latestDate);

    if (shouldUpdate) {
      primaryCourseId = courseId;
      maxCount = count;
      latestDate = courseLatestDate;
    }
  }

  return {
    student_id: studentId,
    primary_course_id: primaryCourseId,
    attendance_count: maxCount,
    calculation_method: 'attendance',
    last_attendance_date: latestDate
  };
}

/**
 * Calculate primary classes for multiple students efficiently
 *
 * @param supabase - Supabase client with service role
 * @param studentIds - Array of student IDs to process
 * @param periodStart - Start date of the period (YYYY-MM-DD format)
 * @param periodEnd - End date of the period (YYYY-MM-DD format)
 * @returns Map of student ID to primary course ID
 */
export async function calculatePrimaryClassesForStudents(
  supabase: SupabaseClient,
  studentIds: string[],
  periodStart: string,
  periodEnd: string
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();

  if (studentIds.length === 0) {
    console.log('[Primary Class Calculator] No students to process');
    return results;
  }

  const startTime = Date.now();
  console.log(`[Primary Class Calculator] Processing ${studentIds.length} students for period ${periodStart} to ${periodEnd}`);

  try {
    // Step 1: Batch fetch attendance data for all students
    const { data: allAttendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('student_id, course_id, date, status')
      .in('student_id', studentIds)
      .gte('date', periodStart)
      .lte('date', periodEnd)
      .in('status', ['present', 'late', 'excused']);

    if (attendanceError) {
      console.error('[Primary Class Calculator] Error fetching batch attendance:', attendanceError);
      // Return null for all students on error
      studentIds.forEach(id => results.set(id, null));
      return results;
    }

    const attendanceCount = allAttendance?.length || 0;
    console.log(`[Primary Class Calculator] Found ${attendanceCount} attendance records`);

    // Step 2: Group attendance by student for efficient processing
    const attendanceByStudent = new Map<string, AttendanceRecord[]>();
    for (const record of allAttendance || []) {
      if (!attendanceByStudent.has(record.student_id)) {
        attendanceByStudent.set(record.student_id, []);
      }
      attendanceByStudent.get(record.student_id)!.push({
        course_id: record.course_id,
        date: record.date,
        status: record.status
      });
    }

    // Step 3: Calculate primary class for students with attendance
    const studentsWithoutAttendance: string[] = [];
    let studentsWithAttendance = 0;

    for (const studentId of studentIds) {
      const studentAttendance = attendanceByStudent.get(studentId);
      
      if (studentAttendance && studentAttendance.length > 0) {
        const result = calculateFromAttendance(studentId, studentAttendance);
        results.set(studentId, result.primary_course_id);
        studentsWithAttendance++;
      } else {
        studentsWithoutAttendance.push(studentId);
      }
    }

    console.log(`[Primary Class Calculator] ${studentsWithAttendance} students with attendance, ${studentsWithoutAttendance.length} without`);

    // Step 4: Handle students without attendance - batch fetch enrollments
    if (studentsWithoutAttendance.length > 0) {
      const { data: enrollments, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('student_id, course_id')
        .in('student_id', studentsWithoutAttendance);

      if (enrollmentError) {
        console.error('[Primary Class Calculator] Error fetching batch enrollments:', enrollmentError);
        // Set null for students without attendance
        studentsWithoutAttendance.forEach(id => results.set(id, null));
      } else {
        // Get most recent enrollment for each student
        const latestEnrollments = new Map<string, string>();
        for (const enrollment of enrollments || []) {
          if (!latestEnrollments.has(enrollment.student_id)) {
            latestEnrollments.set(enrollment.student_id, enrollment.course_id);
          }
        }

        // Set results for students without attendance
        let enrollmentFallbacks = 0;
        for (const studentId of studentsWithoutAttendance) {
          const courseId = latestEnrollments.get(studentId) || null;
          results.set(studentId, courseId);
          if (courseId) enrollmentFallbacks++;
        }

        console.log(`[Primary Class Calculator] ${enrollmentFallbacks} students using enrollment fallback`);
      }
    }

    // Step 5: Ensure all students have results
    for (const studentId of studentIds) {
      if (!results.has(studentId)) {
        results.set(studentId, null);
      }
    }

    const duration = Date.now() - startTime;
    const successCount = Array.from(results.values()).filter(id => id !== null).length;
    
    console.log(`[Primary Class Calculator] Completed in ${duration}ms: ${successCount}/${studentIds.length} students with primary classes`);
    
    return results;

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Primary Class Calculator] Unexpected error after ${duration}ms:`, error);
    
    // Return null for all students on error
    studentIds.forEach(id => results.set(id, null));
    return results;
  }
}

/**
 * Calculate primary classes with detailed results for debugging/monitoring
 *
 * @param supabase - Supabase client with service role
 * @param studentIds - Array of student IDs to process
 * @param periodStart - Start date of the period (YYYY-MM-DD format)
 * @param periodEnd - End date of the period (YYYY-MM-DD format)
 * @returns Array of detailed primary class results
 */
export async function calculatePrimaryClassesDetailed(
  supabase: SupabaseClient,
  studentIds: string[],
  periodStart: string,
  periodEnd: string
): Promise<PrimaryClassResult[]> {
  const results: PrimaryClassResult[] = [];

  if (studentIds.length === 0) {
    return results;
  }

  // For detailed results, we'll process each student individually
  // This is less efficient but provides more detailed information
  for (const studentId of studentIds) {
    try {
      const result = await calculatePrimaryClass(supabase, studentId, periodStart, periodEnd);
      results.push(result);
    } catch (error) {
      console.error(`[Primary Class Calculator] Error processing student ${studentId}:`, error);
      results.push({
        student_id: studentId,
        primary_course_id: null,
        attendance_count: 0,
        calculation_method: 'none'
      });
    }
  }

  return results;
}

/**
 * Get primary class for a student in a specific period (convenience function)
 *
 * @param supabase - Supabase client
 * @param studentId - Student ID
 * @param period - Period type
 * @returns Primary course ID or null
 */
export async function getPrimaryClassForPeriod(
  supabase: SupabaseClient,
  studentId: string,
  period: "weekly" | "monthly" | "all_time"
): Promise<string | null> {
  const { period_start, period_end } = getPeriodBoundaries(period);
  const result = await calculatePrimaryClass(supabase, studentId, period_start, period_end);
  return result.primary_course_id;
}

/**
 * Get period boundaries (helper function)
 */
function getPeriodBoundaries(period: "weekly" | "monthly" | "all_time"): {
  period_start: string;
  period_end: string;
} {
  const now = new Date();

  if (period === "weekly") {
    // Current week (Monday to Sunday)
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return {
      period_start: monday.toISOString().split("T")[0],
      period_end: sunday.toISOString().split("T")[0],
    };
  } else if (period === "monthly") {
    // Current month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    return {
      period_start: monthStart.toISOString().split("T")[0],
      period_end: monthEnd.toISOString().split("T")[0],
    };
  } else {
    // All time (use epoch start and far future)
    return {
      period_start: "1970-01-01",
      period_end: "2099-12-31",
    };
  }
}
/**
 * 
Group students by their primary classes
 *
 * @param primaryClasses - Map of student ID to primary course ID
 * @returns Map of course ID to array of student IDs
 */
export function groupStudentsByPrimaryClass(
  primaryClasses: Map<string, string | null>
): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const [studentId, courseId] of primaryClasses.entries()) {
    if (!courseId) {
      continue; // Skip students without primary class
    }

    if (!groups.has(courseId)) {
      groups.set(courseId, []);
    }
    groups.get(courseId)!.push(studentId);
  }

  return groups;
}

/**
 * Validate primary class calculation results
 *
 * @param results - Primary class calculation results
 * @returns Validation summary
 */
export function validatePrimaryClassResults(
  results: Map<string, string | null>
): {
  total_students: number;
  students_with_primary_class: number;
  students_without_primary_class: number;
  unique_primary_classes: number;
  validation_passed: boolean;
} {
  const totalStudents = results.size;
  const studentsWithPrimaryClass = Array.from(results.values()).filter(id => id !== null).length;
  const studentsWithoutPrimaryClass = totalStudents - studentsWithPrimaryClass;
  const uniquePrimaryClasses = new Set(Array.from(results.values()).filter(id => id !== null)).size;

  return {
    total_students: totalStudents,
    students_with_primary_class: studentsWithPrimaryClass,
    students_without_primary_class: studentsWithoutPrimaryClass,
    unique_primary_classes: uniquePrimaryClasses,
    validation_passed: totalStudents > 0 && studentsWithPrimaryClass > 0
  };
}

/**
 * Log primary class calculation summary
 *
 * @param results - Primary class calculation results
 * @param context - Context string for logging
 */
export function logPrimaryClassSummary(
  results: Map<string, string | null>,
  context: string = 'Primary Class Calculation'
): void {
  const validation = validatePrimaryClassResults(results);
  
  console.log(`[${context}] Summary:`);
  console.log(`  - Total students: ${validation.total_students}`);
  console.log(`  - Students with primary class: ${validation.students_with_primary_class}`);
  console.log(`  - Students without primary class: ${validation.students_without_primary_class}`);
  console.log(`  - Unique primary classes: ${validation.unique_primary_classes}`);
  console.log(`  - Validation passed: ${validation.validation_passed}`);

  if (validation.students_without_primary_class > 0) {
    const studentsWithoutClass = Array.from(results.entries())
      .filter(([_, courseId]) => courseId === null)
      .map(([studentId, _]) => studentId);
    
    console.warn(`[${context}] Students without primary class:`, studentsWithoutClass.slice(0, 5));
    if (studentsWithoutClass.length > 5) {
      console.warn(`[${context}] ... and ${studentsWithoutClass.length - 5} more`);
    }
  }
}