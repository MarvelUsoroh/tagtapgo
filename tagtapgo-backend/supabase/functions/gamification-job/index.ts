/**
 * Gamification Job
 *
 * Main orchestration job that runs after attendance sync completes.
 * Processes new attendance records and updates all gamification systems.
 *
 * Flow:
 * 1. Get new attendance records since last run
 * 2. Calculate and award points
 * 3. Update streaks
 * 4. Check achievements
 * 5. Update leaderboards
 * 6. Log results
 *
 * Runs: After attendance sync (triggered by attendance-sync-job)
 * Frequency: Every 5 minutes (same as attendance sync)
 *
 * Requirements: All gamification (1, 2, 4, 6, 7, 8)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calculateAndAwardPoints } from "../_shared/services/points-calculator.ts";
import type { AttendanceRecord as PointsAttendanceRecord } from "../_shared/services/points-calculator.ts";
import { updateStreaks } from "../_shared/services/streak-updater.ts";
import { checkAchievements } from "../_shared/services/achievement-checker.ts";
import { updateLeaderboards } from "../_shared/services/leaderboard-updater.ts";

// Initialize Supabase client (access via globalThis to keep TS happy outside Deno)
const __env = (globalThis as any)?.Deno?.env;
const supabaseUrl = __env?.get("SUPABASE_URL")!;
const supabaseServiceKey = __env?.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface GamificationResult {
  success: boolean;
  attendance_processed: number;
  students_affected: number;
  points_awarded: number;
  streaks_updated: number;
  achievements_unlocked: number;
  leaderboards_updated: number;
  errors: string[];
  duration: number;
  // Enhanced metrics for monitoring
  class_leaderboard_groups?: number;
  class_rank_changes?: number;
  leaderboard_breakdown?: Record<string, number>;
}

serve(async (_req: Request) => {
  const startTime = Date.now();

  try {
    console.log("[GAMIFICATION JOB] Starting gamification job...");

    // Get last run time from job execution log
    const lastRunTime = await getLastRunTime();
    console.log(`[GAMIFICATION JOB] Processing records since ${lastRunTime}`);

    // Get new attendance records since last run
    const { data: newAttendance, error: attendanceError } = await supabase
      .from("attendance")
      .select("*")
      .gte("created_at", lastRunTime)
      .order("created_at", { ascending: true });

    if (attendanceError) {
      throw new Error(`Failed to load attendance: ${attendanceError.message}`);
    }

  if (!newAttendance || newAttendance.length === 0) {
      console.log("[GAMIFICATION JOB] No new attendance records to process");

      // Even without new attendance, we should still update leaderboards
      // in case points changed from achievements, redemptions, or other sources
      const result: GamificationResult = {
        success: true,
        attendance_processed: 0,
        students_affected: 0,
        points_awarded: 0,
        streaks_updated: 0,
        achievements_unlocked: 0,
        leaderboards_updated: 0,
        errors: [],
        duration: 0,
      };

      // Update leaderboards for all active students (in case points changed)
      // This includes the new unified class leaderboards based on primary classes
      try {
        console.log(
          "[GAMIFICATION JOB] Updating leaderboards (no new attendance)..."
        );
        console.log(
          "[GAMIFICATION JOB] Note: Class leaderboards will use dynamic primary class calculation"
        );
        const leaderboardResults = await updateLeaderboards(supabase);

        result.leaderboards_updated = leaderboardResults.reduce(
          (sum, r) => sum + r.entries_updated,
          0
        );

        // Enhanced metrics collection for monitoring
        const resultsByType = leaderboardResults.reduce(
          (acc, r) => {
            acc[r.leaderboard_type] =
              (acc[r.leaderboard_type] || 0) + r.entries_updated;
            return acc;
          },
          {} as Record<string, number>
        );

        const classResults = leaderboardResults.filter(
          (r) => r.leaderboard_type === "class"
        );
        const classRankChanges = classResults.reduce(
          (sum, r) => sum + r.rank_changes.length,
          0
        );

        // Store enhanced metrics
        result.class_leaderboard_groups = classResults.length;
        result.class_rank_changes = classRankChanges;
        result.leaderboard_breakdown = resultsByType;

        if (classResults.length > 0) {
          console.log(
            `[GAMIFICATION JOB] Class leaderboards: ${classResults.length} primary class groups updated`
          );
          if (classRankChanges > 0) {
            console.log(
              `[GAMIFICATION JOB] Class rank changes: ${classRankChanges} students changed ranks`
            );
          }
        }

        // Collect errors
        leaderboardResults.forEach((r) => {
          if (r.errors && r.errors.length > 0) {
            const errorStrings = (r.errors as string[]).map((e) => `Leaderboards: ${e}`);
            result.errors.push(...errorStrings);
          }
        });

        console.log(
          `[GAMIFICATION JOB] ✓ Updated ${result.leaderboards_updated} leaderboard entries`
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          "[GAMIFICATION JOB] ✗ Leaderboard update failed:",
          errorMessage
        );
        result.errors.push(`Leaderboard update: ${errorMessage}`);
      }

      result.duration = Date.now() - startTime;
      result.success = result.errors.length === 0;

      await logJobExecution(result.success ? "success" : "partial", result);

      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(
      `[GAMIFICATION JOB] Processing ${newAttendance.length} attendance records`
    );

    // Type the attendance rows using shared service type
    const newAttendanceTyped: PointsAttendanceRecord[] = (newAttendance ?? []) as PointsAttendanceRecord[];

    // Get unique student IDs
    const studentIds: string[] = [
      ...new Set(newAttendanceTyped.map((a) => a.student_id)),
    ];
    console.log(`[GAMIFICATION JOB] Affecting ${studentIds.length} students`);

    const result: GamificationResult = {
      success: true,
      attendance_processed: newAttendance.length,
      students_affected: studentIds.length,
      points_awarded: 0,
      streaks_updated: 0,
      achievements_unlocked: 0,
      leaderboards_updated: 0,
      errors: [],
      duration: 0,
    };

    // Step 1: Calculate and award points
    try {
      console.log("[GAMIFICATION JOB] Step 1: Calculating points...");
      const pointsResults = await calculateAndAwardPoints(
        supabase,
        newAttendanceTyped
      );

      result.points_awarded = pointsResults.reduce(
        (sum, r) => sum + r.total_points_awarded,
        0
      );

      // Collect errors
      pointsResults.forEach((r) => {
        if (r.errors && r.errors.length > 0) {
          const errorStrings = (r.errors as string[]).map((e) => `Points: ${e}`);
          result.errors.push(...errorStrings);
        }
      });

      console.log(
        `[GAMIFICATION JOB] ✓ Awarded ${result.points_awarded} points`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        "[GAMIFICATION JOB] ✗ Points calculation failed:",
        errorMessage
      );
      result.errors.push(`Points calculation: ${errorMessage}`);
      // Continue with other steps
    }

    // Step 2: Update streaks
    try {
      console.log("[GAMIFICATION JOB] Step 2: Updating streaks...");
  const streakResults = await updateStreaks(supabase, newAttendanceTyped);

      result.streaks_updated = streakResults.length;

      // Collect errors
      streakResults.forEach((r) => {
        if (r.errors && r.errors.length > 0) {
          const errorStrings = (r.errors as string[]).map((e) => `Streaks: ${e}`);
          result.errors.push(...errorStrings);
        }
      });

      console.log(
        `[GAMIFICATION JOB] ✓ Updated ${result.streaks_updated} streaks`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("[GAMIFICATION JOB] ✗ Streak update failed:", errorMessage);
      result.errors.push(`Streak update: ${errorMessage}`);
      // Continue with other steps
    }

    // Step 3: Check achievements
    try {
      console.log("[GAMIFICATION JOB] Step 3: Checking achievements...");
      const achievementResults = await checkAchievements(supabase, studentIds);

      result.achievements_unlocked = achievementResults.reduce(
        (sum, r) => sum + r.achievements_unlocked.length,
        0
      );

      // Collect errors
      achievementResults.forEach((r) => {
        if (r.errors && r.errors.length > 0) {
          const errorStrings = (r.errors as string[]).map((e) => `Achievements: ${e}`);
          result.errors.push(...errorStrings);
        }
      });

      console.log(
        `[GAMIFICATION JOB] ✓ Unlocked ${result.achievements_unlocked} achievements`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        "[GAMIFICATION JOB] ✗ Achievement check failed:",
        errorMessage
      );
      result.errors.push(`Achievement check: ${errorMessage}`);
      // Continue with other steps
    }

    // Step 4: Update leaderboards
    // This includes the new unified class leaderboards with primary class calculation
    try {
      console.log("[GAMIFICATION JOB] Step 4: Updating leaderboards...");
      console.log(
        `[GAMIFICATION JOB] Processing ${studentIds.length} students for leaderboard updates`
      );
      console.log(
        "[GAMIFICATION JOB] Class leaderboards will calculate primary classes based on attendance patterns"
      );

      const leaderboardResults = await updateLeaderboards(supabase, studentIds);

      result.leaderboards_updated = leaderboardResults.reduce(
        (sum, r) => sum + r.entries_updated,
        0
      );

      // Enhanced metrics collection for monitoring
      const resultsByType = leaderboardResults.reduce(
        (acc, r) => {
          acc[r.leaderboard_type] =
            (acc[r.leaderboard_type] || 0) + r.entries_updated;
          return acc;
        },
        {} as Record<string, number>
      );

      console.log(
        "[GAMIFICATION JOB] Leaderboard updates by type:",
        resultsByType
      );

      // Collect class leaderboard specific metrics
      const classResults = leaderboardResults.filter(
        (r) => r.leaderboard_type === "class"
      );
      const classRankChanges = classResults.reduce(
        (sum, r) => sum + r.rank_changes.length,
        0
      );

      // Store enhanced metrics for logging
      result.class_leaderboard_groups = classResults.length;
      result.class_rank_changes = classRankChanges;
      result.leaderboard_breakdown = resultsByType;

      if (classResults.length > 0) {
        console.log(
          `[GAMIFICATION JOB] Class leaderboards: ${classResults.length} primary class groups processed`
        );
        if (classRankChanges > 0) {
          console.log(
            `[GAMIFICATION JOB] Class rank changes: ${classRankChanges} students changed ranks`
          );
        }
      }

      // Collect errors
      leaderboardResults.forEach((r) => {
        if (r.errors && r.errors.length > 0) {
          const errorStrings = (r.errors as string[]).map((e) => `Leaderboards: ${e}`);
          result.errors.push(...errorStrings);
        }
      });

      console.log(
        `[GAMIFICATION JOB] ✓ Updated ${result.leaderboards_updated} leaderboard entries`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        "[GAMIFICATION JOB] ✗ Leaderboard update failed:",
        errorMessage
      );
      result.errors.push(`Leaderboard update: ${errorMessage}`);
      // Continue (no more steps)
    }

    // Calculate total duration
    result.duration = Date.now() - startTime;

    // Determine overall success (success if no critical errors)
    result.success = result.errors.length === 0;

    // Log job execution
    await logJobExecution(result.success ? "success" : "partial", result);

    console.log(`[GAMIFICATION JOB] Completed in ${result.duration}ms`);
    console.log(
      `[GAMIFICATION JOB] Summary: ${result.points_awarded} points, ${result.streaks_updated} streaks, ${result.achievements_unlocked} achievements, ${result.leaderboards_updated} leaderboard entries`
    );

    // Enhanced summary for class leaderboards
    if (
      result.class_leaderboard_groups &&
      result.class_leaderboard_groups > 0
    ) {
      console.log(
        `[GAMIFICATION JOB] Class leaderboards: ${result.class_leaderboard_groups} primary class groups, ${result.class_rank_changes || 0} rank changes`
      );
    }

    if (
      result.leaderboard_breakdown &&
      Object.keys(result.leaderboard_breakdown).length > 0
    ) {
      console.log(
        `[GAMIFICATION JOB] Leaderboard breakdown:`,
        result.leaderboard_breakdown
      );
    }

    if (result.errors.length > 0) {
      console.warn(
        `[GAMIFICATION JOB] Completed with ${result.errors.length} errors`
      );
    }

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
      status: result.success ? 200 : 207, // 207 = Multi-Status (partial success)
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[GAMIFICATION JOB] Fatal error:", errorMessage);

    const result: GamificationResult = {
      success: false,
      attendance_processed: 0,
      students_affected: 0,
      points_awarded: 0,
      streaks_updated: 0,
      achievements_unlocked: 0,
      leaderboards_updated: 0,
      errors: [errorMessage],
      duration: Date.now() - startTime,
    };

    await logJobExecution("error", result);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});

/**
 * Get last run time from job execution log
 * Returns timestamp of last successful run, or 5 minutes ago if no previous run
 */
async function getLastRunTime(): Promise<string> {
  const { data, error } = await supabase
    .from("cron_job_executions")
    .select("completed_at")
    .eq("job_name", "gamification-job")
    .eq("status", "success")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    // No previous run - default to 5 minutes ago
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return fiveMinutesAgo.toISOString();
  }

  return data.completed_at;
}

/**
 * Log job execution to cron_job_executions table
 */
async function logJobExecution(
  status: "success" | "partial" | "error",
  result: GamificationResult
): Promise<void> {
  try {
    await supabase.from("cron_job_executions").insert({
      job_name: "gamification-job",
      status,
      started_at: new Date(Date.now() - result.duration).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: result.duration,
      records_processed: result.attendance_processed,
      records_succeeded: result.attendance_processed - result.errors.length,
      records_failed: result.errors.length,
      error_message: result.errors.length > 0 ? result.errors.join("; ") : null,
      metadata: {
        students_affected: result.students_affected,
        points_awarded: result.points_awarded,
        streaks_updated: result.streaks_updated,
        achievements_unlocked: result.achievements_unlocked,
        leaderboards_updated: result.leaderboards_updated,
        // Enhanced class leaderboard metrics
        class_leaderboard_groups: result.class_leaderboard_groups || 0,
        class_rank_changes: result.class_rank_changes || 0,
        leaderboard_breakdown: result.leaderboard_breakdown || {},
      },
    });
  } catch (error) {
    console.error("[GAMIFICATION JOB] Failed to log execution:", error);
    // Don't throw - job already completed
  }
}
