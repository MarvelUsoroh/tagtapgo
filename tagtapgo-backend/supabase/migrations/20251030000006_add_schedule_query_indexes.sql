-- Migration: Add indexes for schedule query performance
-- Purpose: Optimize queries that join enrollments → courses → class_schedules
-- Requirements: 7.2, 7.3, 7.7
-- Date: 2024-10-30

-- ============================================================================
-- Enrollment Indexes
-- ============================================================================

-- Index for finding enrollments by student (used in getStudentSchedulesForDate)
-- Composite index on (student_id, course_id, status) for efficient filtering
CREATE INDEX IF NOT EXISTS idx_enrollments_student_course_status 
  ON public.enrollments(student_id, course_id, status);

-- Index for finding enrollments by course (used in getStudentsForClassSchedule)
-- Composite index on (course_id, status) for reverse lookups
CREATE INDEX IF NOT EXISTS idx_enrollments_course_status 
  ON public.enrollments(course_id, status);

-- ============================================================================
-- Class Schedule Indexes
-- ============================================================================

-- Index for finding schedules by course and day (used in schedule queries)
-- Note: idx_class_schedules_course_day already exists in baseline schema
-- This is a verification check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_class_schedules_course_day'
  ) THEN
    CREATE INDEX idx_class_schedules_course_day 
      ON public.class_schedules(course_id, day_of_week);
  END IF;
END $$;

-- Index for filtering by effective date range
-- Note: idx_class_schedules_effective already exists in baseline schema
-- This is a verification check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_class_schedules_effective'
  ) THEN
    CREATE INDEX idx_class_schedules_effective 
      ON public.class_schedules(effective_from, effective_to);
  END IF;
END $$;

-- ============================================================================
-- Attendance Indexes
-- ============================================================================

-- Index for batch attendance queries (used in feedback prompt job)
-- Composite index on (course_id, date, status) for efficient filtering
CREATE INDEX IF NOT EXISTS idx_attendance_course_date_status 
  ON public.attendance(course_id, date, status);

-- Index for checking student attendance on specific date
-- Composite index on (student_id, date, status) for streak checks
CREATE INDEX IF NOT EXISTS idx_attendance_student_date_status 
  ON public.attendance(student_id, date, status);

-- ============================================================================
-- Index Documentation
-- ============================================================================

COMMENT ON INDEX idx_enrollments_student_course_status IS 
  'Optimizes queries finding student enrollments by student_id and status. Used in getStudentSchedulesForDate().';

COMMENT ON INDEX idx_enrollments_course_status IS 
  'Optimizes queries finding students enrolled in a course. Used in getStudentsForClassSchedule().';

COMMENT ON INDEX idx_attendance_course_date_status IS 
  'Optimizes batch attendance queries for feedback prompt job. Filters by course, date, and status.';

COMMENT ON INDEX idx_attendance_student_date_status IS 
  'Optimizes student attendance checks for streak calculations. Filters by student, date, and status.';

-- ============================================================================
-- Performance Notes
-- ============================================================================

-- These indexes support the following query patterns:
--
-- 1. Find student's schedules:
--    enrollments (student_id, status) → courses → class_schedules (course_id, day_of_week)
--
-- 2. Find students for schedule:
--    class_schedules → courses → enrollments (course_id, status)
--
-- 3. Batch attendance check:
--    attendance (course_id, date, status) WHERE student_id IN (...)
--
-- 4. Student attendance check:
--    attendance (student_id, date, status)
--
-- Expected performance improvements:
-- - Feedback prompt job: < 30 seconds for 1000 students
-- - Streak notification job: < 60 seconds for 1000 students
-- - Individual schedule queries: < 100ms per student
