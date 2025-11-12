-- Add attendance for week of Nov 10-14, 2025 to test feedback prompts
-- Current time: Nov 10, 11:13 AM - CS101 class already ended

-- Monday, Nov 10, 2025 - CS101 (09:00-10:15) - ALREADY ENDED
INSERT INTO attendance (
  id, university_id, student_id, course_id, class_id, date, status, source, check_in_time, metadata, created_at, updated_at
) VALUES (
  '10101010-1010-4444-8888-101010101010', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '2025-11-10', 'present', 'manual',
  '2025-11-10 09:05:00+00', '{"test": "feedback_prompt"}', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- Monday, Nov 10, 2025 - ENG102 (13:00-14:15) - UPCOMING
INSERT INTO attendance (
  id, university_id, student_id, course_id, class_id, date, status, source, check_in_time, metadata, created_at, updated_at
) VALUES (
  '20202020-2020-4444-8888-202020202020', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'c3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', '2025-11-10', 'present', 'manual',
  '2025-11-10 13:05:00+00', '{"test": "feedback_prompt"}', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- Tuesday, Nov 11, 2025 - MATH201 (10:30-11:45)
INSERT INTO attendance (
  id, university_id, student_id, course_id, class_id, date, status, source, check_in_time, metadata, created_at, updated_at
) VALUES (
  '11111111-1111-4444-8888-111111111111', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'c2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', '2025-11-11', 'present', 'manual',
  '2025-11-11 10:35:00+00', '{"test": "feedback_prompt"}', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- Wednesday, Nov 12, 2025 - CS101 (09:00-10:15)
INSERT INTO attendance (
  id, university_id, student_id, course_id, class_id, date, status, source, check_in_time, metadata, created_at, updated_at
) VALUES (
  '12121212-1212-4444-8888-121212121212', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '2025-11-12', 'present', 'manual',
  '2025-11-12 09:05:00+00', '{"test": "feedback_prompt"}', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- Wednesday, Nov 12, 2025 - ENG102 (13:00-14:15)
INSERT INTO attendance (
  id, university_id, student_id, course_id, class_id, date, status, source, check_in_time, metadata, created_at, updated_at
) VALUES (
  '12121213-1213-4444-8888-121212131213', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'c3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', '2025-11-12', 'present', 'manual',
  '2025-11-12 13:05:00+00', '{"test": "feedback_prompt"}', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- Thursday, Nov 13, 2025 - MATH201 (10:30-11:45)
INSERT INTO attendance (
  id, university_id, student_id, course_id, class_id, date, status, source, check_in_time, metadata, created_at, updated_at
) VALUES (
  '13131313-1313-4444-8888-131313131313', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'c2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', '2025-11-13', 'present', 'manual',
  '2025-11-13 10:35:00+00', '{"test": "feedback_prompt"}', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- Thursday, Nov 13, 2025 - CS101 (14:13-15:28)
INSERT INTO attendance (
  id, university_id, student_id, course_id, class_id, date, status, source, check_in_time, metadata, created_at, updated_at
) VALUES (
  '13131314-1314-4444-8888-131313141314', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '2025-11-13', 'present', 'manual',
  '2025-11-13 14:15:00+00', '{"test": "feedback_prompt"}', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- Friday, Nov 14, 2025 - CS101 (09:00-10:15)
INSERT INTO attendance (
  id, university_id, student_id, course_id, class_id, date, status, source, check_in_time, metadata, created_at, updated_at
) VALUES (
  '14141414-1414-4444-8888-141414141414', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '2025-11-14', 'present', 'manual',
  '2025-11-14 09:05:00+00', '{"test": "feedback_prompt"}', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- Friday, Nov 14, 2025 - MATH201 (12:45-14:00)
INSERT INTO attendance (
  id, university_id, student_id, course_id, class_id, date, status, source, check_in_time, metadata, created_at, updated_at
) VALUES (
  '14141415-1415-4444-8888-141414151415', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'c2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', '2025-11-14', 'present', 'manual',
  '2025-11-14 12:50:00+00', '{"test": "feedback_prompt"}', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- Add comment
COMMENT ON TABLE attendance IS 'Added Nov 10-14 attendance for demo user to test feedback prompts';
