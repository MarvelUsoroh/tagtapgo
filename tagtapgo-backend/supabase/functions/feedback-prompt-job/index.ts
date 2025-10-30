// feedback-prompt-job (Edge Function)
// Scheduled job to create feedback prompts 15 minutes after class ends
// Deploy with: supabase functions deploy feedback-prompt-job
// Schedule with pg_cron: SELECT cron.schedule('feedback-prompt-job', '*/5 * * * *', 'SELECT net.http_post(...)')

import { createClient } from "npm:@supabase/supabase-js@2.32.0";
import { getStudentsForClassSchedule } from "../_shared/services/schedule-query-helpers.ts";

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
    // Note: class_schedules is a course template, not student-specific
    // We need to find which students are enrolled in these courses
    const { data: classSchedules, error: scheduleError } = await supabase
      .from("class_schedules")
      .select(`
        id,
        course_id,
        day_of_week,
        end_time,
        class_id
      `)
      .gte("end_time", twentyMinutesAgo.toISOString().split('T')[1].substring(0, 8))
      .lte("end_time", fifteenMinutesAgo.toISOString().split('T')[1].substring(0, 8));

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
        // Calculate the date this schedule occurred (based on day_of_week and current time)
        // Since we're looking at classes that ended 15-20 min ago, use current date
        const scheduleDate = now.toISOString().split('T')[0];
        
        // Check if today matches the schedule's day_of_week
        const todayDayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
        if (schedule.day_of_week !== todayDayOfWeek) {
          console.log(`[Feedback Prompt Job] Schedule ${schedule.id} day (${schedule.day_of_week}) doesn't match today (${todayDayOfWeek}), skipping`);
          continue;
        }

        // Get all students enrolled in this course
        const enrolledStudents = await getStudentsForClassSchedule(supabase, schedule.id);
        
        if (enrolledStudents.length === 0) {
          console.log(`[Feedback Prompt Job] No enrolled students for schedule ${schedule.id}`);
          continue;
        }

        console.log(`[Feedback Prompt Job] Found ${enrolledStudents.length} enrolled students for schedule ${schedule.id}`);

        // Batch query: Get all attendance records for this course on this date
        const studentIds = enrolledStudents.map(s => s.student_id);
        const { data: attendanceRecords, error: attendanceError } = await supabase
          .from("attendance")
          .select("student_id")
          .eq("course_id", schedule.course_id)
          .eq("date", scheduleDate)
          .in("status", ["present", "late", "excused"])
          .in("student_id", studentIds);

        if (attendanceError) {
          console.error(`[Feedback Prompt Job] Error fetching attendance for schedule ${schedule.id}:`, attendanceError);
          errors.push(`Schedule ${schedule.id}: ${attendanceError.message}`);
          continue;
        }

        if (!attendanceRecords || attendanceRecords.length === 0) {
          console.log(`[Feedback Prompt Job] No attendance records for schedule ${schedule.id}`);
          continue;
        }

        // Create a Set for O(1) lookup of students who attended
        const attendedStudentIds = new Set(attendanceRecords.map(a => a.student_id));
        console.log(`[Feedback Prompt Job] ${attendedStudentIds.size} students attended for schedule ${schedule.id}`);

        // Create feedback prompts for students who attended
        for (const student of enrolledStudents) {
          if (!attendedStudentIds.has(student.student_id)) {
            continue; // Student didn't attend
          }

          try {
            // Check if prompt already exists
            const { data: existingPrompt } = await supabase
              .from("feedback_prompts")
              .select("id")
              .eq("student_id", student.student_id)
              .eq("class_schedule_id", schedule.id)
              .maybeSingle();

            if (existingPrompt) {
              console.log(`[Feedback Prompt Job] Prompt already exists for student ${student.student_id}, schedule ${schedule.id}`);
              continue;
            }

            // Create feedback prompt (expires in 24 hours)
            const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const { data: newPrompt, error: promptError } = await supabase
              .from("feedback_prompts")
              .insert({
                student_id: student.student_id,
                class_schedule_id: schedule.id,
                expires_at: expiresAt.toISOString(),
                status: "pending",
              })
              .select()
              .single();

            if (promptError) {
              console.error(`[Feedback Prompt Job] Error creating prompt for student ${student.student_id}:`, promptError);
              errors.push(`Student ${student.student_id}: ${promptError.message}`);
              continue;
            }

            promptsCreated++;
            console.log(`[Feedback Prompt Job] Created prompt ${newPrompt.id} for student ${student.student_id}`);

            // Send push notification (non-blocking)
            try {
              const classCode = student.course_code;
              const className = student.course_name;

              const notificationPayload = {
                studentId: student.student_id,
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
                  `[Feedback Prompt Job] send-push-notification failed for student ${student.student_id}:`,
                  errText
                );
              } else {
                notificationsSent++;
              }
            } catch (notifError) {
              console.error(
                `[Feedback Prompt Job] Error sending notification to student ${student.student_id}:`,
                notifError
              );
              // Don't fail the job if notification fails
            }
          } catch (studentError) {
            console.error(`[Feedback Prompt Job] Error processing student ${student.student_id}:`, studentError);
            const msg = (studentError as any)?.message ?? String(studentError);
            errors.push(`Student ${student.student_id}: ${msg}`);
          }
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
