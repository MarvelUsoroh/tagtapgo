-- Migration: Add test data for Venus AI feedback system
-- Creates attendance and feedback prompts for demo user's Thursday classes

-- Add attendance for MATH201 class today (10:30-11:45, already ended)
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
  'c2222222-2222-2222-2222-222222222222',
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  CURRENT_DATE,
  'present',
  CURRENT_TIMESTAMP - INTERVAL '5 hours',
  NULL
)
ON CONFLICT (student_id, course_id, date, session_id) DO NOTHING;

-- Add attendance for CS101 class today (14:13-15:28, in progress/just ended)
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
  CURRENT_TIMESTAMP - INTERVAL '1 hour',
  NULL
)
ON CONFLICT (student_id, course_id, date, session_id) DO NOTHING;

-- Create feedback prompt for MATH201 (class ended ~4 hours ago)
DO $$
BEGIN
  INSERT INTO feedback_prompts (
    student_id,
    class_schedule_id,
    prompt_sent_at,
    expires_at,
    status
  )
  VALUES (
    'ab191d6e-e016-418b-80a1-0b2b25e007c7',
    'c6c16c06-ef90-45e1-91d5-1dc495966152',
    CURRENT_TIMESTAMP - INTERVAL '4 hours',
    CURRENT_TIMESTAMP + INTERVAL '20 hours',
    'pending'
  );
EXCEPTION
  WHEN unique_violation THEN
    UPDATE feedback_prompts
    SET 
      status = 'pending',
      prompt_sent_at = CURRENT_TIMESTAMP - INTERVAL '4 hours',
      expires_at = CURRENT_TIMESTAMP + INTERVAL '20 hours',
      updated_at = CURRENT_TIMESTAMP
    WHERE student_id = 'ab191d6e-e016-418b-80a1-0b2b25e007c7'
      AND class_schedule_id = 'c6c16c06-ef90-45e1-91d5-1dc495966152';
END $$;

-- Create feedback prompt for CS101 (class just ended ~30 min ago)
DO $$
BEGIN
  INSERT INTO feedback_prompts (
    student_id,
    class_schedule_id,
    prompt_sent_at,
    expires_at,
    status
  )
  VALUES (
    'ab191d6e-e016-418b-80a1-0b2b25e007c7',
    'ad6fc9e0-9b1a-4169-ae18-31728e216b21',
    CURRENT_TIMESTAMP - INTERVAL '30 minutes',
    CURRENT_TIMESTAMP + INTERVAL '23 hours 30 minutes',
    'pending'
  );
EXCEPTION
  WHEN unique_violation THEN
    UPDATE feedback_prompts
    SET 
      status = 'pending',
      prompt_sent_at = CURRENT_TIMESTAMP - INTERVAL '30 minutes',
      expires_at = CURRENT_TIMESTAMP + INTERVAL '23 hours 30 minutes',
      updated_at = CURRENT_TIMESTAMP
    WHERE student_id = 'ab191d6e-e016-418b-80a1-0b2b25e007c7'
      AND class_schedule_id = 'ad6fc9e0-9b1a-4169-ae18-31728e216b21';
END $$;
