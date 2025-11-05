// send-push-notification (Edge Function)
// Auth model: requires a valid Supabase user JWT in Authorization: Bearer <token>
// Deploy with: supabase functions deploy send-push-notification
// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2.32.0";
// Environment variables (set these in Supabase Dashboard -> Functions -> Environment)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT =
  Deno.env.get("VAPID_SUBJECT") || "mailto:support@tagtapgo.com";
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment");
}
// CORS headers
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};
Deno.serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: {
        ...CORS_HEADERS,
      },
    });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Method not allowed",
      }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          ...CORS_HEADERS,
        },
      }
    );
  }
  try {
    // Authorization header and token validation
    const authHeader =
      req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          error: "Missing Authorization bearer token",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS,
          },
        }
      );
    }
  const token = authHeader.split(" ")[1];

    // Determine caller context: user token vs internal (service role)
    let isInternal = false;
    let authUid: string | null = null;

    if (token === SUPABASE_SERVICE_ROLE_KEY && SUPABASE_SERVICE_ROLE_KEY) {
      isInternal = true;
    } else {
      // Create a Supabase client with anon key to validate the token via auth.getUser
      const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          persistSession: false,
        },
      });

      // Validate token and get user
      const { data: userData, error: userError } =
        await supabaseAuth.auth.getUser(token);

      if (userError || !userData?.user) {
        console.error("Invalid user token", userError);
        return new Response(
          JSON.stringify({
            error: "Invalid or expired token",
          }),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              ...CORS_HEADERS,
            },
          }
        );
      }
      authUid = userData.user.id;
    }
    // Parse body
    const bodyJson = await req.json().catch(() => null);
    if (!bodyJson) {
      return new Response(
        JSON.stringify({
          error: "Invalid JSON body",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS,
          },
        }
      );
    }
    const payload = bodyJson;
    const {
      studentId,
      title,
      body: messageBody,
      data,
      icon,
      badge,
      tag,
      requireInteraction,
    } = payload;
    if (!studentId || !title || !messageBody) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: studentId, title, body",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS,
          },
        }
      );
    }
    // Authorization: allow internal calls to send to any student; users can only send to themselves
    if (!isInternal && authUid !== studentId) {
      console.warn("User not authorized to send to target student", {
        authUid: authUid ?? 'internal',
        studentId,
      });
      return new Response(
        JSON.stringify({
          error: "Not authorized to send to this student",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS,
          },
        }
      );
    }
    // Use service role client for DB operations to bypass RLS (we already validated authUid)
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({
          error: "Server misconfiguration",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS,
          },
        }
      );
    }
    const supabaseService = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
        },
      }
    );
    // Resolve preferences BEFORE deciding in-app (DB) vs push delivery
    const notifType = data?.type ?? "other";

    // Read user notification preferences
    const { data: studentRow } = await supabaseService
      .from("students")
      .select("settings")
      .eq("id", studentId)
      .single();

    const rawPrefs = studentRow?.settings?.notifications ?? {};
    // Back-compat: boolean means both in-app and push; object allows split { inApp, push }
    const prefValue = rawPrefs?.[notifType];
    const inAppEnabled = typeof prefValue === 'object'
      ? prefValue?.inApp !== false
      : prefValue !== false; // default true
    const pushEnabled = typeof prefValue === 'object'
      ? prefValue?.push !== false
      : prefValue !== false; // default true

    if (!inAppEnabled && !pushEnabled) {
      console.log(`Notification ${notifType} disabled for ${studentId} (in-app and push)`);
      return new Response(
        JSON.stringify({
          message: "Notification disabled by user preferences",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS,
          },
        }
      );
    }
    
    // For achievement notifications, check if one already exists to avoid duplicates
    if (notifType === 'achievement' && data?.achievementName) {
      const { data: existing } = await supabaseService
        .from("notifications")
        .select('id')
        .eq('student_id', studentId)
        .eq('notification_type', 'achievement')
        .eq('data->>achievementName', data.achievementName)
        .gte('created_at', new Date(Date.now() - 60000).toISOString()) // Within last minute
        .limit(1)
        .single();
      
      if (existing) {
        console.log('Notification already exists, skipping duplicate');
        return new Response(
          JSON.stringify({
            success: true,
            message: "Notification already exists",
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...CORS_HEADERS,
            },
          }
        );
      }
    }
    
    // Create notification record (in-app) only if enabled
    let notificationRecord: any = null;
    if (inAppEnabled) {
      const { data: created, error: notifError } = await supabaseService
        .from("notifications")
        .insert({
          student_id: studentId,
          notification_type: notifType,
          title,
          message: messageBody,
          data: data || {},
          read: false,
        })
        .select()
        .single();
      if (notifError) {
        console.error("Failed to create notification record:", notifError);
      } else {
        notificationRecord = created;
        console.log(`Created notification record ${notificationRecord.id} for student ${studentId}`);
      }
    }
    
    // Fetch subscription
    if (!pushEnabled) {
      // If push disabled, return success if we stored in-app, otherwise just acknowledge
      return new Response(
        JSON.stringify({
          success: true,
          message: inAppEnabled ? "Notification saved (push disabled)" : "Notification disabled (push off, no in-app)",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS,
          },
        }
      );
    }

    const { data: subscriptionRow, error: subError } = await supabaseService
      .from("push_subscriptions")
      .select("subscription")
      .eq("student_id", studentId)
      .single();
    if (subError || !subscriptionRow) {
      console.log("No subscription for student:", studentId, "- notification saved but push not sent");
      // Return success since we saved the notification
      return new Response(
        JSON.stringify({
          success: true,
          message: "Notification saved (no push subscription)",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS,
          },
        }
      );
    }
    const subscription = subscriptionRow.subscription;
    if (
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      console.error("Invalid subscription shape for student:", studentId);
      return new Response(
        JSON.stringify({
          error: "Invalid push subscription data",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS,
          },
        }
      );
    }
    // Preference check already handled above
    // Prepare payload
    const notificationPayload = {
      title,
      body: messageBody,
      icon: icon || "/icons/ttg-icon.svg",
      badge: badge || "/icons/ttg-icon.svg",
      data: data || {},
      tag: tag || "default",
      requireInteraction: !!requireInteraction,
    };
    // Send notification (Deno-native web_push)
    try {
      await sendWebPush(subscription, notificationPayload);
      console.log(`Successfully sent push notification to student ${studentId}`);
    } catch (err) {
      console.error("web-push send error:", err);
      const statusCode = err?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        const cleanup = async () => {
          await supabaseService
            .from("push_subscriptions")
            .delete()
            .eq("student_id", studentId);
          console.log("Deleted invalid subscription for", studentId);
        };
        try {
          EdgeRuntime.waitUntil(cleanup());
        } catch {
          cleanup();
        }
      }
      // Don't return error - notification was already saved to database
      console.log("Push failed but notification was saved to database");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Notification saved (push delivery failed)",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS,
          },
        }
      );
    }
    return new Response(
      JSON.stringify({
        success: true,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...CORS_HEADERS,
        },
      }
    );
  } catch (e) {
    console.error("Unhandled error in function:", e);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...CORS_HEADERS,
        },
      }
    );
  }
});
async function sendWebPush(subscription, payload) {
  if (
    !subscription?.endpoint ||
    !subscription?.keys?.p256dh ||
    !subscription?.keys?.auth
  ) {
    throw new Error("Invalid subscription payload");
  }
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error("Missing VAPID keys");
  }

  // Use npm:web-push instead of the broken deno.land module
  const webPush = await import("npm:web-push@3.6.7");
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  await webPush.sendNotification(subscription, JSON.stringify(payload));
}
