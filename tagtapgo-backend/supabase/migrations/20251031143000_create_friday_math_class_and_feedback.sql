-- Create a Friday MATH201 class schedule and feedback prompt for testing
-- This simulates a class that ended at 14:00 today

-- Insert a new class schedule for MATH201 on Friday 12:45-14:00
INSERT INTO class_schedules (
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
  metadata,
  created_at, 
  updated_at
)
VALUES (
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', -- Same university as existing schedules
  'c2222222-2222-2222-2222-222222222222', -- MATH201
  '22222222-2222-2222-2222-222222222222', -- Same class as Thursday
  'Friday',
  '5',
  '12:45:00',
  '14:00:00',
  'Room 205',
  'johnson',
  '2024-08-31 23:00:00+00',
  '2024-12-15 00:00:00+00',
  '{}',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Create attendance record for demo user for today (2025-10-31)
INSERT INTO attendance (
  id, 
  university_id,
  student_id, 
  course_id, 
  class_id,
  date, 
  status,
  source,
  check_in_time,
  metadata,
  created_at, 
  updated_at
)
VALUES (
  'f1e2d3c4-b5a6-4978-8c9d-0e1f2a3b4c5d',
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'ab191d6e-e016-418b-80a1-0b2b25e007c7', -- Demo user
  'c2222222-2222-2222-2222-222222222222', -- MATH201
  '22222222-2222-2222-2222-222222222222',
  '2025-10-31',
  'present',
  'manual',
  '2025-10-31 13:00:00+00',
  '{}',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Create feedback prompt (expires in 24 hours)
INSERT INTO feedback_prompts (id, student_id, class_schedule_id, status, prompt_sent_at, expires_at, metadata, created_at, updated_at)
VALUES (
  'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  'ab191d6e-e016-418b-80a1-0b2b25e007c7', -- Demo user
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', -- New Friday MATH201 schedule
  'pending',
  '2025-10-31 14:15:00+00', -- 15 minutes after class ended
  '2025-11-01 14:15:00+00', -- Expires in 24 hours
  '{}',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Create notification record for the feedback prompt
INSERT INTO notifications (id, student_id, notification_type, title, message, data, read, created_at, updated_at)
VALUES (
  'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
  'ab191d6e-e016-418b-80a1-0b2b25e007c7', -- Demo user
  'feedback_prompt',
  'Share Your Feedback',
  'How was MATH201? Earn 5-10 points for your feedback!',
  jsonb_build_object(
    'type', 'feedback_prompt',
    'promptId', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    'classCode', 'MATH201',
    'className', 'Calculus II',
    'url', '/feedback/b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'
  ),
  false,
  '2025-10-31 14:15:00+00',
  '2025-10-31 14:15:00+00'
)
ON CONFLICT (id) DO NOTHING;

-- Add comment
COMMENT ON TABLE class_schedules IS 'Added Friday MATH201 class for feedback testing';
