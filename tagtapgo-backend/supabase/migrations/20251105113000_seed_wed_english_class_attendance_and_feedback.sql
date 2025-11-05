-- Seed a one-off Wednesday English Composition class for today (2025-11-05),
-- including attendance for the demo student and a feedback prompt + notification.
--
-- Times: 13:00–14:15 (local schedule time; stored as TIME)
-- This migration is idempotent: it checks for existing rows before inserting.
--
-- Demo student id used here:
--   ab191d6e-e016-418b-80a1-0b2b25e007c7
-- English Composition course/class:
--   course_id: c3333333-3333-3333-3333-333333333333
--   class_id:  33333333-3333-3333-3333-333333333333

DO $$
DECLARE
  v_demo_student_id UUID := 'ab191d6e-e016-418b-80a1-0b2b25e007c7';
  v_course_id UUID := 'c3333333-3333-3333-3333-333333333333';
  v_class_id  UUID := '33333333-3333-3333-3333-333333333333';
  v_schedule_id UUID := '7a9b6c18-6b31-4c3a-8a6a-1a2b3c4d5e60';
  v_feedback_prompt_id UUID := '9b2d0f59-2f8d-4d4a-8c7e-1f2a3b4c5d6e';
  v_notification_id UUID := 'e7f6d5c4-b3a2-4c1d-9e8f-7a6b5c4d3e2f';
  v_university_id UUID;
BEGIN
  -- Resolve university from course
  SELECT university_id INTO v_university_id FROM public.courses WHERE id = v_course_id;
  IF v_university_id IS NULL THEN
    RAISE NOTICE 'Course % not found; skipping.', v_course_id;
    RETURN;
  END IF;

  -- Ensure demo student exists and is enrolled in the course
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = v_demo_student_id) THEN
    RAISE NOTICE 'Demo student % not found; skipping.', v_demo_student_id;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments WHERE student_id = v_demo_student_id AND course_id = v_course_id
  ) THEN
    RAISE NOTICE 'Demo student is not enrolled in course %; skipping.', v_course_id;
    RETURN;
  END IF;

  -- Insert one-off class schedule for 2025-11-05 (Wednesday 13:00–14:15)
  IF NOT EXISTS (
    SELECT 1 FROM public.class_schedules cs
    WHERE cs.id = v_schedule_id
  ) THEN
    INSERT INTO public.class_schedules (
      id, university_id, course_id, class_id, day_of_week, period, start_time, end_time,
      location, instructor_id, effective_from, effective_to, metadata, created_at, updated_at
    ) VALUES (
      v_schedule_id, v_university_id, v_course_id, v_class_id,
      'Wednesday', 'X', '13:00:00'::time, '14:15:00'::time,
      'Room 310', 'smith', '2025-11-05'::date, '2025-11-05'::date,
      jsonb_build_object('seeded_for_demo', true, 'created_by_migration', '20251105113000_seed_wed_english_class_attendance_and_feedback'),
      timezone('utc', now()), timezone('utc', now())
    );
  END IF;

  -- Insert attendance for the demo student for 2025-11-05 (avoid duplicates regardless of session_id)
  IF NOT EXISTS (
    SELECT 1 FROM public.attendance a
    WHERE a.student_id = v_demo_student_id AND a.course_id = v_course_id AND a.date = '2025-11-05'
  ) THEN
    INSERT INTO public.attendance (
      university_id, student_id, course_id, class_id, session_id, period, date, status,
      status_code, source, recorded_at, check_in_time, scheduled_time, source_tz, time, metadata
    ) VALUES (
      v_university_id, v_demo_student_id, v_course_id, v_class_id, NULL, 'X', '2025-11-05', 'present',
      NULL, 'manual',
      timezone('utc', ('2025-11-05'::timestamp + '14:15:00'::time)),
      timezone('utc', ('2025-11-05'::timestamp + '13:00:00'::time)),
      timezone('utc', ('2025-11-05'::timestamp + '13:00:00'::time)),
      NULL,
      '13:00-14:15',
      jsonb_build_object('seeded_by_migration', '20251105113000_seed_wed_english_class_attendance_and_feedback')
    );
  END IF;

  -- Create feedback_prompt row for this schedule (idempotent by id and unique constraint)
  IF NOT EXISTS (
    SELECT 1 FROM public.feedback_prompts fp WHERE fp.id = v_feedback_prompt_id
  ) THEN
    INSERT INTO public.feedback_prompts (
      id, student_id, class_schedule_id, status, prompt_sent_at, expires_at, metadata, created_at, updated_at
    ) VALUES (
      v_feedback_prompt_id, v_demo_student_id, v_schedule_id, 'pending',
      -- Assume prompt sent 15 minutes after end time
      timezone('utc', ('2025-11-05'::timestamp + '14:30:00'::time)),
      timezone('utc', ('2025-11-06'::timestamp + '14:30:00'::time)),
      jsonb_build_object('seeded_by_migration', '20251105113000_seed_wed_english_class_attendance_and_feedback'),
      timezone('utc', now()), timezone('utc', now())
    );
  END IF;

  -- In-app notification for the feedback prompt (no push)
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications n WHERE n.id = v_notification_id
  ) THEN
    INSERT INTO public.notifications (
      id, student_id, notification_type, title, message, data, read, created_at, updated_at
    ) VALUES (
      v_notification_id, v_demo_student_id, 'feedback_prompt',
      'Share Your Feedback',
      'How was English Composition? Earn points for your feedback!',
      jsonb_build_object(
        'type','feedback_prompt',
        'promptId', v_feedback_prompt_id,
        'classCode','ENG101',
        'className','English Composition',
        'url','/feedback/' || v_feedback_prompt_id::text
      ),
      false,
      timezone('utc', now()), timezone('utc', now())
    );
  END IF;
END $$;
