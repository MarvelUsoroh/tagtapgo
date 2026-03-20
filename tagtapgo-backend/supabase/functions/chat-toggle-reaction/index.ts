// chat-toggle-reaction (Edge Function)
// Toggles a chat reaction and sends a push notification if added.
// Auth: requires valid Supabase JWT
// @ts-nocheck

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.3";
import { sendChatReactionNotification } from "../_shared/services/notification-sender.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

interface ToggleReactionRequest {
  messageId: string;
  emoji: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const resBody = await req.json();
    const bodyCasted = resBody as ToggleReactionRequest;

    if (!bodyCasted.messageId || !bodyCasted.emoji) {
      return new Response(JSON.stringify({ error: "messageId and emoji are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }
    const userId = userData.user.id;

    // Use service role for fast DB ops
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the user's name for the notification
    const { data: student } = await serviceClient
      .from("students")
      .select("first_name, full_name")
      .eq("id", userId)
      .single();

    // Check if reaction already exists
    const { data: existing } = await serviceClient
      .from("chat_reactions")
      .select("id")
      .eq("message_id", bodyCasted.messageId)
      .eq("user_id", userId)
      .eq("emoji", bodyCasted.emoji)
      .single();

    let action = "removed";

    if (existing) {
      await serviceClient
        .from("chat_reactions")
        .delete()
        .eq("id", existing.id);
    } else {
      await serviceClient
        .from("chat_reactions")
        .insert({
          message_id: bodyCasted.messageId,
          user_id: userId,
          emoji: bodyCasted.emoji,
        });

      action = "added";

      // -------------------------------------------------------------
      // Push Notification Logic
      // -------------------------------------------------------------
      // Get message author
      const { data: message } = await serviceClient
        .from("chat_messages")
        .select("author_id")
        .eq("id", bodyCasted.messageId)
        .single();

      if (message && message.author_id !== userId) {
        sendChatReactionNotification(
          SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY,
          message.author_id,
          student?.full_name || student?.first_name || "Someone",
          bodyCasted.emoji,
          bodyCasted.messageId
        ).catch((err) => console.error("Failed to send reaction notification:", err));
      }
    }

    return new Response(JSON.stringify({ success: true, action }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});