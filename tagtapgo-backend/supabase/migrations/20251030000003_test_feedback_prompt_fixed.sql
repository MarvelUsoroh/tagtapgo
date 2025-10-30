-- ============================================================================
-- Test Feedback Prompt (Fixed)
-- ============================================================================
-- 
-- This creates a class schedule that ended recently to trigger feedback prompt.
-- Fixes the time calculation issue from previous test.
--
-- Related: Feedback System Test
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
  v_class_end_time TIME;
  v_class_start_time TIME;
  v_today_day TEXT;
BEGIN
  -- Clean up old test data first
  DELETE FROM public.attendance WHERE metadata->>'test_data' = 'true';
  DELETE FROM public.class_schedules WHERE metadata->>'test_data' = 'true';
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Feedback Prompt Test (Fixed)';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Demo User ID: %', v_demo_user_id;
  RAISE NOTICE 'Current Time: %', v_current_time;
  
  -- Get current day of week
  v_today_day := TO_CHAR(v_current_time, 'Day');
  v_today_day := TRIM(v_today_day);
  RAISE NOTICE 'Today: %', v_today_day;
  
  -- Create class times: ended 3 minutes ago
  v_class_end_time := (v_current_time - INTERVAL '3 minutes')::TIME;
  v_class_start_time := (v_current_time - INTERVAL '1 hour 18 minutes')::TIME;
  
  RAISE NOTICE 'Class Time: % to %', v_class_start_time, v_class_end_time;
  RAISE NOTICE '';
  
  -- Create test class schedule
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
    v_class_start_time,
    v_class_end_time,
    'Room 101 (Test)',
    'smith',
    CURRENT_DATE - INTERVAL '1 month',
    CURRENT_DATE + INTERVAL '1 month',
    jsonb_build_object(
      'test_data', true,
      'created_for', 'feedback_test',
      'created_at', NOW()
    )
  )
  RETURNING id INTO v_class_schedule_id;
  
  RAISE NOTICE '✓ Created class schedule: %', v_class_schedule_id;
  
  -- Create attendance record
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
    v_current_time - INTERVAL '1 hour 16 minutes', -- Arrived 2 min after start
    jsonb_build_object(
      'test_data', true,
      'created_for', 'feedback_test',
      'created_at', NOW()
    )
  )
  RETURNING id INTO v_attendance_id;
  
  RAISE NOTICE '✓ Created attendance: %', v_attendance_id;
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Test Setup Complete';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Class ended: 3 minutes ago';
  RAISE NOTICE 'Wait for feedback-prompt-job to run (every 5 min)';
  RAISE NOTICE '';
  RAISE NOTICE 'Verify with:';
  RAISE NOTICE 'SELECT * FROM feedback_prompts WHERE student_id = ''%'';', v_demo_user_id;
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
END $$;
