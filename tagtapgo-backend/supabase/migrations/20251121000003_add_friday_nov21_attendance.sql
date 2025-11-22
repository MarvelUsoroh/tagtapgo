-- Migration: Add Friday Nov 21, 2025 attendance for demo user
-- Creates attendance records for CS101 and MATH201

-- Friday, Nov 21, 2025 - CS101 (09:00-10:15)
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
  '22222222-2222-4444-8888-222222222222',
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'c1111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '2025-11-21',
  'present',
  'manual',
  '2025-11-21 09:05:00+00',
  '{"test": "attendance_tracking"}',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Friday, Nov 21, 2025 - MATH201 (12:45-14:00)
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
  '22222223-2223-4444-8888-222222232223',
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'c2222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222',
  '2025-11-21',
  'present',
  'manual',
  '2025-11-21 12:50:00+00',
  '{"test": "attendance_tracking"}',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;
