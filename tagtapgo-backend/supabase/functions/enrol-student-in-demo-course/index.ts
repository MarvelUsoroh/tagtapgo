// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { AdapterFactory } from "../_shared/adapters/adapter-factory.ts";
import type { MoodleConfig } from "../_shared/adapters/adapter-interface.ts";

const DEMO_UNIVERSITY_DOMAIN = Deno.env.get("DEMO_MOODLE_UNIVERSITY_DOMAIN");
const DEMO_MOODLE_COURSE_ID = Deno.env.get("DEMO_MOODLE_COURSE_ID");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!DEMO_UNIVERSITY_DOMAIN || !DEMO_MOODLE_COURSE_ID) {
  console.warn("enrol-student-in-demo-course: DEMO_MOODLE_UNIVERSITY_DOMAIN or DEMO_MOODLE_COURSE_ID not set; function will return 503");
}

serve(async (req: Request) => {
  try {
    if (!DEMO_UNIVERSITY_DOMAIN || !DEMO_MOODLE_COURSE_ID) {
      return new Response(JSON.stringify({ error: "demo_enrol_disabled" }), { status: 503, headers: { "Content-Type": "application/json" } });
    }

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => null) as { student_id?: string } | null;
    const studentId = body?.student_id;
    if (!studentId) {
      return new Response(JSON.stringify({ error: "missing_student_id" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, email, first_name, last_name, metadata, university_id, external_id")
      .eq("id", studentId)
      .maybeSingle();

    if (studentError) {
      console.error("Failed to load student", studentError);
      return new Response(JSON.stringify({ error: "student_lookup_failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    if (!student) {
      return new Response(JSON.stringify({ error: "student_not_found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    const existingMoodleId = (student.metadata as any)?.moodle_user_id;
    if (existingMoodleId) {
      return new Response(JSON.stringify({ status: "already_linked", moodle_user_id: existingMoodleId }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const { data: university, error: uniError } = await supabase
      .from("universities")
      .select("id, api_config")
      .eq("id", student.university_id)
      .maybeSingle();

    if (uniError || !university) {
      console.error("Failed to load university", uniError);
      return new Response(JSON.stringify({ error: "university_not_found" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const apiConfig = university.api_config as any;
    if (!apiConfig || apiConfig.type !== "moodle") {
      return new Response(JSON.stringify({ error: "university_not_moodle" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const moodleConfig: MoodleConfig = {
      type: "moodle",
      baseUrl: apiConfig.baseUrl,
      token: apiConfig.token,
      timezone: apiConfig.timezone || "UTC",
      universityId: university.id,
    };

    const adapter = AdapterFactory.create(moodleConfig);

    // @ts-ignore enrolment helper will be specific to Moodle adapter implementation
    if (typeof (adapter as any).enrolStudentInCourse !== "function") {
      console.error("Adapter does not implement enrolStudentInCourse");
      return new Response(JSON.stringify({ error: "enrol_not_supported" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const fullName = (student.first_name && student.last_name)
      ? `${student.first_name} ${student.last_name}`
      : student.first_name || student.last_name || student.email || student.external_id;

    const result = await (adapter as any).enrolStudentInCourse({
      courseId: Number(DEMO_MOODLE_COURSE_ID),
      email: student.email,
      fullName,
      externalId: student.external_id,
    });

    const moodleUserId = result?.moodle_user_id ?? result?.userId ?? result?.id;

    if (!moodleUserId) {
      console.error("Moodle enrolment did not return user id", result);
      return new Response(JSON.stringify({ error: "moodle_enrol_failed" }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    const { error: updateError } = await supabase
      .from("students")
      .update({ metadata: { ...(student.metadata || {}), moodle_user_id: moodleUserId, moodle_demo_course_id: Number(DEMO_MOODLE_COURSE_ID) } })
      .eq("id", student.id);

    if (updateError) {
      console.error("Failed to update student metadata", updateError);
    }

    return new Response(JSON.stringify({ status: "enrolled", moodle_user_id: moodleUserId }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Unexpected error in enrol-student-in-demo-course", error);
    return new Response(JSON.stringify({ error: "unexpected_error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
