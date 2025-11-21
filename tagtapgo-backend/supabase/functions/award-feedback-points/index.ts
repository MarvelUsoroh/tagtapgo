// award-feedback-points (Edge Function)
// Awards points for completing a Venus AI chat session
// Deploy with: supabase functions deploy award-feedback-points

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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    // Parse request body
    const body = await req.json();
    const { conversation_id } = body;

    if (!conversation_id) {
      return new Response(
        JSON.stringify({ error: "Missing conversation_id" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Use service role client for database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 1. Fetch conversation details
    const { data: conversation, error: convError } = await supabase
      .from("feedback_conversations")
      .select("id, student_id, class_schedule_id, points_awarded")
      .eq("id", conversation_id)
      .single();

    if (convError || !conversation) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Verify ownership
    if (conversation.student_id !== authUid) {
      return new Response(
        JSON.stringify({ error: "Not authorized for this conversation" }),
        { status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // 2. Check if points already awarded
    if (conversation.points_awarded > 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          points_earned: conversation.points_awarded,
          message: "Points already awarded for this conversation." 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // 3. Award Points (Transaction)
    const POINTS_TO_AWARD = 15; // Standard reward for Venus chat

    // Insert into points ledger
    const { error: pointsError } = await supabase
      .from("points")
      .insert({
        student_id: conversation.student_id,
        points: POINTS_TO_AWARD,
        transaction_type: "feedback_reward",
        reference_id: conversation.id,
        description: "Venus AI Conversation Reward",
        metadata: {
          class_schedule_id: conversation.class_schedule_id,
          conversation_id: conversation.id,
        },
      });

    if (pointsError) {
      console.error("[Award Points] Error inserting points:", pointsError);
      return new Response(
        JSON.stringify({ error: "Failed to award points" }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // 4. Update conversation status
    const { error: updateError } = await supabase
      .from("feedback_conversations")
      .update({
        points_awarded: POINTS_TO_AWARD,
        completed_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);

    if (updateError) {
      console.error("[Award Points] Error updating conversation:", updateError);
      // Non-fatal, points already awarded
    }

    // 5. Update feedback prompt status (to close the loop)
    // Find the prompt associated with this schedule and student
    const { error: promptError } = await supabase
      .from("feedback_prompts")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("class_schedule_id", conversation.class_schedule_id)
      .eq("student_id", conversation.student_id);

    if (promptError) {
      console.error("[Award Points] Error updating prompt:", promptError);
    }

    // 6. Check for "Voice Heard" Achievement (5 feedback submissions)
    try {
      // Count feedback submissions
      const { count, error: countError } = await supabase
        .from("points")
        .select("*", { count: "exact", head: true })
        .eq("student_id", conversation.student_id)
        .eq("transaction_type", "feedback_reward");

      if (!countError && count && count >= 5) {
        // Check if achievement already unlocked
        const { data: achievement } = await supabase
          .from("achievements")
          .select("id")
          .eq("slug", "voice-heard") // Assuming slug or name
          .single();

        if (achievement) {
          const { error: achievementError } = await supabase
            .from("student_achievements")
            .insert({
              student_id: conversation.student_id,
              achievement_id: achievement.id,
              unlocked: true,
              unlocked_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (!achievementError) {
            console.log("[Award Points] 'Voice Heard' achievement unlocked!");
            // Optionally award bonus points for achievement here or let a trigger do it
          }
        }
      }
    } catch (achError) {
      console.error("[Award Points] Error checking achievement:", achError);
      // Non-fatal
    }

    return new Response(
      JSON.stringify({
        success: true,
        points_earned: POINTS_TO_AWARD,
        message: `You earned ${POINTS_TO_AWARD} points!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

  } catch (error) {
    console.error("[Award Points] Unhandled error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }
});
