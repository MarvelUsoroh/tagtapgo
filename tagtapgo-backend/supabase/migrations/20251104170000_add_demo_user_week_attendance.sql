-- Add attendance records for demo user for week of Nov 4-8, 2025
-- This will trigger feedback prompts 15 minutes after each class ends

-- Tuesday, Nov 5, 2025 - MATH201 (10:30-11:45)
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
) VALUES (
  'a1a1a1a1-1111-4444-8888-111111111111',
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'c2222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222',
  '2025-11-05',
  'present',
  'manual',
  '2025-11-05 10:35:00+00',
  '{"test": "feedback_prompt"}',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Wednesday, Nov 6, 2025 - CS101 (09:00-10:15)
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
) VALUES (
  'b2b2b2b2-2222-4444-8888-222222222222',
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'c1111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '2025-11-06',
  'present',
  'manual',
  '2025-11-06 09:05:00+00',
  '{"test": "feedback_prompt"}',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Wednesday, Nov 6, 2025 - ENG102 (13:00-14:15)
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
) VALUES (
  'c3c3c3c3-3333-4444-8888-333333333333',
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'c3333333-3333-3333-3333-333333333333',
  '33333333-3333-3333-3333-333333333333',
  '2025-11-06',
  'present',
  'manual',
  '2025-11-06 13:05:00+00',
  '{"test": "feedback_prompt"}',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Thursday, Nov 7, 2025 - MATH201 (10:30-11:45)
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
) VALUES (
  'd4d4d4d4-4444-4444-8888-444444444444',
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'c2222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222',
  '2025-11-07',
  'present',
  'manual',
  '2025-11-07 10:35:00+00',
  '{"test": "feedback_prompt"}',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Thursday, Nov 7, 2025 - CS101 (14:13-15:28) - Test schedule
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
) VALUES (
  'e5e5e5e5-5555-4444-8888-555555555555',
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'c1111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '2025-11-07',
  'present',
  'manual',
  '2025-11-07 14:15:00+00',
  '{"test": "feedback_prompt"}',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Friday, Nov 8, 2025 - CS101 (09:00-10:15)
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
) VALUES (
  'f6f6f6f6-6666-4444-8888-666666666666',
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'c1111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '2025-11-08',
  'present',
  'manual',
  '2025-11-08 09:05:00+00',
  '{"test": "feedback_prompt"}',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Friday, Nov 8, 2025 - MATH201 (12:45-14:00)
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
) VALUES (
  '77777777-7777-4444-8888-777777777777',
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'c2222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222',
  '2025-11-08',
  'present',
  'manual',
  '2025-11-08 12:50:00+00',
  '{"test": "feedback_prompt"}',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Add comment
COMMENT ON TABLE attendance IS 'Added Nov 4-8 attendance for demo user to test feedback prompts';
