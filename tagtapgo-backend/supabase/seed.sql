-- ============================================================================
-- Seed Data for TagTapGo
-- User ID: ab191d6e-e016-418b-80a1-0b2b25e007c7
-- ============================================================================
-- 
-- IMPORTANT: This script is SAFE to run multiple times
-- - Uses ON CONFLICT DO NOTHING to prevent duplicates
-- - Only inserts data if it doesn't already exist
-- - Does NOT delete or truncate any existing data
-- 
-- HOW TO USE:
-- 1. Review this file to ensure the data is what you want
-- 2. Run it manually in your Supabase SQL Editor, OR
-- 3. Run: psql <connection-string> -f seed.sql
-- 
-- ============================================================================

-- ============================================================================
-- 1. Create University
-- ============================================================================

INSERT INTO public.universities (
  id,
  name,
  domain,
  sis_type,
  timezone,
  api_config,
  metadata,
  active
) VALUES (
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'Demo University',
  'demo.edu',
  'generic',  -- Must be one of: moodle, openSIS, generic
  'America/New_York',
  jsonb_build_object(
    'base_url', 'https://api.demo.edu',
    'api_key', 'demo_key_placeholder',
    'sync_enabled', true,
    'sync_interval_minutes', 5
  ),
  jsonb_build_object(
    'type', 'demo',
    'student_count', 1
  ),
  true
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. Create Student Profile
-- ============================================================================

INSERT INTO public.students (
  id,
  university_id,
  external_id,
  email,
  first_name,
  last_name,
  full_name,
  name,
  status,
  settings,
  metadata
) VALUES (
  'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'demo@demo.edu',
  'Demo',
  'User',
  'Demo User',
  'Demo User',
  'active',
  jsonb_build_object(
    'notifications_enabled', true,
    'theme', 'light'
  ),
  jsonb_build_object(
    'onboarding_completed', true
  )
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. Create Courses
-- ============================================================================

INSERT INTO public.courses (
  id,
  university_id,
  external_id,
  code,
  name,
  short_name,
  description,
  active,
  metadata
) VALUES 
(
  'c1111111-1111-1111-1111-111111111111',
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'CS101',
  'CS101',
  'Introduction to Computer Science',
  'Intro CS',
  'Fundamentals of programming and computer science',
  true,
  jsonb_build_object('department', 'Computer Science', 'credits', 3)
),
(
  'c2222222-2222-2222-2222-222222222222',
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'MATH201',
  'MATH201',
  'Calculus II',
  'Calc II',
  'Advanced calculus and mathematical analysis',
  true,
  jsonb_build_object('department', 'Mathematics', 'credits', 4)
),
(
  'c3333333-3333-3333-3333-333333333333',
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'ENG102',
  'ENG102',
  'English Composition',
  'Eng Comp',
  'Writing and critical thinking',
  true,
  jsonb_build_object('department', 'English', 'credits', 3)
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. Create Classes
-- ============================================================================

INSERT INTO public.classes (
  id,
  course_id,
  section,
  instructor_name,
  location,
  capacity,
  metadata
) VALUES
(
  '11111111-1111-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111',
  'A',
  'Dr. Smith',
  'Room 101',
  30,
  jsonb_build_object('semester', 'Fall 2024', 'external_id', 'CS101-A')
),
(
  '22222222-2222-2222-2222-222222222222',
  'c2222222-2222-2222-2222-222222222222',
  'B',
  'Prof. Johnson',
  'Room 205',
  25,
  jsonb_build_object('semester', 'Fall 2024', 'external_id', 'MATH201-B')
),
(
  '33333333-3333-3333-3333-333333333333',
  'c3333333-3333-3333-3333-333333333333',
  'C',
  'Dr. Williams',
  'Room 310',
  20,
  jsonb_build_object('semester', 'Fall 2024', 'external_id', 'ENG102-C')
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. Create Enrollments
-- ============================================================================

INSERT INTO public.enrollments (
  id,
  student_id,
  course_id,
  role,
  status,
  enrolled_at,
  metadata
) VALUES
(
  'e1111111-1111-1111-1111-111111111111',
  'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'c1111111-1111-1111-1111-111111111111',
  'student',
  'active',
  NOW() - INTERVAL '30 days',
  jsonb_build_object('grade', 'A', 'class_id', '11111111-1111-1111-1111-111111111111')
),
(
  'e2222222-2222-2222-2222-222222222222',
  'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'c2222222-2222-2222-2222-222222222222',
  'student',
  'active',
  NOW() - INTERVAL '30 days',
  jsonb_build_object('grade', 'B+', 'class_id', '22222222-2222-2222-2222-222222222222')
),
(
  'e3333333-3333-3333-3333-333333333333',
  'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  'c3333333-3333-3333-3333-333333333333',
  'student',
  'active',
  NOW() - INTERVAL '30 days',
  jsonb_build_object('grade', 'A-', 'class_id', '33333333-3333-3333-3333-333333333333')
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. Create Class Schedules
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
) VALUES
-- CS101 - Monday, Wednesday, Friday
(
  gen_random_uuid(),
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'c1111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'Monday',
  '1',
  '09:00:00',
  '10:15:00',
  'Room 101',
  'smith',
  '2024-09-01',
  '2024-12-15',
  '{}'::jsonb
),
(
  gen_random_uuid(),
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'c1111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'Wednesday',
  '1',
  '09:00:00',
  '10:15:00',
  'Room 101',
  'smith',
  '2024-09-01',
  '2024-12-15',
  '{}'::jsonb
),
(
  gen_random_uuid(),
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'c1111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'Friday',
  '1',
  '09:00:00',
  '10:15:00',
  'Room 101',
  'smith',
  '2024-09-01',
  '2024-12-15',
  '{}'::jsonb
),
-- MATH201 - Tuesday, Thursday
(
  gen_random_uuid(),
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'c2222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222',
  'Tuesday',
  '2',
  '10:30:00',
  '11:45:00',
  'Room 205',
  'johnson',
  '2024-09-01',
  '2024-12-15',
  '{}'::jsonb
),
(
  gen_random_uuid(),
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'c2222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222',
  'Thursday',
  '2',
  '10:30:00',
  '11:45:00',
  'Room 205',
  'johnson',
  '2024-09-01',
  '2024-12-15',
  '{}'::jsonb
),
-- ENG102 - Monday, Wednesday
(
  gen_random_uuid(),
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'c3333333-3333-3333-3333-333333333333',
  '33333333-3333-3333-3333-333333333333',
  'Monday',
  '3',
  '13:00:00',
  '14:15:00',
  'Room 310',
  'williams',
  '2024-09-01',
  '2024-12-15',
  '{}'::jsonb
),
(
  gen_random_uuid(),
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'c3333333-3333-3333-3333-333333333333',
  '33333333-3333-3333-3333-333333333333',
  'Wednesday',
  '3',
  '13:00:00',
  '14:15:00',
  'Room 310',
  'williams',
  '2024-09-01',
  '2024-12-15',
  '{}'::jsonb
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. Create Sample Attendance Records (Last 2 weeks)
-- ============================================================================

-- Generate attendance for the last 10 class days
DO $$
DECLARE
  attendance_date DATE;
  day_name TEXT;
BEGIN
  -- Loop through last 14 days
  FOR i IN 0..13 LOOP
    attendance_date := CURRENT_DATE - i;
    day_name := TO_CHAR(attendance_date, 'Day');
    day_name := TRIM(day_name);
    
    -- CS101 attendance (Mon, Wed, Fri)
    IF day_name IN ('Monday', 'Wednesday', 'Friday') THEN
      INSERT INTO public.attendance (
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
        'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
        'ab191d6e-e016-418b-80a1-0b2b25e007c7',
        'c1111111-1111-1111-1111-111111111111',
        '11111111-1111-1111-1111-111111111111',
        attendance_date,
        CASE WHEN random() > 0.1 THEN 'present' ELSE 'absent' END,
        'manual',
        CASE WHEN random() > 0.1 THEN (attendance_date + TIME '09:00:00' + (random() * INTERVAL '15 minutes')) ELSE NULL END,
        '{}'::jsonb
      ) ON CONFLICT DO NOTHING;
    END IF;
    
    -- MATH201 attendance (Tue, Thu)
    IF day_name IN ('Tuesday', 'Thursday') THEN
      INSERT INTO public.attendance (
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
        'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
        'ab191d6e-e016-418b-80a1-0b2b25e007c7',
        'c2222222-2222-2222-2222-222222222222',
        '22222222-2222-2222-2222-222222222222',
        attendance_date,
        CASE WHEN random() > 0.15 THEN 'present' ELSE 'absent' END,
        'manual',
        CASE WHEN random() > 0.15 THEN (attendance_date + TIME '10:30:00' + (random() * INTERVAL '15 minutes')) ELSE NULL END,
        '{}'::jsonb
      ) ON CONFLICT DO NOTHING;
    END IF;
    
    -- ENG102 attendance (Mon, Wed)
    IF day_name IN ('Monday', 'Wednesday') THEN
      INSERT INTO public.attendance (
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
        'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
        'ab191d6e-e016-418b-80a1-0b2b25e007c7',
        'c3333333-3333-3333-3333-333333333333',
        '33333333-3333-3333-3333-333333333333',
        attendance_date,
        CASE WHEN random() > 0.2 THEN 'present' ELSE 'absent' END,
        'manual',
        CASE WHEN random() > 0.2 THEN (attendance_date + TIME '13:00:00' + (random() * INTERVAL '15 minutes')) ELSE NULL END,
        '{}'::jsonb
      ) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 8. Create Achievements
-- ============================================================================

INSERT INTO public.achievements (
  name,
  description,
  category,
  rarity,
  points_reward,
  badge_image_url,
  criteria,
  is_active,
  metadata
) VALUES
-- Attendance Achievements
(
  'First Day',
  'Attend your first class',
  'attendance',
  'common',
  10,
  NULL,  -- badge_image_url (can store emoji or URL)
  jsonb_build_object('type', 'attendance_count', 'threshold', 1),
  true,
  jsonb_build_object('icon', '🎓', 'key', 'first-class')
),
(
  'Week Warrior',
  'Attend all classes for a week',
  'attendance',
  'rare',  -- Changed from uncommon to rare
  50,
  NULL,
  jsonb_build_object('type', 'perfect_week', 'threshold', 1),
  true,
  jsonb_build_object('icon', '📅', 'key', 'week-warrior')
),
(
  'Perfect Month',
  'Attend all classes for a month',
  'attendance',
  'epic',  -- Changed from rare to epic
  200,
  NULL,
  jsonb_build_object('type', 'perfect_month', 'threshold', 1),
  true,
  jsonb_build_object('icon', '🏆', 'key', 'perfect-month')
),
-- Streak Achievements
(
  'On a Roll',
  'Maintain a 3-day attendance streak',
  'streak',
  'common',
  25,
  NULL,
  jsonb_build_object('type', 'streak', 'threshold', 3),
  true,
  jsonb_build_object('icon', '🔥', 'key', 'streak-3')
),
(
  'Week Streak',
  'Maintain a 7-day attendance streak',
  'streak',
  'rare',  -- Changed from uncommon to rare
  75,
  NULL,
  jsonb_build_object('type', 'streak', 'threshold', 7),
  true,
  jsonb_build_object('icon', '⚡', 'key', 'streak-7')
),
(
  'Unstoppable',
  'Maintain a 30-day attendance streak',
  'streak',
  'legendary',
  500,
  NULL,
  jsonb_build_object('type', 'streak', 'threshold', 30),
  true,
  jsonb_build_object('icon', '💎', 'key', 'streak-30')
),
-- Early Bird Achievements
(
  'Early Bird',
  'Arrive early to class 5 times',
  'time',  -- Changed category from punctuality to time
  'rare',  -- Changed from uncommon to rare
  40,
  NULL,
  jsonb_build_object('type', 'early_arrival', 'threshold', 5),
  true,
  jsonb_build_object('icon', '🐦', 'key', 'early-bird')
),
-- Social Achievements
(
  'Social Butterfly',
  'Add 5 friends',
  'social',
  'common',
  30,
  NULL,
  jsonb_build_object('type', 'friends', 'threshold', 5),
  true,
  jsonb_build_object('icon', '🦋', 'key', 'social-butterfly')
)
ON CONFLICT DO NOTHING
RETURNING id, name;

-- ============================================================================
-- 9. Award Initial Achievements
-- ============================================================================

-- Award "First Day" achievement
DO $$
DECLARE
  first_day_achievement_id UUID;
BEGIN
  -- Get the achievement ID for "First Day"
  SELECT id INTO first_day_achievement_id
  FROM public.achievements
  WHERE name = 'First Day'
  LIMIT 1;
  
  IF first_day_achievement_id IS NOT NULL THEN
    -- Award the achievement (only if not already awarded)
    IF NOT EXISTS (
      SELECT 1 FROM public.student_achievements 
      WHERE student_id = 'ab191d6e-e016-418b-80a1-0b2b25e007c7' 
        AND achievement_id = first_day_achievement_id
    ) THEN
      INSERT INTO public.student_achievements (
        student_id,
        achievement_id,
        unlocked,
        unlocked_at,
        progress,
        metadata
      ) VALUES (
        'ab191d6e-e016-418b-80a1-0b2b25e007c7',
        first_day_achievement_id,
        true,
        NOW() - INTERVAL '10 days',
        jsonb_build_object('current', 1, 'required', 1),
        '{}'::jsonb
      );
    END IF;
    
    -- Add achievement points (only if not already added)
    IF NOT EXISTS (
      SELECT 1 FROM public.points 
      WHERE student_id = 'ab191d6e-e016-418b-80a1-0b2b25e007c7' 
        AND transaction_type = 'achievement'
        AND reference_id = first_day_achievement_id::text
    ) THEN
      INSERT INTO public.points (
        student_id,
        points,
        transaction_type,
        reference_id,
        description,
        metadata
      ) VALUES (
        'ab191d6e-e016-418b-80a1-0b2b25e007c7',
        10,
        'achievement',
        first_day_achievement_id::text,
        'Achievement unlocked: First Day',
        jsonb_build_object('achievement_id', first_day_achievement_id, 'achievement_name', 'First Day')
      );
    END IF;
    
    RAISE NOTICE 'Awarded "First Day" achievement';
  ELSE
    RAISE NOTICE 'Could not find "First Day" achievement';
  END IF;
END $$;

-- ============================================================================
-- 10. Add Attendance Points
-- ============================================================================

-- Add points for recent attendance (sample)
INSERT INTO public.points (
  student_id,
  points,
  transaction_type,
  reference_id,
  description,
  metadata
)
SELECT 
  'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  10,
  'attendance',
  a.id::text,
  'Attended ' || c.name,
  jsonb_build_object('course_id', c.id, 'course_name', c.name, 'date', a.date)
FROM public.attendance a
JOIN public.courses c ON a.course_id = c.id
WHERE a.student_id = 'ab191d6e-e016-418b-80a1-0b2b25e007c7'
  AND a.status = 'present'
  AND a.date >= CURRENT_DATE - INTERVAL '7 days'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 11. Create Current Streak
-- ============================================================================

INSERT INTO public.streaks (
  student_id,
  current_streak,
  longest_streak,
  last_attendance_date,
  streak_freeze_count
) VALUES (
  'ab191d6e-e016-418b-80a1-0b2b25e007c7',
  5,
  5,
  CURRENT_DATE - INTERVAL '1 day',
  0
) ON CONFLICT (student_id) DO UPDATE SET
  current_streak = EXCLUDED.current_streak,
  longest_streak = EXCLUDED.longest_streak,
  last_attendance_date = EXCLUDED.last_attendance_date;

-- ============================================================================
-- 12. Create Rewards
-- ============================================================================

INSERT INTO public.rewards (
  brand,
  name,
  description,
  points_cost,
  category,
  commission_rate,
  stock,
  expiry_days,
  active,
  metadata
) VALUES
(
  'Campus Cafe',
  'Free Coffee',
  'Redeem for a free coffee at the campus cafe',
  50,
  'food',
  0.10,
  100,
  30,
  true,
  jsonb_build_object('vendor', 'Campus Cafe')
),
(
  'Campus Parking',
  'Premium Parking Pass',
  'One day premium parking pass',
  150,
  'parking',
  0.05,
  20,
  1,
  true,
  jsonb_build_object('duration', '1 day')
),
(
  'Campus Library',
  'Extended Library Hours',
  'Access to 24/7 library for one week',
  200,
  'academic',
  0.00,
  10,
  7,
  true,
  jsonb_build_object('duration', '1 week')
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Summary
-- ============================================================================

DO $$
DECLARE
  total_points INTEGER;
  attendance_count INTEGER;
  achievement_count INTEGER;
BEGIN
  -- Get totals
  SELECT COALESCE(SUM(points), 0) INTO total_points
  FROM public.points
  WHERE student_id = 'ab191d6e-e016-418b-80a1-0b2b25e007c7';
  
  SELECT COUNT(*) INTO attendance_count
  FROM public.attendance
  WHERE student_id = 'ab191d6e-e016-418b-80a1-0b2b25e007c7'
    AND status = 'present';
  
  SELECT COUNT(*) INTO achievement_count
  FROM public.student_achievements
  WHERE student_id = 'ab191d6e-e016-418b-80a1-0b2b25e007c7'
    AND unlocked = true;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Seed Data Summary';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'User ID: ab191d6e-e016-418b-80a1-0b2b25e007c7';
  RAISE NOTICE 'Total Points: %', total_points;
  RAISE NOTICE 'Attendance Records: %', attendance_count;
  RAISE NOTICE 'Achievements Unlocked: %', achievement_count;
  RAISE NOTICE 'Courses Enrolled: 3';
  RAISE NOTICE 'Current Streak: 5 days';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
END $$;
