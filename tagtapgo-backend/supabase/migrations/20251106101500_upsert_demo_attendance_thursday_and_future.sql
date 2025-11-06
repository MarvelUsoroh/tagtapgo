-- Upsert attendance for Demo User for today and all future Thursday occurrences
-- within the active schedule window(s) tied to the user's enrollments.
-- This is a testing/seed migration and marks rows via metadata.

DO $$
DECLARE
  v_student_id uuid := 'ab191d6e-e016-418b-80a1-0b2b25e007c7'; -- Demo User
  v_university_id uuid; -- derived from student row (required for attendance inserts)
  v_today date := current_date;
  v_tag text := '20251106101500_upsert_demo_attendance_thursday_and_future';
  v_rows_today int := 0;
  v_rows_future int := 0;
BEGIN
  -- Fetch university for the demo student (attendance.university_id is NOT NULL)
  SELECT s.university_id INTO v_university_id FROM public.students s WHERE s.id = v_student_id;
  IF v_university_id IS NULL THEN
    RAISE EXCEPTION 'Demo student % not found or has no university_id', v_student_id;
  END IF;
  -- 1) Identify active Thursday class schedules for the student's enrolled courses
  --    and produce all future occurrence dates (including today) within effective window
  WITH enrolled_courses AS (
    SELECT e.course_id
    FROM public.enrollments e
    WHERE e.student_id = v_student_id
  ), target_schedules AS (
    SELECT cs.*
    FROM public.class_schedules cs
    WHERE trim(cs.day_of_week) = trim(to_char(v_today, 'Day')) -- today weekday (e.g., Thursday)
      AND v_today BETWEEN cs.effective_from AND cs.effective_to
      AND cs.course_id IN (SELECT course_id FROM enrolled_courses)
  ), future_occurrences AS (
    SELECT 
      ts.course_id,
      ts.class_id,
      d::date AS occur_date
    FROM target_schedules ts
    CROSS JOIN LATERAL (
      SELECT gs::date AS d
      FROM generate_series(
        GREATEST(v_today, ts.effective_from)::timestamp,
        ts.effective_to::timestamp,
        interval '1 day'
      ) gs
      WHERE trim(to_char(gs, 'Day')) = trim(ts.day_of_week)
    ) g
  )
  -- 2) Upsert attendance for all occurrences (today + future Thursdays)
  , upserted AS (
    INSERT INTO public.attendance (university_id, student_id, course_id, date, status, source, metadata)
    SELECT 
      v_university_id,
      v_student_id,
      fo.course_id,
      fo.occur_date,
      'present'::text,
      'manual'::text,
      jsonb_build_object(
        'seeded_by_migration', v_tag,
        'note', 'test upsert for schedule occurrence'
      )
    FROM future_occurrences fo
    ON CONFLICT DO NOTHING
    RETURNING date
  )
  SELECT 
    COUNT(*) FILTER (WHERE date = v_today) AS c_today,
    COUNT(*) FILTER (WHERE date > v_today) AS c_future
  INTO v_rows_today, v_rows_future
  FROM upserted;

  RAISE NOTICE 'Attendance upsert complete. Today: %, Future occurrences: %', v_rows_today, v_rows_future;
END $$;