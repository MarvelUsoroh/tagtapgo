-- Migration: Add test data for Venus AI feedback system
-- Creates attendance and feedback prompt for demo user

-- Add attendance for CS101 class today
INSERT INTO attendance (
  student_id,
  course_id,
  university_id,
  date,
  status,
  check_in_time,
  session_id
)
VALUES (
  'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'c1111111-1111-1111-1111-111111111111',
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  CURRENT_DATE,
  'present',
  CURRENT_TIMESTAMP - INTERVAL '2 hours',
  NULL
)
ON CONFLICT (student_id, course_id, date, session_id) DO NOTHING;

-- Create feedback prompt for CS101 (using DO block to handle deferrable constraint)
DO $$
DECLARE
  v_prompt_id UUID;
  v_notification_id UUID;
BEGIN
  -- Try to insert, if it fails due to unique constraint, update instead
  INSERT INTO feedback_prompts (
    student_id,
    class_schedule_id,
    prompt_sent_at,
    expires_at,
    status
  )
  VALUES (
    'ab191d6e-e016-418b-80a1-0b2b25e007c7',
    '93244eaa-44be-4d05-badd-b212e259a2f6',
    CURRENT_TIMESTAMP - INTERVAL '1 hour',
    CURRENT_TIMESTAMP + INTERVAL '23 hours',
    'pending'
  )
  RETURNING id INTO v_prompt_id;
  
  -- Create notification for the new prompt
  v_notification_id := gen_random_uuid();
  INSERT INTO notifications (
    id,
    student_id,
    notification_type,
    title,
    message,
    data,
    read,
    created_at,
    updated_at
  )
  VALUES (
    v_notification_id,
    'ab191d6e-e016-418b-80a1-0b2b25e007c7',
    'feedback_prompt',
    'Share Your Feedback',
    'How was CS101? Earn 5-10 points for your feedback!',
    jsonb_build_object(
      'type', 'feedback_prompt',
      'promptId', v_prompt_id,
      'classCode', 'CS101',
      'className', 'Introduction to Computer Science',
      'url', '/feedback/' || v_prompt_id::text
    ),
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );
  
EXCEPTION
  WHEN unique_violation THEN
    -- Update existing record
    UPDATE feedback_prompts
    SET 
      status = 'pending',
      prompt_sent_at = CURRENT_TIMESTAMP - INTERVAL '1 hour',
      expires_at = CURRENT_TIMESTAMP + INTERVAL '23 hours',
      updated_at = CURRENT_TIMESTAMP
    WHERE student_id = 'ab191d6e-e016-418b-80a1-0b2b25e007c7'
      AND class_schedule_id = '93244eaa-44be-4d05-badd-b212e259a2f6'
    RETURNING id INTO v_prompt_id;
    
    -- Update or create notification
    v_notification_id := gen_random_uuid();
    INSERT INTO notifications (
      id,
      student_id,
      notification_type,
      title,
      message,
      data,
      read,
      created_at,
      updated_at
    )
    VALUES (
      v_notification_id,
      'ab191d6e-e016-418b-80a1-0b2b25e007c7',
      'feedback_prompt',
      'Share Your Feedback',
      'How was CS101? Earn 5-10 points for your feedback!',
      jsonb_build_object(
        'type', 'feedback_prompt',
        'promptId', v_prompt_id,
        'classCode', 'CS101',
        'className', 'Introduction to Computer Science',
        'url', '/feedback/' || v_prompt_id::text
      ),
      false,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT DO NOTHING;
END $$;
