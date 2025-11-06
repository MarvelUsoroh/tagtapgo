/**
 * Leaderboard Update Service (Hybrid Streak-Based Scoring)
 *
 * Calculates and updates leaderboard rankings for students using a hybrid scoring system
 * that prioritizes attendance streaks over points.
 *
 * Scoring Formula: score = (current_streak × 100) + points
 *
 * Ranking Logic:
 * 1. Primary: Score (descending)
 * 2. Tiebreaker 1: Current streak (descending)
 * 3. Tiebreaker 2: Points (descending)
 *
 * Leaderboard Types:
 * - class: Rankings within a specific class/course
 * - year: Rankings within a year level
 * - school: School-wide rankings
 * - friend: Rankings among friends (future)
 *
 * Time Periods:
 * - weekly: Current week (Monday-Sunday)
 * - monthly: Current month
 * - all_time: All-time rankings
 *
 * Requirements: 6, 8
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  calculatePrimaryClassesForStudents, 
  groupStudentsByPrimaryClass,
  logPrimaryClassSummary 
} from "./primary-class-calculator.ts";

export interface LeaderboardEntry {
  id?: string;
  student_id: string;
  university_id?: string;
  student_name?: string;
  student_avatar_url?: string;
  leaderboard_type: "class" | "year" | "school" | "friend";
  period: "weekly" | "monthly" | "all_time";
  course_id?: string | null;
  primary_course_id?: string | null; // New field for class leaderboard grouping
  rank: number;
  points: number;
  current_streak?: number;
  longest_streak?: number;
  score?: number;
  period_start: string;
  period_end: string;
  created_at?: string;
  updated_at?: string;
}

export interface LeaderboardUpdateResult {
  leaderboard_type: "class" | "year" | "school" | "friend";
  period: "weekly" | "monthly" | "all_time";
  course_id?: string;
  entries_updated: number;
  rank_changes: RankChange[];
  errors: string[];
}

export interface RankChange {
  student_id: string;
  old_rank: number | null;
  new_rank: number;
  points: number;
}

// Batched rank changes per student per period
interface BatchedRankChange {
  student_id: string;
  period: "weekly" | "monthly" | "all_time";
  changes: Array<{
    leaderboard_type: "class" | "year" | "school";
    old_rank: number;
    new_rank: number;
    is_significant: boolean;
  }>;
}

/**
 * Update all leaderboards for active students
 *
 * @param supabase - Supabase client with service role
 * @param studentIds - Optional: specific students to update (default: all active)
 * @returns Results for each leaderboard type/period combination
 */
export async function updateLeaderboards(
  supabase: SupabaseClient,
  studentIds?: string[]
): Promise<LeaderboardUpdateResult[]> {
  const results: LeaderboardUpdateResult[] = [];

  // Get all active students if not specified
  let processStudentIds: string[] = studentIds || [];

  if (processStudentIds.length === 0) {
    const { data: students, error } = await supabase
      .from("students")
      .select("id");

    if (error) {
      throw new Error(`Failed to load students: ${error.message}`);
    }

    processStudentIds = students?.map((s) => s.id) || [];
  }

  if (processStudentIds.length === 0) {
    console.log("[Leaderboard Updater] No students to process");
    return [];
  }

  // Batch rank changes by student and period
  const batchedChanges = new Map<string, BatchedRankChange[]>();

  // Update each leaderboard type and period
  const leaderboardTypes: Array<"class" | "year" | "school"> = [
    "class",
    "year",
    "school",
  ];
  const periods: Array<"weekly" | "monthly" | "all_time"> = [
    "weekly",
    "monthly",
    "all_time",
  ];

  for (const type of leaderboardTypes) {
    for (const period of periods) {
      try {
        if (type === "class") {
          // Class leaderboards: one per course
          const classResults = await updateClassLeaderboards(
            supabase,
            period,
            processStudentIds,
            batchedChanges
          );
          results.push(...classResults);
        } else {
          // Year and school leaderboards: single leaderboard
          const result = await updateLeaderboard(
            supabase,
            type,
            period,
            processStudentIds,
            undefined,
            batchedChanges
          );
          results.push(result);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          `[Leaderboard Updater] Error updating ${type}/${period}:`,
          errorMessage
        );

        results.push({
          leaderboard_type: type,
          period,
          entries_updated: 0,
          rank_changes: [],
          errors: [errorMessage],
        });
      }
    }
  }

  // Send batched rank change notifications
  await sendBatchedRankNotifications(supabase, batchedChanges);

  return results;
}

/**
 * Update unified class leaderboards (one entry per student per period)
 */
async function updateClassLeaderboards(
  supabase: SupabaseClient,
  period: "weekly" | "monthly" | "all_time",
  studentIds: string[],
  batchedChanges: Map<string, BatchedRankChange[]>
): Promise<LeaderboardUpdateResult[]> {
  if (studentIds.length === 0) {
    console.log('[Leaderboard Updater] No students to process for class leaderboards');
    return [];
  }

  try {
    // Get period boundaries for primary class calculation
    const { period_start, period_end } = getPeriodBoundaries(period);

    console.log(`[Leaderboard Updater] Creating unified class leaderboard for ${studentIds.length} students (${period})`);

    // Calculate primary classes for all students
    const primaryClasses = await calculatePrimaryClassesForStudents(
      supabase,
      studentIds,
      period_start,
      period_end
    );

    // Log summary for monitoring
    logPrimaryClassSummary(primaryClasses, 'Class Leaderboard Update');

    // Create single unified class leaderboard
    const result = await updateUnifiedClassLeaderboard(
      supabase,
      period,
      period_start,
      period_end,
      studentIds,
      primaryClasses,
      batchedChanges
    );

    console.log(`[Leaderboard Updater] Completed unified class leaderboard update: ${result.entries_updated} entries`);
    return [result];

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error('[Leaderboard Updater] Fatal error in class leaderboard update:', errorMessage);

    // Return single error result for the entire operation
    return [{
      leaderboard_type: "class",
      period,
      entries_updated: 0,
      rank_changes: [],
      errors: [errorMessage],
    }];
  }
}

/**
 * Update unified class leaderboard (one entry per student per period)
 */
async function updateUnifiedClassLeaderboard(
  supabase: SupabaseClient,
  period: "weekly" | "monthly" | "all_time",
  periodStart: string,
  periodEnd: string,
  studentIds: string[],
  primaryClasses: Map<string, string | null>,
  batchedChanges: Map<string, BatchedRankChange[]>
): Promise<LeaderboardUpdateResult> {
  const result: LeaderboardUpdateResult = {
    leaderboard_type: "class",
    period,
    entries_updated: 0,
    rank_changes: [],
    errors: [],
  };

  try {
    // Get existing leaderboard entries for this period
    const { data: existingEntries, error: existingError } = await supabase
      .from("leaderboards")
      .select("*")
      .eq("leaderboard_type", "class")
      .eq("period", period)
      .eq("period_start", periodStart)
      .in("student_id", studentIds);

    if (existingError) {
      throw new Error(`Failed to get existing class entries: ${existingError.message}`);
    }

    const existingMap = new Map<string, any>(
      (existingEntries || []).map(e => [e.student_id, e])
    );

    // Get student data (university_id, full_name, avatar_url)
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('id, university_id, full_name, avatar_url')
      .in('id', studentIds);

    if (studentsError) {
      throw new Error(`Failed to get student data: ${studentsError.message}`);
    }

    const studentDataMap = new Map<string, { id: string; university_id: string; full_name: string; avatar_url?: string }>(
      studentsData?.map(s => [s.id, s as { id: string; university_id: string; full_name: string; avatar_url?: string }]) || []
    );

    // Calculate current rankings for all students
    const rankings = await calculateRankings(
      supabase,
      "class",
      period,
      periodStart,
      periodEnd,
      studentIds
    );

    // Detect rank changes and batch them
    for (const ranking of rankings) {
      const existing = existingMap.get(ranking.student_id);
      const oldRank = existing?.rank || null;
      const newRank = ranking.rank;

      if (oldRank !== null && oldRank !== newRank) {
        result.rank_changes.push({
          student_id: ranking.student_id,
          old_rank: oldRank,
          new_rank: newRank,
          points: ranking.points,
        });

        // Check if change is significant
        const isSignificant = oldRank - newRank >= 5 || (newRank <= 3 && oldRank > 3);

        // Add to batched changes instead of sending immediately
        addToBatchedChanges(
          batchedChanges,
          ranking.student_id,
          period,
          "class",
          oldRank,
          newRank,
          isSignificant
        );
      }
    }

    // Create unified leaderboard entries (one per student)
    if (rankings.length > 0) {
      const entries: LeaderboardEntry[] = rankings.map((r) => {
        const studentData = studentDataMap.get(r.student_id);
        const primaryCourseId = primaryClasses.get(r.student_id);
        
        return {
          student_id: r.student_id,
          university_id: studentData?.university_id,
          student_name: studentData?.full_name,
          student_avatar_url: studentData?.avatar_url,
          leaderboard_type: "class",
          period,
          course_id: primaryCourseId, // Use student's primary course
          primary_course_id: primaryCourseId,
          rank: r.rank,
          points: r.points,
          current_streak: r.current_streak,
          longest_streak: r.longest_streak,
          period_start: periodStart,
          period_end: periodEnd,
          updated_at: new Date().toISOString(),
        };
      });

      // Delete existing entries for these students in this period (class leaderboard)
      const { error: deleteError } = await supabase
        .from("leaderboards")
        .delete()
        .eq("leaderboard_type", "class")
        .eq("period", period)
        .eq("period_start", periodStart)
        .in("student_id", studentIds);

      if (deleteError) {
        throw new Error(`Failed to delete existing class leaderboard entries: ${deleteError.message}`);
      }

      // Insert new entries
      const { error: insertError } = await supabase
        .from("leaderboards")
        .insert(entries);

      if (insertError) {
        throw new Error(`Failed to insert unified class leaderboard entries: ${insertError.message}`);
      }

      result.entries_updated = entries.length;
    }

    console.log(
      `[Leaderboard Updater] Updated unified class leaderboard: ${result.entries_updated} entries, ${result.rank_changes.length} rank changes`
    );

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Leaderboard Updater] Error in updateUnifiedClassLeaderboard:`, errorMessage);
    
    result.errors.push(errorMessage);
    return result;
  }
}



/**
 * Update a single leaderboard
 */
async function updateLeaderboard(
  supabase: SupabaseClient,
  type: "class" | "year" | "school",
  period: "weekly" | "monthly" | "all_time",
  studentIds: string[],
  courseId?: string,
  batchedChanges?: Map<string, BatchedRankChange[]>
): Promise<LeaderboardUpdateResult> {
  const result: LeaderboardUpdateResult = {
    leaderboard_type: type,
    period,
    course_id: courseId,
    entries_updated: 0,
    rank_changes: [],
    errors: [],
  };

  // Get period boundaries
  const { period_start, period_end } = getPeriodBoundaries(period);

  // Get existing leaderboard entries
  const existingEntries = await getExistingEntries(
    supabase,
    type,
    period,
    period_start,
    courseId
  );

  // Get student data (university_id, full_name, avatar_url)
  const { data: studentsData, error: studentsError } = await supabase
    .from('students')
    .select('id, university_id, full_name, avatar_url')
    .in('id', studentIds);

  if (studentsError) {
    throw new Error(`Failed to get student data: ${studentsError.message}`);
  }

  const studentDataMap = new Map<string, { id: string; university_id: string; full_name: string; avatar_url?: string }>(
    studentsData?.map(s => [s.id, s as { id: string; university_id: string; full_name: string; avatar_url?: string }]) || []
  );

  // Calculate current rankings
  const rankings = await calculateRankings(
    supabase,
    type,
    period,
    period_start,
    period_end,
    studentIds,
    courseId
  );

  // Detect rank changes and batch them
  for (const ranking of rankings) {
    const existing = existingEntries.find(
      (e) => e.student_id === ranking.student_id
    );
    const oldRank = existing?.rank || null;
    const newRank = ranking.rank;

    if (oldRank !== null && oldRank !== newRank) {
      result.rank_changes.push({
        student_id: ranking.student_id,
        old_rank: oldRank,
        new_rank: newRank,
        points: ranking.points,
      });

      // Check if change is significant (moved up 5+ places or into top 3)
      const isSignificant = oldRank - newRank >= 5 || (newRank <= 3 && oldRank > 3);

      // Add to batched changes if batching is enabled
      if (batchedChanges) {
        addToBatchedChanges(
          batchedChanges,
          ranking.student_id,
          period,
          type,
          oldRank,
          newRank,
          isSignificant
        );
      }
    }
  }

  // Upsert leaderboard entries
  if (rankings.length > 0) {
    const entries: LeaderboardEntry[] = rankings.map((r) => {
      const studentData = studentDataMap.get(r.student_id);
      return {
        student_id: r.student_id,
        university_id: studentData?.university_id,
        student_name: studentData?.full_name,
        student_avatar_url: studentData?.avatar_url,
        leaderboard_type: type,
        period,
        course_id: null, // Year and school leaderboards don't use course_id (only class does)
        primary_course_id: null, // Only class leaderboards use primary_course_id
        rank: r.rank,
        points: r.points,
        current_streak: r.current_streak,
        longest_streak: r.longest_streak,
        // score is GENERATED ALWAYS - don't insert it
        period_start,
        period_end,
        updated_at: new Date().toISOString(),
      };
    });

    // Delete existing entries for these students in this period (year/school leaderboard)
    let deleteQuery = supabase
      .from("leaderboards")
      .delete()
      .eq("leaderboard_type", type)
      .eq("period", period)
      .eq("period_start", period_start)
      .in("student_id", studentIds);

    if (courseId) {
      deleteQuery = deleteQuery.eq("course_id", courseId);
    } else {
      deleteQuery = deleteQuery.is("course_id", null);
    }

    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      throw new Error(`Failed to delete existing ${type} leaderboard entries: ${deleteError.message}`);
    }

    // Insert new entries
    const { error: insertError } = await supabase
      .from("leaderboards")
      .insert(entries);

    if (insertError) {
      throw new Error(`Failed to insert ${type} leaderboard entries: ${insertError.message}`);
    }

    result.entries_updated = entries.length;
  }

  console.log(
    `[Leaderboard Updater] Updated ${type}/${period}${courseId ? `/${courseId}` : ""}: ${result.entries_updated} entries, ${result.rank_changes.length} rank changes`
  );

  return result;
}

/**
 * Get period boundaries (start and end dates)
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
    // Current month (use UTC to avoid timezone issues)
    const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const monthEnd = new Date(
      Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
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
 * Get existing leaderboard entries
 */
async function getExistingEntries(
  supabase: SupabaseClient,
  type: "class" | "year" | "school",
  period: "weekly" | "monthly" | "all_time",
  period_start: string,
  courseId?: string
): Promise<LeaderboardEntry[]> {
  let query = supabase
    .from("leaderboards")
    .select("*")
    .eq("leaderboard_type", type)
    .eq("period", period)
    .eq("period_start", period_start);

  if (courseId) {
    query = query.eq("course_id", courseId);
  } else {
    query = query.is("course_id", null);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get existing entries: ${error.message}`);
  }

  return data || [];
}

/**
 * Calculate rankings based on hybrid score (streak * 100 + points)
 */
async function calculateRankings(
  supabase: SupabaseClient,
  type: "class" | "year" | "school",
  period: "weekly" | "monthly" | "all_time",
  period_start: string,
  period_end: string,
  studentIds: string[],
  courseId?: string
): Promise<
  Array<{
    student_id: string;
    rank: number;
    points: number;
    current_streak: number;
    longest_streak: number;
    score: number;
  }>
> {
  // Get points for each student in the period
  let pointsQuery = supabase
    .from("points")
    .select("student_id, points")
    .in("student_id", studentIds);

  // Filter by period
  if (period !== "all_time") {
    pointsQuery = pointsQuery
      .gte("created_at", `${period_start}T00:00:00Z`)
      .lte("created_at", `${period_end}T23:59:59Z`);
  }

  const { data: pointsData, error: pointsError } = await pointsQuery;

  if (pointsError) {
    throw new Error(`Failed to get points: ${pointsError.message}`);
  }

  // Get streak data for all students
  const { data: streaksData, error: streaksError } = await supabase
    .from("streaks")
    .select("student_id, current_streak, longest_streak")
    .in("student_id", studentIds);

  if (streaksError) {
    throw new Error(`Failed to get streaks: ${streaksError.message}`);
  }

  // Aggregate points by student
  const studentPoints = new Map<string, number>();

  for (const point of pointsData || []) {
    const current = studentPoints.get(point.student_id) || 0;
    studentPoints.set(point.student_id, current + point.points);
  }

  // Create streaks map
  const studentStreaks = new Map<
    string,
    { current_streak: number; longest_streak: number }
  >();

  for (const streak of streaksData || []) {
    studentStreaks.set(streak.student_id, {
      current_streak: streak.current_streak || 0,
      longest_streak: streak.longest_streak || 0,
    });
  }

  // Calculate scores and prepare for sorting
  const studentsWithScores = studentIds.map((student_id) => {
    const points = studentPoints.get(student_id) || 0;
    const streakData = studentStreaks.get(student_id) || {
      current_streak: 0,
      longest_streak: 0,
    };
    const score = streakData.current_streak * 100 + points;

    return {
      student_id,
      points,
      current_streak: streakData.current_streak,
      longest_streak: streakData.longest_streak,
      score,
    };
  });

  // Sort by score (descending), then by current_streak, then by points
  const sortedStudents = studentsWithScores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.current_streak !== a.current_streak)
      return b.current_streak - a.current_streak;
    return b.points - a.points;
  });

  // Assign ranks (handle ties based on score)
  const rankings: Array<{
    student_id: string;
    rank: number;
    points: number;
    current_streak: number;
    longest_streak: number;
    score: number;
  }> = [];
  let currentRank = 1;
  let previousScore = -1;
  let studentsAtRank = 0;

  for (let i = 0; i < sortedStudents.length; i++) {
    const student = sortedStudents[i];

    if (student.score !== previousScore) {
      // New rank
      currentRank = i + 1;
      previousScore = student.score;
      studentsAtRank = 1;
    } else {
      // Tie - same rank as previous
      studentsAtRank++;
    }

    rankings.push({
      student_id: student.student_id,
      rank: currentRank,
      points: student.points,
      current_streak: student.current_streak,
      longest_streak: student.longest_streak,
      score: student.score,
    });
  }

  return rankings;
}

/**
 * Add rank change to batched changes
 */
function addToBatchedChanges(
  batchedChanges: Map<string, BatchedRankChange[]>,
  studentId: string,
  period: "weekly" | "monthly" | "all_time",
  leaderboardType: "class" | "year" | "school",
  oldRank: number,
  newRank: number,
  isSignificant: boolean
): void {
  const key = `${studentId}:${period}`;
  
  if (!batchedChanges.has(key)) {
    batchedChanges.set(key, []);
  }

  const batches = batchedChanges.get(key)!;
  let batch = batches.find(b => b.period === period);

  if (!batch) {
    batch = {
      student_id: studentId,
      period,
      changes: [],
    };
    batches.push(batch);
  }

  batch.changes.push({
    leaderboard_type: leaderboardType,
    old_rank: oldRank,
    new_rank: newRank,
    is_significant: isSignificant,
  });
}

/**
 * Send batched rank change notifications
 */
async function sendBatchedRankNotifications(
  supabase: SupabaseClient,
  batchedChanges: Map<string, BatchedRankChange[]>
): Promise<void> {
  for (const [key, batches] of batchedChanges.entries()) {
    for (const batch of batches) {
      // Only send if at least one change is significant
      const hasSignificantChange = batch.changes.some(c => c.is_significant);
      if (!hasSignificantChange) {
        continue;
      }

      const periodName =
        batch.period === "weekly"
          ? "Weekly"
          : batch.period === "monthly"
            ? "Monthly"
            : "All-Time";

      // Build message with all rank changes
      const changeLines = batch.changes.map(change => {
        const leaderboardName =
          change.leaderboard_type === "class"
            ? "Class"
            : change.leaderboard_type === "year"
              ? "Year"
              : "School";
        
        const isImprovement = change.new_rank < change.old_rank;
        const rankDiff = Math.abs(change.old_rank - change.new_rank);
        const arrow = isImprovement ? "↑" : "↓";
        
        return `• ${leaderboardName}: #${change.new_rank} (${arrow}${rankDiff})`;
      });

      const title = `🏆 ${periodName} Leaderboard Update!`;
      const message = `You're climbing the ranks:\n${changeLines.join("\n")}`;

      // Store notification in database
      const { error: dbError } = await supabase.from("notifications").insert({
        student_id: batch.student_id,
        notification_type: "rank",
        title,
        message,
        data: {
          period: batch.period,
          changes: batch.changes,
          batched: true,
        },
        read: false,
        created_at: new Date().toISOString(),
      });

      if (dbError) {
        console.error(
          "[Leaderboard Updater] Error storing batched rank notification:",
          dbError
        );
        continue;
      }

      // Send push notification (non-blocking)
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !serviceRoleKey) {
          console.warn(
            "[Leaderboard Updater] Missing environment variables, skipping push notification"
          );
          continue;
        }

        // Send via send-push-notification Edge Function
        const response = await fetch(
          `${supabaseUrl}/functions/v1/send-push-notification`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              studentId: batch.student_id,
              title,
              body: message,
              data: {
                type: "rank",
                period: batch.period,
                changes: batch.changes,
                batched: true,
              },
            }),
          }
        );

        if (!response.ok) {
          console.error(
            `[Leaderboard Updater] Failed to send batched push notification: ${response.status}`
          );
        } else {
          console.log(
            `[Leaderboard Updater] Sent batched rank notification to student ${batch.student_id} (${batch.changes.length} changes)`
          );
        }
      } catch (error) {
        console.error(
          "[Leaderboard Updater] Error sending batched push notification:",
          error
        );
      }
    }
  }
}
