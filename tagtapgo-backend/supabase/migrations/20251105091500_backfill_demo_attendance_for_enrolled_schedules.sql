-- Backfill demo attendance from class schedules (today + historical occurrences)
--
-- Scope:
--   - Seeds attendance rows for the DEMO student across all enrolled class_schedules
--     from each schedule's effective_from through today (inclusive), matching day_of_week.
--   - Inserts only when an attendance row for (student_id, course_id, date) does not
--     already exist. This ignores session_id to avoid duplicate daily rows.
--   - Marks rows as source='manual' and adds metadata.seeded_by_migration for traceability.
--
-- Notes:
--   - This is idempotent and safe to re-run; it will no-op when rows already exist.
--   - Adjust the DEMO_STUDENT_ID below if your demo user ID differs in your environment.

DO $$
DECLARE
  v_demo_student_id UUID := 'ab191d6e-e016-418b-80a1-0b2b25e007c7';
BEGIN
  -- Verify the demo student exists; if not, skip gracefully
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = v_demo_student_id) THEN
    RAISE NOTICE 'Demo student % not found; skipping attendance backfill', v_demo_student_id;
    RETURN;
  END IF;

  WITH demo_student AS (
    SELECT id AS student_id, university_id
    FROM public.students
    WHERE id = v_demo_student_id
  ),
  demo_enrollments AS (
    SELECT e.course_id
    FROM public.enrollments e
    JOIN demo_student ds ON ds.student_id = e.student_id
  ),
  enrolled_schedules AS (
    SELECT cs.*
    FROM public.class_schedules cs
    JOIN demo_enrollments de ON de.course_id = cs.course_id
  ),
  schedule_with_daynum AS (
    SELECT
      es.*, 
      CASE es.day_of_week
        WHEN 'Sunday' THEN 0
        WHEN 'Monday' THEN 1
        WHEN 'Tuesday' THEN 2
        WHEN 'Wednesday' THEN 3
        WHEN 'Thursday' THEN 4
        WHEN 'Friday' THEN 5
        WHEN 'Saturday' THEN 6
        ELSE NULL
      END AS day_num
    FROM enrolled_schedules es
  ),
  calendar AS (
    -- Build one row per schedule occurrence date from effective_from to today
    SELECT 
      swd.id AS class_schedule_id,
      swd.university_id,
      swd.course_id,
      swd.class_id,
      swd.period,
      swd.start_time,
      swd.end_time,
      swd.day_of_week,
      d::date AS att_date
    FROM schedule_with_daynum swd
    CROSS JOIN LATERAL generate_series(swd.effective_from, LEAST(swd.effective_to, CURRENT_DATE), interval '1 day') AS d
    WHERE swd.day_num IS NOT NULL
      AND EXTRACT(DOW FROM d) = swd.day_num
  ),
  to_insert AS (
    SELECT 
      ds.university_id,
      ds.student_id,
      c.course_id,
      c.class_id,
      c.period,
      c.att_date,
      c.start_time,
      c.end_time
    FROM calendar c
    CROSS JOIN demo_student ds
    WHERE NOT EXISTS (
      SELECT 1 FROM public.attendance a
      WHERE a.student_id = ds.student_id
        AND a.course_id = c.course_id
        AND a.date = c.att_date
    )
  )
  INSERT INTO public.attendance (
    university_id,
    student_id,
    course_id,
    class_id,
    session_id,
    period,
    date,
    status,
    status_code,
    source,
    recorded_at,
    check_in_time,
    scheduled_time,
    source_tz,
    time,
    metadata
  )
  SELECT 
    ti.university_id,
    ti.student_id,
    ti.course_id,
    ti.class_id,
    NULL::text AS session_id,
    ti.period,
    ti.att_date,
    'present'::text AS status,
    NULL::text AS status_code,
    'manual'::text AS source,
    -- Use schedule times combined with date; store in UTC
    timezone('utc', (ti.att_date::timestamp + ti.end_time)) AS recorded_at,
    timezone('utc', (ti.att_date::timestamp + ti.start_time)) AS check_in_time,
    timezone('utc', (ti.att_date::timestamp + ti.start_time)) AS scheduled_time,
    NULL::text AS source_tz,
    to_char(ti.start_time, 'HH24:MI') || '-' || to_char(ti.end_time, 'HH24:MI') AS time,
    jsonb_build_object(
      'seeded_by_migration', '20251105091500_backfill_demo_attendance_for_enrolled_schedules'
    )
  FROM to_insert ti;

  RAISE NOTICE 'Demo attendance backfill completed.';
END $$;
