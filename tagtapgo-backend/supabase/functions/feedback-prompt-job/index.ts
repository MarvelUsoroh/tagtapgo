// feedback-prompt-job (Edge Function)
// Scheduled job to create feedback prompts 15 minutes after class ends
// Deploy with: supabase functions deploy feedback-prompt-job
// Schedule with pg_cron: SELECT cron.schedule('feedback-prompt-job', '*/5 * * * *', 'SELECT net.http_post(...)')

import { createClient } from "npm:@supabase/supabase-js@2.32.0";
import { DateTime } from "npm:luxon@3.4.3";

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

    const now = DateTime.utc();
    const fifteenMinutesAgo = now.minus({ minutes: 15 });
    const twentyMinutesAgo = now.minus({ minutes: 20 });

    console.log(`[Feedback Prompt Job] Running at ${now.toISO()}`);
    console.log(`[Feedback Prompt Job] Looking for classes that ended between ${twentyMinutesAgo.toISO()} and ${fifteenMinutesAgo.toISO()}`);

    // Gather possible day names considering cross-timezone execution (±12 hours)
    const candidateDays = Array.from(new Set([
      now.minus({ hours: 12 }).toFormat("EEEE"),
      now.toFormat("EEEE"),
      now.plus({ hours: 12 }).toFormat("EEEE"),
    ]));

    // Find class schedules whose local end time is within the 15-20 minute window
    // Join through courses → universities to capture timezone context
    const { data: classSchedules, error: scheduleError } = await supabase
      .from("class_schedules")
      .select(`
        id,
        course_id,
        day_of_week,
        end_time,
        class_id,
        courses:course_id (
          id,
          code,
          name,
          university_id,
          universities:university_id (
            id,
            timezone
          )
        )
      `)
      .in("day_of_week", candidateDays);

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

    console.log(`[Feedback Prompt Job] Found ${classSchedules.length} classes to process before timezone filtering`);

    let promptsCreated = 0;
    let notificationsSent = 0;
    const errors: string[] = [];

    // Process each class schedule
    for (const schedule of classSchedules) {
      try {
        const timezone = schedule.courses?.universities?.timezone || "UTC";
        const nowInTimezone = now.setZone(timezone);
        const todayName = nowInTimezone.toFormat("EEEE");
        const yesterdayName = nowInTimezone.minus({ days: 1 }).toFormat("EEEE");

        let scheduleDayReference = nowInTimezone.startOf("day");
        if (schedule.day_of_week === todayName) {
          scheduleDayReference = nowInTimezone.startOf("day");
        } else if (schedule.day_of_week === yesterdayName) {
          scheduleDayReference = nowInTimezone.minus({ days: 1 }).startOf("day");
        } else {
          console.log(`[Feedback Prompt Job] Schedule ${schedule.id} day (${schedule.day_of_week}) is not today (${todayName}) or yesterday (${yesterdayName}) in ${timezone}, skipping`);
          continue;
        }

        const [endHour, endMinute, endSecond] = schedule.end_time?.split(":").map(Number) ?? [];
        if (endHour === undefined || endMinute === undefined || endSecond === undefined) {
          console.log(`[Feedback Prompt Job] Schedule ${schedule.id} has invalid end_time (${schedule.end_time}), skipping`);
          continue;
        }

        const scheduleEndLocal = scheduleDayReference.set({
          hour: endHour,
          minute: endMinute,
          second: endSecond,
          millisecond: 0,
        });

        const minutesSinceEnd = nowInTimezone.diff(scheduleEndLocal, "minutes").minutes;
        if (minutesSinceEnd < 15 || minutesSinceEnd > 20) {
          console.log(`[Feedback Prompt Job] Schedule ${schedule.id} in ${timezone} ended ${minutesSinceEnd.toFixed(2)} minutes ago, outside target window`);
          continue;
        }

        // Get all students enrolled in this course
        // Optimization: Query enrollments directly instead of using helper to avoid extra DB roundtrip
        const { data: enrolledStudentsData, error: enrollmentError } = await supabase
          .from('enrollments')
          .select(`
            student_id,
            courses:course_id (
              code,
              name
            )
          `)
          .eq('course_id', schedule.course_id)
          .eq('status', 'active');

        if (enrollmentError) {
          console.error(`[Feedback Prompt Job] Error fetching enrollments for schedule ${schedule.id}:`, enrollmentError);
          errors.push(`Schedule ${schedule.id}: ${enrollmentError.message}`);
          continue;
        }
        
        if (!enrolledStudentsData || enrolledStudentsData.length === 0) {
          console.log(`[Feedback Prompt Job] No enrolled students for schedule ${schedule.id}`);
          continue;
        }

        const enrolledStudents = enrolledStudentsData.map(e => ({
          student_id: e.student_id,
          course_code: (e.courses as any)?.code,
          course_name: (e.courses as any)?.name
        }));

        console.log(`[Feedback Prompt Job] Found ${enrolledStudents.length} enrolled students for schedule ${schedule.id}`);

        // Batch query: Get all attendance records for this course on this date
        const studentIds = enrolledStudents.map(s => s.student_id);
        const { data: attendanceRecords, error: attendanceError } = await supabase
          .from("attendance")
          .select("student_id, metadata")
          .eq("course_id", schedule.course_id)
          .eq("date", scheduleDayReference.toISODate())
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

        // Create a Map for O(1) lookup of students who attended and their metadata
        const attendedStudentMap = new Map(
          attendanceRecords.map((a: { student_id: string; metadata: any }) => [a.student_id, a.metadata])
        );
        console.log(`[Feedback Prompt Job] ${attendedStudentMap.size} students attended for schedule ${schedule.id}`);

        // Optimization: Fetch all existing prompts for this schedule at once
        const { data: existingPrompts, error: existingPromptsError } = await supabase
          .from("feedback_prompts")
          .select("student_id")
          .eq("class_schedule_id", schedule.id)
          .gte("created_at", scheduleDayReference.toISODate());

        if (existingPromptsError) {
           console.error(`[Feedback Prompt Job] Error fetching existing prompts:`, existingPromptsError);
           continue;
        }

        const existingPromptStudentIds = new Set(existingPrompts?.map(p => p.student_id) || []);

        // Create feedback prompts for students who attended
        for (const student of enrolledStudents) {
          const attendanceMetadata = attendedStudentMap.get(student.student_id);
          if (!attendanceMetadata) {
            continue; // Student didn't attend
          }

          if (existingPromptStudentIds.has(student.student_id)) {
             console.log(`[Feedback Prompt Job] Prompt already exists for student ${student.student_id}, schedule ${schedule.id}`);
             continue;
          }

          try {
            // Create feedback prompt (expires in 24 hours)
            const expiresAt = now.plus({ hours: 24 }).toISO();
            
            // Extract session description from attendance metadata for Venus context
            const sessionDescription = attendanceMetadata?.session_description || null;
            const promptMetadata = {
              ...attendanceMetadata,
              topic: sessionDescription || "today's lecture",
              sessionContext: sessionDescription ? {
                lessonTitle: sessionDescription,
              } : null,
            };
            
            const { data: newPrompt, error: promptError } = await supabase
              .from("feedback_prompts")
              .insert({
                student_id: student.student_id,
                class_schedule_id: schedule.id,
                prompt_sent_at: now.toISO(),
                expires_at: expiresAt,
                status: "pending",
                metadata: promptMetadata,
              })
              .select()
              .single();

            if (promptError) {
              // Handle Foreign Key Violation (schedule deleted during processing)
              if (promptError.code === '23503') {
                 console.warn(`[Feedback Prompt Job] Schedule ${schedule.id} no longer exists (FK violation). Skipping prompt for student ${student.student_id}.`);
                 continue;
              }
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
      timestamp: now.toISO(),
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
        timestamp: DateTime.utc().toISO(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
