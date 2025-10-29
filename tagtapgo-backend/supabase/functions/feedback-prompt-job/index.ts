// feedback-prompt-job (Edge Function)
// Scheduled job to create feedback prompts 15 minutes after class ends
// Deploy with: supabase functions deploy feedback-prompt-job
// Schedule with pg_cron: SELECT cron.schedule('feedback-prompt-job', '*/5 * * * *', 'SELECT net.http_post(...)')

import { createClient } from "npm:@supabase/supabase-js@2.32.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required environment variables");
}

Deno.serve(async (req: Request) => {
  try {
    // Create service role client (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);

    console.log(`[Feedback Prompt Job] Running at ${now.toISOString()}`);
    console.log(`[Feedback Prompt Job] Looking for classes that ended between ${twentyMinutesAgo.toISOString()} and ${fifteenMinutesAgo.toISOString()}`);

    // Find class schedules that ended 15-20 minutes ago (5-minute window to avoid duplicates)
    const { data: classSchedules, error: scheduleError } = await supabase
      .from("class_schedules")
      .select(`
        id,
        class_id,
        student_id,
        end_time
      `)
      .gte("end_time", twentyMinutesAgo.toISOString())
      .lte("end_time", fifteenMinutesAgo.toISOString());

    if (scheduleError) {
      console.error("[Feedback Prompt Job] Error fetching class schedules:", scheduleError);
      throw scheduleError;
    }

    if (!classSchedules || classSchedules.length === 0) {
      console.log("[Feedback Prompt Job] No classes ended in the target window");
      return new Response(
        JSON.stringify({ message: "No classes to process", processed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[Feedback Prompt Job] Found ${classSchedules.length} classes to process`);

    let promptsCreated = 0;
    let notificationsSent = 0;
    const errors: string[] = [];

    // Process each class schedule
    for (const schedule of classSchedules) {
      try {
        // Resolve class + course details
        const { data: classData, error: classErr } = await supabase
          .from("classes")
          .select("id, name, course_id, course:courses(code)")
          .eq("id", schedule.class_id)
          .single();

        if (classErr || !classData) {
          console.error(`[Feedback Prompt Job] Error fetching class for schedule ${schedule.id}:`, classErr);
          errors.push(`Schedule ${schedule.id}: class fetch failed`);
          continue;
        }

        // Check attendance for THIS student, THIS course, on schedule date
        const endDateStr = new Date(schedule.end_time).toISOString().slice(0, 10);
        const { data: attendanceRows, error: attendanceError } = await supabase
          .from("attendance")
          .select("student_id")
          .eq("student_id", schedule.student_id)
          .eq("course_id", classData.course_id)
          .eq("date", endDateStr)
          .eq("status", "present");

        if (attendanceError) {
          console.error(`[Feedback Prompt Job] Error fetching attendance for schedule ${schedule.id}:`, attendanceError);
          errors.push(`Schedule ${schedule.id}: ${attendanceError.message}`);
          continue;
        }

        if (!attendanceRows || attendanceRows.length === 0) {
          console.log(`[Feedback Prompt Job] No attendance present for schedule ${schedule.id}`);
          continue;
        }

        // Create feedback prompt for this student
        const attendance = { student_id: schedule.student_id } as { student_id: string };
          try {
            // Check if prompt already exists
            const { data: existingPrompt } = await supabase
              .from("feedback_prompts")
              .select("id")
              .eq("student_id", attendance.student_id)
              .eq("class_schedule_id", schedule.id)
              .maybeSingle();

            if (existingPrompt) {
              console.log(`[Feedback Prompt Job] Prompt already exists for student ${attendance.student_id}, schedule ${schedule.id}`);
              continue;
            }

            // Create feedback prompt (expires in 24 hours)
            const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const { data: newPrompt, error: promptError } = await supabase
              .from("feedback_prompts")
              .insert({
                student_id: attendance.student_id,
                class_schedule_id: schedule.id,
                expires_at: expiresAt.toISOString(),
                status: "pending",
              })
              .select()
              .single();

            if (promptError) {
              console.error(`[Feedback Prompt Job] Error creating prompt for student ${attendance.student_id}:`, promptError);
              errors.push(`Student ${attendance.student_id}: ${promptError.message}`);
              continue;
            }

            promptsCreated++;
            console.log(`[Feedback Prompt Job] Created prompt ${newPrompt.id} for student ${attendance.student_id}`);

            // Send push notification (non-blocking)
            try {
              const className = classData?.name ?? "your class";
              const classCode = classData?.course?.code ?? "your class";

              const notificationPayload = {
                studentId: attendance.student_id,
                title: "Share Your Feedback",
                body: `How was ${classCode}? Earn 5-10 points for your feedback!`,
                data: {
                  type: "feedback_prompt",
                  promptId: newPrompt.id,
                  classCode,
                  className,
                  url: `/feedback/${newPrompt.id}`,
                },
                tag: `feedback-${newPrompt.id}`,
                requireInteraction: false,
              };

              // Call send-push-notification function with service role key for internal auth
              const fnUrl = `${SUPABASE_URL}/functions/v1/send-push-notification`;
              const resp = await fetch(fnUrl, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  apikey: SUPABASE_SERVICE_ROLE_KEY,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(notificationPayload),
              });

              if (!resp.ok) {
                const errText = await resp.text();
                console.error(
                  `[Feedback Prompt Job] send-push-notification failed for student ${attendance.student_id}:`,
                  errText
                );
              } else {
                notificationsSent++;
              }
            } catch (notifError) {
              console.error(
                `[Feedback Prompt Job] Error sending notification to student ${attendance.student_id}:`,
                notifError
              );
              // Don't fail the job if notification fails
            }
          } catch (studentError) {
            console.error(`[Feedback Prompt Job] Error processing student ${attendance.student_id}:`, studentError);
            const msg = (studentError as any)?.message ?? String(studentError);
            errors.push(`Student ${attendance.student_id}: ${msg}`);
          }
      } catch (scheduleError) {
        console.error(`[Feedback Prompt Job] Error processing schedule ${schedule.id}:`, scheduleError);
        const msg = (scheduleError as any)?.message ?? String(scheduleError);
        errors.push(`Schedule ${schedule.id}: ${msg}`);
      }
    }

    const result = {
      success: true,
      timestamp: now.toISOString(),
      classesProcessed: classSchedules.length,
      promptsCreated,
      notificationsSent,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log("[Feedback Prompt Job] Completed:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Feedback Prompt Job] Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
