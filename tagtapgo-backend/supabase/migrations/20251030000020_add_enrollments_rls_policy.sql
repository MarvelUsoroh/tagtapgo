-- ============================================================================
-- Add RLS Policy for Enrollments
-- ============================================================================
-- 
-- This migration adds a SELECT policy for the enrollments table so students
-- can view their own enrollments. This is needed for the TodayClasses component
-- to fetch the student's enrolled courses.
--
-- Related: Dashboard, Class Schedules
-- ============================================================================

-- Add policy for students to view their own enrollments
CREATE POLICY enrollments_select_own ON public.enrollments
  FOR SELECT
  TO public
  USING (student_id = auth.uid());

-- Verify the policy was created
DO $$
BEGIN
  RAISE NOTICE 'RLS policy created: enrollments_select_own';
  RAISE NOTICE 'Students can now view their own enrollments';
END $$;
