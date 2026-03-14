// chat-send-message (Edge Function)
// Creates chat messages with #course-tag parsing and @mention extraction
// Auth: requires valid Supabase JWT
// @ts-nocheck

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

interface SendMessageRequest {
  id?: string; // Client-provided UUID for optimistic UI deduplication
  content: string;
  courseId?: string | null;  // Optional: target specific course
  parentId?: string | null;  // Optional: reply to thread
  attachments?: { url: string; type: string; name: string; size: number }[];
}

interface MentionMatch {
  userId: string;
  username: string;
}

// Parse @mentions from content - matches @username or @"Full Name"
function extractMentions(content: string): string[] {
  const mentions: string[] = [];
  // Match @username (alphanumeric + underscore) or @"Full Name" 
  const mentionRegex = /@(\w+)|@"([^"]+)"/g;
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    const name = match[1] || match[2];
    if (name) mentions.push(name.toLowerCase());
  }
  return [...new Set(mentions)]; // Dedupe
}

Deno.serve(async (req) => {
  // Preflight
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
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization bearer token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const token = authHeader.split(" ")[1];

    // Create user client to get auth context
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const userId = userData.user.id;

    // Parse body
    const body: SendMessageRequest = await req.json();
    if (!body.content?.trim()) {
      return new Response(
        JSON.stringify({ error: "Content is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Service role client for DB operations
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get student info
    const { data: student, error: studentError } = await serviceClient
      .from("students")
      .select("id, university_id, first_name, last_name, full_name")
      .eq("id", userId)
      .single();

    if (studentError || !student) {
      return new Response(
        JSON.stringify({ error: "Student profile not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Validate course enrollment if courseId provided
    if (body.courseId) {
      const { data: enrollment, error: enrollError } = await serviceClient
        .from("enrollments")
        .select("id")
        .eq("student_id", userId)
        .eq("course_id", body.courseId)
        .eq("status", "active")
        .single();

      if (enrollError || !enrollment) {
        return new Response(
          JSON.stringify({ error: "Not enrolled in this course" }),
          { status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }
    }

    // Validate parent message exists and is in same university
    if (body.parentId) {
      const { data: parent, error: parentError } = await serviceClient
        .from("chat_messages")
        .select("id, university_id, course_id")
        .eq("id", body.parentId)
        .eq("university_id", student.university_id)
        .is("deleted_at", null)
        .single();

      if (parentError || !parent) {
        return new Response(
          JSON.stringify({ error: "Parent message not found" }),
          { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }

      // Thread replies inherit parent's course scope
      if (parent.course_id && !body.courseId) {
        body.courseId = parent.course_id;
      }
    }

    // Create the message
    const { data: message, error: insertError } = await serviceClient
      .from("chat_messages")
      .insert({
        id: body.id || undefined, // Use client-provided UUID if present
        university_id: student.university_id,
        author_id: userId,
        content: body.content.trim(),
        course_id: body.courseId || null,
        parent_id: body.parentId || null,
        attachments: body.attachments || [],
      })
      .select(`
        id,
        university_id,
        author_id,
        content,
        course_id,
        parent_id,
        attachments,
        created_at
      `)
      .single();

    if (insertError) {
      console.error("Failed to insert message:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create message" }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Extract @mentions and create mention records
    const mentionNames = extractMentions(body.content);
    if (mentionNames.length > 0) {
      let query;
      if (body.courseId) {
        query = serviceClient
          .from("students")
          .select("id, username, first_name, full_name, enrollments!inner(course_id, status)")
          .eq("university_id", student.university_id)
          .eq("enrollments.course_id", body.courseId)
          .eq("enrollments.status", "active");
      } else {
        query = serviceClient
          .from("students")
          .select("id, username, first_name, full_name")
          .eq("university_id", student.university_id);
      }

      // Look up mentioned users by username, first_name, or full_name
      const { data: mentionedUsers, error: mentionsError } = await query
        .or(
          mentionNames.map(name => 
            `username.ilike.${name},first_name.ilike.${name},full_name.ilike.%${name}%`
          ).join(",")
        );

      if (mentionsError) {
        console.error("Failed to fetch mentioned users:", mentionsError);
      }

      if (mentionedUsers && mentionedUsers.length > 0) {
        // Filter to only users that actually match
        const matchedUsers = mentionedUsers.filter(u => {
          const lowerNames = mentionNames.map(n => n.toLowerCase());
          return lowerNames.some(n => 
            u.username?.toLowerCase() === n ||
            u.first_name?.toLowerCase() === n ||
            u.full_name?.toLowerCase().includes(n)
          );
        });

        // Don't mention yourself
        const mentionsToCreate = matchedUsers
          .filter(u => u.id !== userId)
          .map(u => ({
            message_id: message.id,
            mentioned_user_id: u.id,
          }));

        if (mentionsToCreate.length > 0) {
          await serviceClient
            .from("chat_mentions")
            .insert(mentionsToCreate);
        }
      }
    }

    // Return created message with author info
    return new Response(
      JSON.stringify({
        success: true,
        message: {
          ...message,
          author: {
            id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
            full_name: student.full_name,
          },
        },
      }),
      { status: 201, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }
});
