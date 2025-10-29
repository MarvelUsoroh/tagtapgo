// submit-feedback (Edge Function)
// Handles student feedback submission and awards points
// Deploy with: supabase functions deploy submit-feedback

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
    const {
      student_id,
      class_id,
      class_schedule_id,
      prompt_id,
      content_quality,
      clarity,
      pace,
      comment,
      is_anonymous,
    } = body;

    // Validate required fields
    if (!student_id || !class_id || !class_schedule_id || !prompt_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Validate ratings (1-5)
    if (
      !content_quality || !clarity || !pace ||
      content_quality < 1 || content_quality > 5 ||
      clarity < 1 || clarity > 5 ||
      pace < 1 || pace > 5
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid ratings. Must be between 1 and 5" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Verify student_id matches authenticated user
    if (authUid !== student_id) {
      return new Response(
        JSON.stringify({ error: "Not authorized to submit feedback for this student" }),
        { status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Use service role client for database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Check if feedback already submitted
    const { data: existingFeedback } = await supabase
      .from("class_feedback")
      .select("id")
      .eq("student_id", student_id)
      .eq("class_schedule_id", class_schedule_id)
      .single();

    if (existingFeedback) {
      return new Response(
        JSON.stringify({ error: "Feedback already submitted for this class" }),
        { status: 409, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Insert feedback
    const { data: feedback, error: feedbackError } = await supabase
      .from("class_feedback")
      .insert({
        student_id,
        class_id,
        class_schedule_id,
        content_quality,
        clarity,
        pace,
        comment: comment || null,
        is_anonymous: is_anonymous !== false, // Default to true
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (feedbackError) {
      console.error("[Submit Feedback] Error inserting feedback:", feedbackError);
      return new Response(
        JSON.stringify({ error: "Failed to submit feedback" }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Calculate points (5 for ratings, +5 for comment)
    const hasComment = comment && comment.trim().length > 0;
    const pointsEarned = hasComment ? 10 : 5;

    // Award points
    const { error: pointsError } = await supabase
      .from("points")
      .insert({
        student_id,
        points: pointsEarned,
        transaction_type: "feedback",
        reference_id: feedback.id,
        description: hasComment
          ? "Feedback with comment"
          : "Feedback ratings",
        metadata: {
          class_id,
          class_schedule_id,
          feedback_id: feedback.id,
        },
      });

    if (pointsError) {
      console.error("[Submit Feedback] Error awarding points:", pointsError);
      // Don't fail the request if points fail - feedback is already saved
    }

    // Update feedback prompt status
    const { error: promptError } = await supabase
      .from("feedback_prompts")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", prompt_id)
      .eq("student_id", student_id);

    if (promptError) {
      console.error("[Submit Feedback] Error updating prompt:", promptError);
      // Don't fail the request if prompt update fails
    }

    console.log(`[Submit Feedback] Student ${student_id} submitted feedback for schedule ${class_schedule_id}, earned ${pointsEarned} points`);

    return new Response(
      JSON.stringify({
        success: true,
        feedback_id: feedback.id,
        points_earned: pointsEarned,
        message: hasComment
          ? "Thank you for your detailed feedback! You earned 10 points."
          : "Thank you for your feedback! You earned 5 points.",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  } catch (error) {
    console.error("[Submit Feedback] Unhandled error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }
});
