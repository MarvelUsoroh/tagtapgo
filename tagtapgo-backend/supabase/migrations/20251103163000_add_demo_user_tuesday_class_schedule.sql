-- Ensure Demo User has an active Tuesday Calculus II class for the Fall 2025 pilot
-- Inserts are idempotent: they only run when the target rows are missing

-- Guard class record (re-uses existing id if already present)
INSERT INTO classes (
  id,
  course_id,
  section,
  instructor_name,
  instructor_email,
  location,
  start_date,
  end_date,
  capacity,
  metadata,
  created_at,
  updated_at
)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'c2222222-2222-2222-2222-222222222222',
  'B',
  'Prof. Johnson',
  NULL,
  'Room 205',
  '2025-08-25',
  '2025-12-18',
  25,
  jsonb_build_object(
    'semester', 'Fall 2025',
    'external_id', 'MATH201-B',
    'created_by_migration', '20251103163000_add_demo_user_tuesday_class_schedule'
  ),
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Create the Tuesday slot only if no overlapping schedule already exists for that day/time window
WITH target_course AS (
  SELECT
    id AS course_id,
    university_id
  FROM courses
  WHERE id = 'c2222222-2222-2222-2222-222222222222'
),
existing_overlap AS (
  SELECT 1
  FROM class_schedules cs
  CROSS JOIN target_course tc
  WHERE cs.course_id = tc.course_id
    AND cs.class_id = '22222222-2222-2222-2222-222222222222'
    AND cs.day_of_week = 'Tuesday'
    AND cs.start_time = '10:30:00'::time
    AND cs.end_time = '11:45:00'::time
    AND cs.effective_from <= '2025-11-04'::date
    AND (cs.effective_to IS NULL OR cs.effective_to >= '2025-11-04'::date)
  LIMIT 1
)
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
SELECT
  'dfdd4274-9a47-4c53-8c90-99c58a4d1f20',
  tc.university_id,
  tc.course_id,
  '22222222-2222-2222-2222-222222222222',
  'Tuesday',
  '2',
  '10:30:00'::time,
  '11:45:00'::time,
  'Room 205',
  'johnson',
  '2025-11-04'::date,
  '2025-12-18'::date,
  jsonb_build_object(
    'seeded_for_demo', true,
    'created_by_migration', '20251103163000_add_demo_user_tuesday_class_schedule'
  ),
  NOW(),
  NOW()
FROM target_course tc
WHERE NOT EXISTS (SELECT 1 FROM existing_overlap);
