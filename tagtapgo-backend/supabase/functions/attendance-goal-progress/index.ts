// attendance-goal-progress (Edge Function)
// Calculates student attendance goal progress
// Deploy with: supabase functions deploy attendance-goal-progress

import { createClient } from "npm:@supabase/supabase-js@2.32.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required environment variables");
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type GoalStatus = "on_track" | "behind" | "achieved";

interface GoalProgress {
  current: number;
  target: number;
  status: GoalStatus;
  classes_attended: number;
  total_classes: number;
}

// Simple in-memory cache (5-minute TTL)
const cache = new Map<string, { data: GoalProgress; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(studentId: string, goalType: string): string {
  return `${studentId}:${goalType}`;
}

function getFromCache(key: string): GoalProgress | null {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: GoalProgress): void {
  cache.set(key, {
    data,
    expires: Date.now() + CACHE_TTL_MS,
  });
}

async function calculateGoalProgress(
  supabase: any,
  studentId: string,
  goalType: "weekly" | "monthly",
  targetPercentage: number
): Promise<GoalProgress> {
  // Check cache first
  const cacheKey = getCacheKey(studentId, goalType);
  const cached = getFromCache(cacheKey);
  if (cached) {
    console.log(`[Goal Progress] Cache hit for ${cacheKey}`);
    return cached;
  }

  // Calculate date range
  const now = new Date();
  const daysBack = goalType === "weekly" ? 7 : 30;
  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  
  // Format dates as YYYY-MM-DD for DATE column
  const startDateStr = startDate.toISOString().split('T')[0];
  const nowDateStr = now.toISOString().split('T')[0];

  // Fetch all attendance records in the period for this student
  const { data: attendance, error: attendanceError } = await supabase
    .from("attendance")
    .select("id, status, date, course_id")
    .eq("student_id", studentId)
    .gte("date", startDateStr)
    .lte("date", nowDateStr);

  if (attendanceError) {
    console.error("[Goal Progress] Error fetching attendance:", attendanceError);
    throw new Error("Failed to fetch attendance");
  }

  if (!attendance || attendance.length === 0) {
    // No attendance records in this period
    const result: GoalProgress = {
      current: 0,
      target: targetPercentage,
      status: "on_track",
      classes_attended: 0,
      total_classes: 0,
    };
    setCache(cacheKey, result);
    return result;
  }

  // Get student's enrollments to filter relevant courses
  const { data: enrollments, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("student_id", studentId)
    .eq("status", "active");

  if (enrollmentError) {
    console.error("[Goal Progress] Error fetching enrollments:", enrollmentError);
    throw new Error("Failed to fetch enrollments");
  }

  const enrolledCourseIds = new Set(enrollments?.map((e: any) => e.course_id) || []);

  // Filter attendance to only enrolled courses
  const relevantAttendance = attendance.filter((a: any) => enrolledCourseIds.has(a.course_id));
  const totalClasses = relevantAttendance.length;

  if (totalClasses === 0) {
    // Student not enrolled in any courses with attendance records
    const result: GoalProgress = {
      current: 0,
      target: targetPercentage,
      status: "on_track",
      classes_attended: 0,
      total_classes: 0,
    };
    setCache(cacheKey, result);
    return result;
  }

  // Count attended classes (present or late)
  const attendedClasses = relevantAttendance.filter(
    (a: any) => a.status === "present" || a.status === "late"
  ).length;

  // Calculate current percentage
  const currentPercentage = totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : 0;

  // Determine status
  let status: GoalStatus;
  if (currentPercentage >= targetPercentage) {
    status = "achieved";
  } else if (currentPercentage >= targetPercentage * 0.7) {
    status = "on_track";
  } else {
    status = "behind";
  }

  const result: GoalProgress = {
    current: Math.round(currentPercentage * 10) / 10, // Round to 1 decimal
    target: targetPercentage,
    status,
    classes_attended: attendedClasses,
    total_classes: totalClasses,
  };

  // Cache the result
  setCache(cacheKey, result);

  return result;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const token = authHeader.split(" ")[1];

    // Validate token
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);

    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const authUid = userData.user.id;

    // Use service role client for database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Fetch student's goal settings
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("settings")
      .eq("id", authUid)
      .single();

    if (studentError || !student) {
      console.error("[Goal Progress] Error fetching student:", studentError);
      return new Response(
        JSON.stringify({ error: "Student not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const goal = student.settings?.attendance_goal;
    const goalType = goal?.type || "monthly";
    const targetPercentage = goal?.target_percentage || 90;

    // Calculate progress
    const progress = await calculateGoalProgress(
      supabase,
      authUid,
      goalType,
      targetPercentage
    );

    console.log(`[Goal Progress] Student ${authUid}: ${progress.current}% (${progress.status})`);

    return new Response(
      JSON.stringify(progress),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  } catch (error) {
    console.error("[Goal Progress] Unhandled error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }
});
