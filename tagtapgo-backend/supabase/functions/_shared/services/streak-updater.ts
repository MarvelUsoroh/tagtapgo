/**
 * Streak Update Service
 * 
 * Updates student streaks based on attendance records.
 * Tracks current streak, longest streak, and streak freeze mechanics.
 * 
 * Streak Rules:
 * - Streak increments on each consecutive day of attendance
 * - Streak breaks if student misses a day (resets to 0)
 * - Streak freeze: 1 per month, prevents streak break for 1 missed day
 * - Streak at-risk notifications sent 2 hours before class
 * 
 * Requirements: 2
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface StreakRecord {
  id: string;
  student_id: string;
  current_streak: number;
  longest_streak: number;
  last_attendance_date: string | null;
  streak_freeze_count: number;
  last_freeze_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StreakUpdateResult {
  student_id: string;
  previous_streak: number;
  current_streak: number;
  longest_streak: number;
  streak_broken: boolean;
  freeze_used: boolean;
  notifications_sent: string[];
  errors: string[];
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  course_id: string;
  date: string;
  status: 'present' | 'late' | 'excused' | 'absent';
  created_at: string;
}

/**
 * Update streaks for students based on new attendance records
 * 
 * @param supabase - Supabase client with service role
 * @param attendanceRecords - New attendance records to process
 * @returns Results for each student
 */
export async function updateStreaks(
  supabase: SupabaseClient,
  attendanceRecords: AttendanceRecord[]
): Promise<StreakUpdateResult[]> {
  const results: StreakUpdateResult[] = [];
  
  // Group attendance by student
  const attendanceByStudent = groupByStudent(attendanceRecords);
  
  // Process each student
  for (const [studentId, records] of Object.entries(attendanceByStudent)) {
    try {
      const result = await updateStudentStreak(supabase, studentId, records);
      results.push(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Streak Updater] Error processing student ${studentId}:`, errorMessage);
      
      results.push({
        student_id: studentId,
        previous_streak: 0,
        current_streak: 0,
        longest_streak: 0,
        streak_broken: false,
        freeze_used: false,
        notifications_sent: [],
        errors: [errorMessage],
      });
    }
  }
  
  return results;
}

/**
 * Update streak for a single student
 */
async function updateStudentStreak(
  supabase: SupabaseClient,
  studentId: string,
  attendanceRecords: AttendanceRecord[]
): Promise<StreakUpdateResult> {
  // Get or create streak record
  let streakRecord = await getStreakRecord(supabase, studentId);
  
  if (!streakRecord) {
    streakRecord = await createStreakRecord(supabase, studentId);
  }
  
  const result: StreakUpdateResult = {
    student_id: studentId,
    previous_streak: streakRecord.current_streak,
    current_streak: streakRecord.current_streak,
    longest_streak: streakRecord.longest_streak,
    streak_broken: false,
    freeze_used: false,
    notifications_sent: [],
    errors: [],
  };
  
  // Sort attendance by date (oldest first)
  const sortedAttendance = attendanceRecords.sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  // Get unique dates (multiple classes per day = 1 day)
  const uniqueDates = Array.from(
    new Set(sortedAttendance.map(a => a.date))
  ).sort();
  
  // Process each date
  for (const date of uniqueDates) {
    const attendanceForDate = sortedAttendance.filter(a => a.date === date);
    const hasAttendance = attendanceForDate.some(a => 
      a.status === 'present' || a.status === 'late' || a.status === 'excused'
    );
    
    if (hasAttendance) {
      // Student attended - increment streak
      const dateObj = new Date(date);
      const lastAttendanceDate = streakRecord.last_attendance_date 
        ? new Date(streakRecord.last_attendance_date)
        : null;
      
      if (lastAttendanceDate) {
        const daysDiff = Math.floor(
          (dateObj.getTime() - lastAttendanceDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysDiff === 1) {
          // Consecutive day - increment streak
          result.current_streak++;
        } else if (daysDiff > 1) {
          // Gap detected - check for freeze
          const canUseFreeze = await canUseStreakFreeze(supabase, studentId, streakRecord);
          
          if (canUseFreeze && daysDiff === 2) {
            // Use freeze for 1 missed day
            result.freeze_used = true;
            result.current_streak++; // Continue streak
            
            // Update freeze usage
            await useStreakFreeze(supabase, studentId);
            
            console.log(`[Streak Updater] Student ${studentId} used streak freeze`);
          } else {
            // Streak broken
            result.streak_broken = true;
            result.current_streak = 1; // Start new streak
            
            console.log(`[Streak Updater] Student ${studentId} streak broken (gap: ${daysDiff} days)`);
          }
        } else if (daysDiff === 0) {
          // Same day - no change to streak
          continue;
        }
      } else {
        // First attendance - start streak
        result.current_streak = 1;
      }
      
      // Update last attendance date
      streakRecord.last_attendance_date = date;
      
      // Update longest streak if current is higher
      if (result.current_streak > result.longest_streak) {
        result.longest_streak = result.current_streak;
      }
    }
  }
  
  // Update streak record in database
  await updateStreakRecord(supabase, studentId, {
    current_streak: result.current_streak,
    longest_streak: result.longest_streak,
    last_attendance_date: streakRecord.last_attendance_date,
  });
  
  console.log(`[Streak Updater] Updated streak for student ${studentId}: ${result.previous_streak} → ${result.current_streak}`);
  
  return result;
}

/**
 * Get streak record for a student
 */
async function getStreakRecord(
  supabase: SupabaseClient,
  studentId: string
): Promise<StreakRecord | null> {
  const { data, error } = await supabase
    .from('streaks')
    .select('*')
    .eq('student_id', studentId)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    throw new Error(`Failed to get streak record: ${error.message}`);
  }
  
  return data;
}

/**
 * Create initial streak record for a student
 */
async function createStreakRecord(
  supabase: SupabaseClient,
  studentId: string
): Promise<StreakRecord> {
  const { data, error } = await supabase
    .from('streaks')
    .insert({
      student_id: studentId,
      current_streak: 0,
      longest_streak: 0,
      last_attendance_date: null,
      streak_freeze_count: 1, // Start with 1 freeze per month
      last_freeze_used_at: null,
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create streak record: ${error.message}`);
  }
  
  return data;
}

/**
 * Update streak record in database
 */
async function updateStreakRecord(
  supabase: SupabaseClient,
  studentId: string,
  updates: {
    current_streak: number;
    longest_streak: number;
    last_attendance_date: string | null;
  }
): Promise<void> {
  const { error } = await supabase
    .from('streaks')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('student_id', studentId);
  
  if (error) {
    throw new Error(`Failed to update streak record: ${error.message}`);
  }
}

/**
 * Check if student can use streak freeze
 * Rules: 1 freeze per month, resets on 1st of each month
 */
async function canUseStreakFreeze(
  supabase: SupabaseClient,
  studentId: string,
  streakRecord: StreakRecord
): Promise<boolean> {
  // Check if freeze available
  if (streakRecord.streak_freeze_count <= 0) {
    return false;
  }
  
  // Check if freeze was used this month
  if (streakRecord.last_freeze_used_at) {
    const lastUsed = new Date(streakRecord.last_freeze_used_at);
    const now = new Date();
    
    // If used in current month, can't use again
    if (lastUsed.getMonth() === now.getMonth() && 
        lastUsed.getFullYear() === now.getFullYear()) {
      return false;
    }
  }
  
  return true;
}

/**
 * Use streak freeze (decrement count, update timestamp)
 */
async function useStreakFreeze(
  supabase: SupabaseClient,
  studentId: string
): Promise<void> {
  const { error } = await supabase
    .from('streaks')
    .update({
      streak_freeze_count: 0, // Used for this month
      last_freeze_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('student_id', studentId);
  
  if (error) {
    throw new Error(`Failed to use streak freeze: ${error.message}`);
  }
}

/**
 * Reset streak freezes for all students (run monthly on 1st)
 */
export async function resetMonthlyStreakFreezes(
  supabase: SupabaseClient
): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    // Reset all streak freezes to 1
    const { error, count } = await supabase
      .from('streaks')
      .update({
        streak_freeze_count: 1,
        updated_at: new Date().toISOString(),
      })
      .neq('streak_freeze_count', 1); // Only update if not already 1
    
    if (error) {
      throw new Error(`Failed to reset streak freezes: ${error.message}`);
    }
    
    console.log(`[Streak Updater] Reset streak freezes for ${count || 0} students`);
    
    return { updated: count || 0, errors };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push(errorMessage);
    console.error('[Streak Updater] Error resetting freezes:', errorMessage);
    
    return { updated: 0, errors };
  }
}

/**
 * Send streak at-risk notifications
 * Called 2 hours before next class if student hasn't attended today
 */
export async function sendStreakAtRiskNotifications(
  supabase: SupabaseClient
): Promise<{ sent: number; errors: string[] }> {
  const errors: string[] = [];
  let sent = 0;
  
  try {
    // Get students with active streaks (current_streak > 0)
    const { data: streaks, error: streaksError } = await supabase
      .from('streaks')
      .select('student_id, current_streak, last_attendance_date')
      .gt('current_streak', 0);
    
    if (streaksError) {
      throw new Error(`Failed to get streaks: ${streaksError.message}`);
    }
    
    if (!streaks || streaks.length === 0) {
      return { sent: 0, errors };
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // Filter students who haven't attended today
    const atRiskStudents = streaks.filter(s => s.last_attendance_date !== today);
    
    // Get next class for each at-risk student (within next 2 hours)
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    
    // Get environment variables for push notifications
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    for (const streak of atRiskStudents) {
      try {
        // Get next class with course info
        const { data: nextClass, error: classError } = await supabase
          .from('class_schedules')
          .select(`
            id,
            start_time,
            class_id,
            classes:class_id (
              id,
              name,
              course:course_id (
                code,
                name
              )
            )
          `)
          .eq('student_id', streak.student_id)
          .gte('start_time', new Date().toISOString())
          .lte('start_time', twoHoursFromNow.toISOString())
          .order('start_time', { ascending: true })
          .limit(1)
          .single();
        
        if (classError || !nextClass) {
          continue; // No class in next 2 hours
        }
        
        // Format class time
        const classTime = new Date(nextClass.start_time).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        
        // Get class name
        const classData = nextClass.classes as any;
        const courseData = classData?.course as any;
        const className = courseData?.code || classData?.name || 'your class';
        
        // Store notification in database
        await supabase
          .from('notifications')
          .insert({
            student_id: streak.student_id,
            notification_type: 'streak',
            title: '🔥 Streak at Risk!',
            message: `Don't break your ${streak.current_streak}-day streak! ${className} starts at ${classTime}.`,
            data: {
              streak: streak.current_streak,
              class_schedule_id: nextClass.id,
              class_id: nextClass.class_id,
              className,
              classTime,
            },
            read: false,
            created_at: new Date().toISOString(),
          });
        
        // Send push notification
        if (supabaseUrl && serviceRoleKey) {
          try {
            const { sendStreakRiskNotification } = await import('./notification-sender.ts');
            
            await sendStreakRiskNotification(
              supabaseUrl,
              serviceRoleKey,
              streak.student_id,
              streak.current_streak,
              className,
              classTime
            );
            
            console.log(`[Streak Updater] Sent push notification to student ${streak.student_id}`);
          } catch (pushError) {
            console.error(`[Streak Updater] Error sending push notification:`, pushError);
            // Continue - notification is stored in DB
          }
        }
        
        sent++;
        console.log(`[Streak Updater] Sent at-risk notification to student ${streak.student_id}`);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Student ${streak.student_id}: ${errorMessage}`);
      }
    }
    
    return { sent, errors };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push(errorMessage);
    console.error('[Streak Updater] Error sending notifications:', errorMessage);
    
    return { sent, errors };
  }
}

/**
 * Group attendance records by student ID
 */
function groupByStudent(records: AttendanceRecord[]): Record<string, AttendanceRecord[]> {
  return records.reduce((acc, record) => {
    if (!acc[record.student_id]) {
      acc[record.student_id] = [];
    }
    acc[record.student_id].push(record);
    return acc;
  }, {} as Record<string, AttendanceRecord[]>);
}
