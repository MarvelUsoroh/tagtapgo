/**
 * Points Calculation Service
 * 
 * Calculates and awards points for attendance with bonuses.
 * Implements idempotent points awarding using transaction ledger pattern.
 * 
 * Point Rules:
 * - Base: status weight × class duration (hours)
 *     • Present → 2 points per hour
 *     • Late / Excused → 1 point per hour
 *     • Absent → 0 points (no ledger entry)
 * - Early Arrival Bonus: +5 points if 5+ minutes early
 * - Perfect Week Bonus: +50 points for 5/5 days attendance
 * - Perfect Month Bonus: +200 points for 20/20 days attendance
 * 
 * Requirements: 1, 2
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Point values
const POINTS = {
  EARLY_ARRIVAL_BONUS: 5,
  PERFECT_WEEK_BONUS: 50,
  PERFECT_MONTH_BONUS: 200,
} as const;

const STATUS_POINT_WEIGHTS: Record<AttendanceStatus, number> = {
  present: 2,
  late: 1,
  excused: 1,
  absent: 0,
  unknown: 0,
};

const DEFAULT_SESSION_DURATION_HOURS = 1;

// Early arrival threshold (minutes)
const EARLY_ARRIVAL_THRESHOLD_MINUTES = 5;

type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent' | 'unknown';

interface AttendanceMetadata {
  session_duration_seconds?: number;
  session_duration_minutes?: number;
  session_duration_hours?: number;
  session_description?: string;
  [key: string]: unknown;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  course_id: string;
  date: string;
  status: AttendanceStatus;
  class_id?: string;
  session_id?: string;
  check_in_time?: string;
  scheduled_time?: string;
  created_at: string;
  metadata?: AttendanceMetadata | null;
}

export interface PointsAwardResult {
  student_id: string;
  total_points_awarded: number;
  transactions: PointTransaction[];
  errors: string[];
}

export interface PointTransaction {
  transaction_type: 'attendance' | 'early_arrival' | 'perfect_week' | 'perfect_month';
  points: number;
  description: string;
  reference_id: string;
  metadata?: Record<string, any>;
}

/**
 * Calculate and award points for new attendance records
 * 
 * @param supabase - Supabase client with service role
 * @param attendanceRecords - New attendance records to process
 * @returns Results for each student
 */
export async function calculateAndAwardPoints(
  supabase: SupabaseClient,
  attendanceRecords: AttendanceRecord[]
): Promise<PointsAwardResult[]> {
  const results: PointsAwardResult[] = [];
  
  // Group attendance by student
  const attendanceByStudent = groupByStudent(attendanceRecords);
  
  // Process each student
  for (const [studentId, records] of Object.entries(attendanceByStudent)) {
    const result: PointsAwardResult = {
      student_id: studentId,
      total_points_awarded: 0,
      transactions: [],
      errors: [],
    };
    
    try {
      // Process each attendance record
      for (const record of records) {
        // Only award points for present/late/excused (not absent)
        if (record.status === 'absent') {
          continue;
        }
        
        // Check if points already awarded (idempotency)
        const alreadyAwarded = await checkIfPointsAwarded(supabase, record.id);
        if (alreadyAwarded) {
          console.log(`[Points Calculator] Points already awarded for attendance ${record.id}, skipping`);
          continue;
        }
        
        // Calculate base points based on class duration and Moodle weight
        const baseTransaction = buildBaseAttendanceTransaction(record);
        if (!baseTransaction) {
          continue;
        }
        
        result.transactions.push(baseTransaction);
        result.total_points_awarded += baseTransaction.points;
        
        // Check for early arrival bonus
        if (record.check_in_time && record.scheduled_time) {
          const minutesEarly = calculateMinutesEarly(record.check_in_time, record.scheduled_time);
          
          if (minutesEarly >= EARLY_ARRIVAL_THRESHOLD_MINUTES) {
            const earlyTransaction: PointTransaction = {
              transaction_type: 'early_arrival',
              points: POINTS.EARLY_ARRIVAL_BONUS,
              description: `Early arrival (${minutesEarly} min early)`,
              reference_id: record.id,
              metadata: {
                course_id: record.course_id,
                date: record.date,
                minutes_early: minutesEarly,
              },
            };
            
            result.transactions.push(earlyTransaction);
            result.total_points_awarded += earlyTransaction.points;
          }
        }
      }
      
      // Check for perfect week bonus
      const perfectWeekBonus = await checkPerfectWeekBonus(supabase, studentId);
      if (perfectWeekBonus) {
        const weekTransaction: PointTransaction = {
          transaction_type: 'perfect_week',
          points: POINTS.PERFECT_WEEK_BONUS,
          description: `Perfect week bonus (5/5 days)`,
          reference_id: `perfect_week_${perfectWeekBonus.week_start}`,
          metadata: {
            week_start: perfectWeekBonus.week_start,
            week_end: perfectWeekBonus.week_end,
            days_attended: perfectWeekBonus.days_attended,
          },
        };
        
        result.transactions.push(weekTransaction);
        result.total_points_awarded += weekTransaction.points;
        
        // Send perfect week notification
        await sendPerfectWeekNotification(supabase, studentId, POINTS.PERFECT_WEEK_BONUS);
      }
      
      // Check for perfect month bonus
      const perfectMonthBonus = await checkPerfectMonthBonus(supabase, studentId);
      if (perfectMonthBonus) {
        const monthTransaction: PointTransaction = {
          transaction_type: 'perfect_month',
          points: POINTS.PERFECT_MONTH_BONUS,
          description: `Perfect month bonus (20/20 days)`,
          reference_id: `perfect_month_${perfectMonthBonus.month_start}`,
          metadata: {
            month_start: perfectMonthBonus.month_start,
            month_end: perfectMonthBonus.month_end,
            days_attended: perfectMonthBonus.days_attended,
          },
        };
        
        result.transactions.push(monthTransaction);
        result.total_points_awarded += monthTransaction.points;
        
        // Send perfect month notification
        await sendPerfectMonthNotification(supabase, studentId, POINTS.PERFECT_MONTH_BONUS);
      }
      
      // Award all points in a single transaction
      if (result.transactions.length > 0) {
        await awardPoints(supabase, studentId, result.transactions);
        console.log(`[Points Calculator] Awarded ${result.total_points_awarded} points to student ${studentId}`);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);
      console.error(`[Points Calculator] Error processing student ${studentId}:`, errorMessage);
    }
    
    results.push(result);
  }
  
  return results;
}

function buildBaseAttendanceTransaction(record: AttendanceRecord): PointTransaction | null {
  const statusWeight = STATUS_POINT_WEIGHTS[record.status] ?? 0;
  if (statusWeight <= 0) {
    return null;
  }

  const durationHours = resolveSessionDurationHours(record);
  const rawPoints = statusWeight * durationHours;
  const roundedPoints = Math.max(0, Math.round(rawPoints));

  if (roundedPoints <= 0) {
    return null;
  }

  return {
    transaction_type: 'attendance',
    points: roundedPoints,
    description: `Attendance for ${record.date}`,
    reference_id: record.id,
    metadata: {
      course_id: record.course_id,
      date: record.date,
      status: record.status,
      status_weight: statusWeight,
      duration_hours: durationHours,
    },
  };
}

function resolveSessionDurationHours(record: AttendanceRecord): number {
  const metadata: AttendanceMetadata = record.metadata || {};
  const asNumber = (value: unknown) => (typeof value === 'number' && !Number.isNaN(value) ? value : null);

  const hours = asNumber(metadata.session_duration_hours);
  if (hours && hours > 0) {
    return hours;
  }

  const minutes = asNumber(metadata.session_duration_minutes);
  if (minutes && minutes > 0) {
    return minutes / 60;
  }

  const seconds = asNumber(metadata.session_duration_seconds);
  if (seconds && seconds > 0) {
    return seconds / 3600;
  }

  return DEFAULT_SESSION_DURATION_HOURS;
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

/**
 * Check if points have already been awarded for an attendance record (idempotency)
 */
async function checkIfPointsAwarded(
  supabase: SupabaseClient,
  attendanceId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('points')
    .select('id')
    .eq('reference_id', attendanceId)
    .eq('transaction_type', 'attendance')
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    console.error('[Points Calculator] Error checking points:', error);
  }
  
  return !!data;
}

/**
 * Calculate minutes early (positive if early, negative if late)
 */
function calculateMinutesEarly(checkInTime: string, scheduledTime: string): number {
  const checkIn = new Date(checkInTime);
  const scheduled = new Date(scheduledTime);
  
  const diffMs = scheduled.getTime() - checkIn.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  return diffMinutes;
}

/**
 * Check if student qualifies for perfect week bonus
 * Perfect week = 5 days of attendance in the current week (Mon-Fri)
 */
async function checkPerfectWeekBonus(
  supabase: SupabaseClient,
  studentId: string
): Promise<{ week_start: string; week_end: string; days_attended: number } | null> {
  // Get current week boundaries (Monday to Friday)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  // Calculate Monday of current week
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);
  
  // Calculate Friday of current week
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);
  
  // Check if we're past Friday (only award on Friday or later)
  if (now < friday) {
    return null;
  }
  
  // Check if bonus already awarded for this week
  const weekStart = monday.toISOString().split('T')[0];
  const { data: existingBonus } = await supabase
    .from('points')
    .select('id')
    .eq('student_id', studentId)
    .eq('transaction_type', 'perfect_week')
    .eq('reference_id', `perfect_week_${weekStart}`)
    .single();
  
  if (existingBonus) {
    return null; // Already awarded
  }
  
  // Count attendance days in current week
  const { data: attendance, error } = await supabase
    .from('attendance')
    .select('date')
    .eq('student_id', studentId)
    .in('status', ['present', 'late', 'excused'])
    .gte('date', monday.toISOString())
    .lte('date', friday.toISOString());
  
  if (error) {
    console.error('[Points Calculator] Error checking perfect week:', error);
    return null;
  }
  
  // Count unique days (in case of multiple classes per day)
  const uniqueDays = new Set(attendance?.map(a => a.date) || []);
  const daysAttended = uniqueDays.size;
  
  // Award bonus if 5 days attended
  if (daysAttended >= 5) {
    return {
      week_start: weekStart,
      week_end: friday.toISOString().split('T')[0],
      days_attended: daysAttended,
    };
  }
  
  return null;
}

/**
 * Check if student qualifies for perfect month bonus
 * Perfect month = 20 days of attendance in the current month
 */
async function checkPerfectMonthBonus(
  supabase: SupabaseClient,
  studentId: string
): Promise<{ month_start: string; month_end: string; days_attended: number } | null> {
  // Get current month boundaries
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  
  // Check if we're past the 20th day of the month (only award after 20th)
  if (now.getDate() < 20) {
    return null;
  }
  
  // Check if bonus already awarded for this month
  const monthStartStr = monthStart.toISOString().split('T')[0];
  const { data: existingBonus } = await supabase
    .from('points')
    .select('id')
    .eq('student_id', studentId)
    .eq('transaction_type', 'perfect_month')
    .eq('reference_id', `perfect_month_${monthStartStr}`)
    .single();
  
  if (existingBonus) {
    return null; // Already awarded
  }
  
  // Count attendance days in current month
  const { data: attendance, error } = await supabase
    .from('attendance')
    .select('date')
    .eq('student_id', studentId)
    .in('status', ['present', 'late', 'excused'])
    .gte('date', monthStart.toISOString())
    .lte('date', monthEnd.toISOString());
  
  if (error) {
    console.error('[Points Calculator] Error checking perfect month:', error);
    return null;
  }
  
  // Count unique days
  const uniqueDays = new Set(attendance?.map(a => a.date) || []);
  const daysAttended = uniqueDays.size;
  
  // Award bonus if 20 days attended
  if (daysAttended >= 20) {
    return {
      month_start: monthStartStr,
      month_end: monthEnd.toISOString().split('T')[0],
      days_attended: daysAttended,
    };
  }
  
  return null;
}

/**
 * Award points by inserting transactions into points table
 * Uses idempotent inserts with reference_id to prevent duplicates
 */
async function awardPoints(
  supabase: SupabaseClient,
  studentId: string,
  transactions: PointTransaction[]
): Promise<void> {
  const pointsRecords = transactions.map(tx => ({
    student_id: studentId,
    points: tx.points,
    transaction_type: tx.transaction_type,
    reference_id: tx.reference_id,
    description: tx.description,
    metadata: tx.metadata || {},
    created_at: new Date().toISOString(),
  }));
  
  // Insert all transactions
  const { error } = await supabase
    .from('points')
    .insert(pointsRecords);
  
  if (error) {
    // Check if error is due to duplicate reference_id (idempotency)
    if (error.code === '23505') { // Unique violation
      console.log('[Points Calculator] Points already awarded (duplicate reference_id), skipping');
      return;
    }
    
    throw new Error(`Failed to award points: ${error.message}`);
  }
}

/**
 * Calculate compensating entry for point adjustment
 * Used when attendance is corrected or points need to be adjusted
 */
export async function createCompensatingEntry(
  supabase: SupabaseClient,
  studentId: string,
  originalReferenceId: string,
  adjustmentPoints: number,
  reason: string
): Promise<void> {
  const { error } = await supabase
    .from('points')
    .insert({
      student_id: studentId,
      points: adjustmentPoints,
      transaction_type: 'adjustment',
      reference_id: `adjustment_${originalReferenceId}_${Date.now()}`,
      description: `Adjustment: ${reason}`,
      metadata: {
        original_reference_id: originalReferenceId,
        reason,
      },
      created_at: new Date().toISOString(),
    });
  
  if (error) {
    throw new Error(`Failed to create compensating entry: ${error.message}`);
  }
}

/**
 * Send perfect week notification
 */
async function sendPerfectWeekNotification(
  supabase: SupabaseClient,
  studentId: string,
  bonusPoints: number
): Promise<void> {
  // Store notification in database
  const { error: dbError } = await supabase
    .from('notifications')
    .insert({
      student_id: studentId,
      notification_type: 'perfect_week',
      title: '🌟 Perfect Week!',
      message: `Amazing! You attended all 5 days this week. +${bonusPoints} bonus points!`,
      data: {
        bonusPoints,
      },
      read: false,
      created_at: new Date().toISOString(),
    });
  
  if (dbError) {
    console.error('[Points Calculator] Error storing perfect week notification:', dbError);
  }
  
  // Send push notification (non-blocking)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.warn('[Points Calculator] Missing environment variables, skipping push notification');
      return;
    }
    
    const { sendPerfectWeekNotification: sendPush } = await import('./notification-sender.ts');
    
    await sendPush(supabaseUrl, serviceRoleKey, studentId, bonusPoints);
    
    console.log(`[Points Calculator] Sent perfect week push notification to student ${studentId}`);
  } catch (error) {
    console.error('[Points Calculator] Error sending perfect week push notification:', error);
  }
}

/**
 * Send perfect month notification
 */
async function sendPerfectMonthNotification(
  supabase: SupabaseClient,
  studentId: string,
  bonusPoints: number
): Promise<void> {
  // Store notification in database
  const { error: dbError } = await supabase
    .from('notifications')
    .insert({
      student_id: studentId,
      notification_type: 'perfect_month',
      title: '🏅 Perfect Month!',
      message: `Incredible! You attended 20+ days this month. +${bonusPoints} bonus points!`,
      data: {
        bonusPoints,
      },
      read: false,
      created_at: new Date().toISOString(),
    });
  
  if (dbError) {
    console.error('[Points Calculator] Error storing perfect month notification:', dbError);
  }
  
  // Send push notification (non-blocking)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.warn('[Points Calculator] Missing environment variables, skipping push notification');
      return;
    }
    
    const { sendPerfectMonthNotification: sendPush } = await import('./notification-sender.ts');
    
    await sendPush(supabaseUrl, serviceRoleKey, studentId, bonusPoints);
    
    console.log(`[Points Calculator] Sent perfect month push notification to student ${studentId}`);
  } catch (error) {
    console.error('[Points Calculator] Error sending perfect month push notification:', error);
  }
}
