// goal-notification-job (Edge Function)
// Scheduled job to check goal progress and send notifications
// Deploy with: supabase functions deploy goal-notification-job

import { createClient } from "npm:@supabase/supabase-js@2.32.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required environment variables");
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AttendanceGoal {
  type: "weekly" | "monthly";
  target_percentage: number;
  created_at: string;
  updated_at: string;
}

interface GoalProgress {
  current: number;
  target: number;
  status: "on_track" | "behind" | "achieved";
  classes_attended: number;
  total_classes: number;
}

async function calculateGoalProgress(
  supabase: any,
  studentId: string,
  goalType: "weekly" | "monthly",
  targetPercentage: number
): Promise<GoalProgress> {
  const now = new Date();
  const daysBack = goalType === "weekly" ? 7 : 30;
  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  
  const startDateStr = startDate.toISOString().split('T')[0];
  const nowDateStr = now.toISOString().split('T')[0];

  const { data: attendance } = await supabase
    .from("attendance")
    .select("id, status, date, course_id")
    .eq("student_id", studentId)
    .gte("date", startDateStr)
    .lte("date", nowDateStr);

  if (!attendance || attendance.length === 0) {
    return {
      current: 0,
      target: targetPercentage,
      status: "on_track",
      classes_attended: 0,
      total_classes: 0,
    };
  }

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("student_id", studentId)
    .eq("status", "active");

  const enrolledCourseIds = new Set(enrollments?.map((e: any) => e.course_id) || []);
  const relevantAttendance = attendance.filter((a: any) => enrolledCourseIds.has(a.course_id));
  const totalClasses = relevantAttendance.length;

  if (totalClasses === 0) {
    return {
      current: 0,
      target: targetPercentage,
      status: "on_track",
      classes_attended: 0,
      total_classes: 0,
    };
  }

  const attendedClasses = relevantAttendance.filter(
    (a: any) => a.status === "present" || a.status === "late"
  ).length;

  const currentPercentage = (attendedClasses / totalClasses) * 100;

  let status: "on_track" | "behind" | "achieved";
  if (currentPercentage >= targetPercentage) {
    status = "achieved";
  } else if (currentPercentage >= targetPercentage * 0.7) {
    status = "on_track";
  } else {
    status = "behind";
  }

  return {
    current: Math.round(currentPercentage * 10) / 10,
    target: targetPercentage,
    status,
    classes_attended: attendedClasses,
    total_classes: totalClasses,
  };
}

async function sendNotification(
  supabase: any,
  studentId: string,
  title: string,
  body: string,
  type: string,
  data: any = {}
) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/send-push-notification`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          studentId,
          title,
          body,
          data: { type, ...data },
          icon: "/icons/ttg-icon.svg",
          badge: "/icons/ttg-icon.svg",
          tag: `goal-${type}`,
        }),
      }
    );

    if (!response.ok) {
      console.error(`[Goal Notification] Failed to send notification to ${studentId}:`, await response.text());
    } else {
      console.log(`[Goal Notification] Sent ${type} notification to ${studentId}`);
    }
  } catch (error) {
    console.error(`[Goal Notification] Error sending notification:`, error);
  }
}

async function checkGoalAchievement(supabase: any, studentId: string, goal: AttendanceGoal, progress: GoalProgress) {
  // Check if goal was just achieved (within last 24 hours)
  if (progress.status === "achieved" && progress.current >= progress.target) {
    // Check if we already sent an achievement notification recently (within last 3 days to avoid daily spam)
    const { data: recentNotif } = await supabase
      .from("notifications")
      .select("id")
      .eq("student_id", studentId)
      .eq("notification_type", "goal_achieved")
      .gte("created_at", new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1)
      .single();

    if (!recentNotif) {
      await sendNotification(
        supabase,
        studentId,
        "🎉 Goal Achieved!",
        `Congratulations! You've reached your ${goal.type} attendance goal of ${goal.target_percentage}%!`,
        "goal_achieved",
        {
          goalType: goal.type,
          targetPercentage: goal.target_percentage,
          currentPercentage: progress.current,
        }
      );

      // Record achievement in history
      await supabase
        .from("goal_achievement_history")
        .insert({
          student_id: studentId,
          goal_type: goal.type,
          target_percentage: goal.target_percentage,
          achieved_percentage: progress.current,
          achieved_at: new Date().toISOString(),
        });
    }
  }
}

async function checkBehindGoal(supabase: any, studentId: string, goal: AttendanceGoal, progress: GoalProgress) {
  // Check if student is falling behind (< 70% of target)
  if (progress.status === "behind" && progress.total_classes > 0) {
    // Check if we already sent a behind notification recently (within last 3 days)
    const { data: recentNotif } = await supabase
      .from("notifications")
      .select("id")
      .eq("student_id", studentId)
      .eq("notification_type", "goal_behind")
      .gte("created_at", new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1)
      .single();

    if (!recentNotif) {
      const classesNeeded = Math.ceil((goal.target_percentage / 100) * progress.total_classes) - progress.classes_attended;
      await sendNotification(
        supabase,
        studentId,
        "⚠️ Attendance Goal Alert",
        `You're falling behind on your ${goal.type} goal. Attend ${classesNeeded} more ${classesNeeded === 1 ? 'class' : 'classes'} to get back on track!`,
        "goal_behind",
        {
          goalType: goal.type,
          targetPercentage: goal.target_percentage,
          currentPercentage: progress.current,
          classesNeeded,
        }
      );
    }
  }
}

async function sendWeeklyProgressUpdate(supabase: any, studentId: string, goal: AttendanceGoal, progress: GoalProgress) {
  // Only send for weekly goals or on Sundays for monthly goals
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday

  if (goal.type === "weekly" || (goal.type === "monthly" && dayOfWeek === 0)) {
    // Check if we already sent a weekly update today
    const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    
    // Check for goal_progress notification
    const { data: recentProgress } = await supabase
      .from("notifications")
      .select("id")
      .eq("student_id", studentId)
      .eq("notification_type", "goal_progress")
      .gte("created_at", todayStart)
      .limit(1)
      .single();

    // Also check if we sent a goal_achieved notification today (to avoid double notification)
    const { data: recentAchieved } = await supabase
      .from("notifications")
      .select("id")
      .eq("student_id", studentId)
      .eq("notification_type", "goal_achieved")
      .gte("created_at", todayStart)
      .limit(1)
      .single();

    if (!recentProgress && !recentAchieved && progress.total_classes > 0) {
      let emoji = "📊";
      let message = "";

      if (progress.status === "achieved") {
        emoji = "🎉";
        message = `Amazing! You've achieved ${progress.current}% attendance this ${goal.type === "weekly" ? "week" : "month"}!`;
      } else if (progress.status === "on_track") {
        emoji = "💪";
        message = `You're at ${progress.current}% attendance. Keep it up to reach your ${goal.target_percentage}% goal!`;
      } else {
        emoji = "⚠️";
        message = `You're at ${progress.current}% attendance. Let's work towards your ${goal.target_percentage}% goal!`;
      }

      await sendNotification(
        supabase,
        studentId,
        `${emoji} ${goal.type === "weekly" ? "Weekly" : "Monthly"} Progress Update`,
        message,
        "goal_progress",
        {
          goalType: goal.type,
          targetPercentage: goal.target_percentage,
          currentPercentage: progress.current,
          classesAttended: progress.classes_attended,
          totalClasses: progress.total_classes,
        }
      );
    }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }

  try {
    // Validate authorization (service role only)
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const token = authHeader.split(" ")[1];
    if (token !== SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Fetch all students with attendance goals
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("id, settings, first_name")
      .not("settings->attendance_goal", "is", null);

    if (studentsError) {
      console.error("[Goal Notification Job] Error fetching students:", studentsError);
      throw new Error("Failed to fetch students");
    }

    console.log(`[Goal Notification Job] Processing ${students?.length || 0} students`);

    let notificationsSent = 0;
    let errors = 0;

    for (const student of students || []) {
      try {
        const goal = student.settings?.attendance_goal as AttendanceGoal;
        if (!goal || !goal.type || !goal.target_percentage) {
          continue;
        }

        // Calculate current progress
        const progress = await calculateGoalProgress(
          supabase,
          student.id,
          goal.type,
          goal.target_percentage
        );

        // Check for goal achievement
        await checkGoalAchievement(supabase, student.id, goal, progress);

        // Check if falling behind
        await checkBehindGoal(supabase, student.id, goal, progress);

        // Send weekly progress update (if applicable)
        await sendWeeklyProgressUpdate(supabase, student.id, goal, progress);

        notificationsSent++;
      } catch (error) {
        console.error(`[Goal Notification Job] Error processing student ${student.id}:`, error);
        errors++;
      }
    }

    console.log(`[Goal Notification Job] Complete. Processed: ${notificationsSent}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: notificationsSent,
        errors,
        message: "Goal notification job completed",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  } catch (error) {
    console.error("[Goal Notification Job] Unhandled error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }
});
