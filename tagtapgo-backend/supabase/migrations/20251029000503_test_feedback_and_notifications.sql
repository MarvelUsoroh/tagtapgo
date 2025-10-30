-- ============================================================================
-- Test Feedback Prompt and Push Notifications
-- ============================================================================
-- 
-- This migration creates test data to verify:
-- 1. Feedback prompt creation (feedback-prompt-job cron)
-- 2. Push notification delivery
--
-- Test Scenario:
-- - Create a class that just ended (5 minutes ago)
-- - Create attendance record for Demo User
-- - Feedback prompt job will detect this and create prompt
-- - Notification will be sent to Demo User
--
-- Related: Feedback System, Push Notifications
-- ============================================================================

DO $$
DECLARE
  v_demo_user_id UUID := 'ab191d6e-e016-418b-80a1-0b2b25e007c7';
  v_university_id UUID := 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
  v_test_course_id UUID := 'c1111111-1111-1111-1111-111111111111'; -- CS101
  v_test_class_id UUID := '11111111-1111-1111-1111-111111111111';
  v_class_schedule_id UUID;
  v_attendance_id UUID;
  v_current_time TIMESTAMP := NOW();
  v_class_start_time TIMESTAMP;
  v_class_end_time TIMESTAMP;
  v_today_day TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Feedback & Notification Test Setup';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Demo User ID: %', v_demo_user_id;
  RAISE NOTICE 'Current Time: %', v_current_time;
  RAISE NOTICE '';

  -- Get current day of week
  v_today_day := TO_CHAR(v_current_time, 'Day');
  v_today_day := TRIM(v_today_day);
  
  RAISE NOTICE 'Today is: %', v_today_day;

  -- Create a class that ended 5 minutes ago
  v_class_end_time := v_current_time - INTERVAL '5 minutes';
  v_class_start_time := v_class_end_time - INTERVAL '1 hour 15 minutes'; -- 75 min class

  RAISE NOTICE 'Test Class Time: % to %', v_class_start_time, v_class_end_time;
  RAISE NOTICE '';

  -- ============================================================================
  -- 1. Create test class schedule for today
  -- ============================================================================
  
  INSERT INTO public.class_schedules (
    id,
    university_id,
    course_id,
    class_id,
    day_of_week,
    period,
    start_time,
    end_time,
    location,
    instructor_id,
    effective_from,
    effective_to,
    metadata
  ) VALUES (
    gen_random_uuid(),
    v_university_id,
    v_test_course_id,
    v_test_class_id,
    v_today_day,
    'TEST',
    v_class_start_time::TIME,
    v_class_end_time::TIME,
    'Room 101 (Test)',
    'smith',
    CURRENT_DATE - INTERVAL '1 month',
    CURRENT_DATE + INTERVAL '1 month',
    jsonb_build_object(
      'test_data', true,
      'created_for', 'feedback_notification_test',
      'created_at', NOW()
    )
  )
  RETURNING id INTO v_class_schedule_id;

  RAISE NOTICE '✓ Created test class schedule: %', v_class_schedule_id;

  -- ============================================================================
  -- 2. Create attendance record for Demo User
  -- ============================================================================

  INSERT INTO public.attendance (
    id,
    university_id,
    student_id,
    course_id,
    class_id,
    date,
    status,
    source,
    check_in_time,
    metadata
  ) VALUES (
    gen_random_uuid(),
    v_university_id,
    v_demo_user_id,
    v_test_course_id,
    v_test_class_id,
    CURRENT_DATE,
    'present',
    'manual',
    v_class_start_time + INTERVAL '2 minutes', -- Arrived 2 min after start
    jsonb_build_object(
      'test_data', true,
      'created_for', 'feedback_notification_test',
      'created_at', NOW()
    )
  )
  RETURNING id INTO v_attendance_id;

  RAISE NOTICE '✓ Created attendance record: %', v_attendance_id;

  -- ============================================================================
  -- 3. Summary and Next Steps
  -- ============================================================================

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Test Data Created Successfully';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Class Schedule ID: %', v_class_schedule_id;
  RAISE NOTICE 'Attendance ID: %', v_attendance_id;
  RAISE NOTICE 'Class ended at: %', v_class_end_time;
  RAISE NOTICE 'Current time: %', v_current_time;
  RAISE NOTICE 'Time since class ended: 5 minutes';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Wait for feedback-prompt-job cron to run (every 5 min)';
  RAISE NOTICE '2. Check feedback_prompts table for new prompt';
  RAISE NOTICE '3. Check notifications table for push notification';
  RAISE NOTICE '';
  RAISE NOTICE 'Verification Queries:';
  RAISE NOTICE '---';
  RAISE NOTICE 'SELECT * FROM feedback_prompts WHERE student_id = ''%'';', v_demo_user_id;
  RAISE NOTICE 'SELECT * FROM notifications WHERE student_id = ''%'';', v_demo_user_id;
  RAISE NOTICE '============================================';
  RAISE NOTICE '';

END $$;

-- ============================================================================
-- Verification Queries (for manual testing)
-- ============================================================================

-- Check if test class schedule was created
SELECT 
  cs.id,
  cs.day_of_week,
  cs.start_time,
  cs.end_time,
  cs.location,
  c.name as course_name,
  cs.metadata->>'test_data' as is_test_data
FROM public.class_schedules cs
JOIN public.courses c ON cs.course_id = c.id
WHERE cs.metadata->>'test_data' = 'true'
ORDER BY cs.created_at DESC
LIMIT 1;

-- Check if test attendance was created
SELECT 
  a.id,
  a.date,
  a.status,
  a.check_in_time,
  c.name as course_name,
  s.email as student_email,
  a.metadata->>'test_data' as is_test_data
FROM public.attendance a
JOIN public.courses c ON a.course_id = c.id
JOIN public.students s ON a.student_id = s.id
WHERE a.metadata->>'test_data' = 'true'
ORDER BY a.created_at DESC
LIMIT 1;

-- Check for feedback prompts (will be created by cron job)
SELECT 
  fp.id,
  fp.student_id,
  fp.class_schedule_id,
  fp.status,
  fp.expires_at,
  fp.prompt_sent_at,
  fp.created_at,
  c.name as course_name
FROM public.feedback_prompts fp
JOIN public.class_schedules cs ON fp.class_schedule_id = cs.id
JOIN public.courses c ON cs.course_id = c.id
WHERE fp.student_id = 'ab191d6e-e016-418b-80a1-0b2b25e007c7'
ORDER BY fp.created_at DESC
LIMIT 5;

-- Check for notifications (will be created by cron job)
SELECT 
  n.id,
  n.student_id,
  n.notification_type,
  n.title,
  n.message,
  n.read,
  n.created_at,
  n.data
FROM public.notifications n
WHERE n.student_id = 'ab191d6e-e016-418b-80a1-0b2b25e007c7'
ORDER BY n.created_at DESC
LIMIT 5;

-- ============================================================================
-- Cleanup (run this after testing to remove test data)
-- ============================================================================

-- To clean up test data after testing:
-- DELETE FROM public.feedback_prompts WHERE class_schedule_id IN (
--   SELECT id FROM public.class_schedules WHERE metadata->>'test_data' = 'true'
-- );
-- DELETE FROM public.attendance WHERE metadata->>'test_data' = 'true';
-- DELETE FROM public.class_schedules WHERE metadata->>'test_data' = 'true';
-- DELETE FROM public.notifications WHERE data->>'test_data' = 'true';
