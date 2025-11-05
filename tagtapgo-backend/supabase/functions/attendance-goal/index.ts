// attendance-goal (Edge Function)
// Handles student attendance goal management (GET and POST)
// Deploy with: supabase functions deploy attendance-goal

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
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface AttendanceGoal {
  type: "weekly" | "monthly";
  target_percentage: number;
  created_at: string;
  updated_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== "GET" && req.method !== "POST") {
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

    // GET: Fetch current goal
    if (req.method === "GET") {
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("settings")
        .eq("id", authUid)
        .single();

      if (studentError || !student) {
        console.error("[Attendance Goal] Error fetching student:", studentError);
        return new Response(
          JSON.stringify({ error: "Student not found" }),
          { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }

      const goal = student.settings?.attendance_goal as AttendanceGoal | undefined;

      if (!goal) {
        // Return default goal if not set
        return new Response(
          JSON.stringify({
            type: "monthly",
            target_percentage: 90,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...CORS_HEADERS },
          }
        );
      }

      return new Response(
        JSON.stringify(goal),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        }
      );
    }

    // POST: Update goal
    if (req.method === "POST") {
      const body = await req.json();
      const { type, target_percentage } = body;

      // Validate goal type
      if (!type || (type !== "weekly" && type !== "monthly")) {
        return new Response(
          JSON.stringify({ error: "Invalid goal type. Must be 'weekly' or 'monthly'" }),
          { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }

      // Validate target percentage
      if (
        typeof target_percentage !== "number" ||
        target_percentage < 50 ||
        target_percentage > 100
      ) {
        return new Response(
          JSON.stringify({ error: "Invalid target percentage. Must be between 50 and 100" }),
          { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }

      // Fetch current settings
      const { data: student, error: fetchError } = await supabase
        .from("students")
        .select("settings")
        .eq("id", authUid)
        .single();

      if (fetchError || !student) {
        console.error("[Attendance Goal] Error fetching student:", fetchError);
        return new Response(
          JSON.stringify({ error: "Student not found" }),
          { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }

      const currentSettings = student.settings || {};
      const currentGoal = currentSettings.attendance_goal as AttendanceGoal | undefined;

      // Build updated goal
      const updatedGoal: AttendanceGoal = {
        type,
        target_percentage,
        created_at: currentGoal?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Update settings
      const updatedSettings = {
        ...currentSettings,
        attendance_goal: updatedGoal,
      };

      const { error: updateError } = await supabase
        .from("students")
        .update({ settings: updatedSettings })
        .eq("id", authUid);

      if (updateError) {
        console.error("[Attendance Goal] Error updating goal:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update goal" }),
          { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }

      console.log(`[Attendance Goal] Student ${authUid} updated goal to ${type} ${target_percentage}%`);

      return new Response(
        JSON.stringify({
          success: true,
          goal: updatedGoal,
          message: "Goal updated successfully",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        }
      );
    }
  } catch (error) {
    console.error("[Attendance Goal] Unhandled error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }
});
