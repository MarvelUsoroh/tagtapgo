// feedback-expiry-job (Edge Function)
// Scheduled job to expire pending feedback prompts after 24 hours
// Deploy with: supabase functions deploy feedback-expiry-job
// Schedule with pg_cron: SELECT cron.schedule('feedback-expiry-job', '0 * * * *', 'SELECT net.http_post(...)')

import { createClient } from "npm:@supabase/supabase-js@2.32.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required environment variables");
}

Deno.serve(async (req) => {
  try {
    // Create service role client (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const now = new Date();
    console.log(`[Feedback Expiry Job] Running at ${now.toISOString()}`);

    // Find all pending prompts that have expired
    const { data: expiredPrompts, error: fetchError } = await supabase
      .from("feedback_prompts")
      .select("id, student_id, class_schedule_id")
      .eq("status", "pending")
      .lt("expires_at", now.toISOString());

    if (fetchError) {
      console.error("[Feedback Expiry Job] Error fetching expired prompts:", fetchError);
      throw fetchError;
    }

    if (!expiredPrompts || expiredPrompts.length === 0) {
      console.log("[Feedback Expiry Job] No expired prompts found");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No expired prompts to process",
          expired: 0,
          timestamp: now.toISOString(),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[Feedback Expiry Job] Found ${expiredPrompts.length} expired prompts`);

    // Update all expired prompts to 'expired' status
    const { data: updatedPrompts, error: updateError } = await supabase
      .from("feedback_prompts")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("expires_at", now.toISOString())
      .select();

    if (updateError) {
      console.error("[Feedback Expiry Job] Error updating expired prompts:", updateError);
      throw updateError;
    }

    const expiredCount = updatedPrompts?.length || 0;
    console.log(`[Feedback Expiry Job] Successfully expired ${expiredCount} prompts`);

    // Log details for monitoring
    const promptIds = updatedPrompts?.map((p) => p.id) || [];
    console.log(`[Feedback Expiry Job] Expired prompt IDs:`, promptIds);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Expired ${expiredCount} feedback prompts`,
        expired: expiredCount,
        timestamp: now.toISOString(),
        promptIds,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[Feedback Expiry Job] Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
