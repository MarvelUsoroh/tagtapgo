-- Migration: Fix Supabase Advisor Security and Performance Issues
-- Date: 2024-10-28
-- Description: Addresses ERROR and WARN level issues from Supabase Advisor

-- ============================================
-- PART 1: Fix Security Definer Views (ERROR)
-- ============================================
-- Issue: Views with SECURITY DEFINER bypass RLS policies
-- Solution: Recreate views without SECURITY DEFINER

-- Drop and recreate student_points_balance view
DROP VIEW IF EXISTS public.student_points_balance CASCADE;
CREATE VIEW public.student_points_balance AS
SELECT 
  student_id,
  COALESCE(SUM(points), 0) AS total_points
FROM public.points
GROUP BY student_id;

COMMENT ON VIEW public.student_points_balance IS 'Aggregated points balance per student (without SECURITY DEFINER)';

-- Drop and recreate achievements_with_progress view
DROP VIEW IF EXISTS public.achievements_with_progress CASCADE;
CREATE VIEW public.achievements_with_progress AS
SELECT 
  a.id,
  a.name,
  a.description,
  a.category,
  a.rarity,
  a.points_reward,
  a.created_at,
  sa.id AS student_achievement_id,
  sa.unlocked_at AS student_unlocked_at
FROM public.achievements a
LEFT JOIN public.student_achievements sa ON a.id = sa.achievement_id
  AND sa.student_id = auth.uid();

COMMENT ON VIEW public.achievements_with_progress IS 'Achievements with student progress (without SECURITY DEFINER)';

-- Drop and recreate cron_job_executions_recent view
DROP VIEW IF EXISTS public.cron_job_executions_recent CASCADE;
CREATE VIEW public.cron_job_executions_recent AS
SELECT 
  jrd.*,
  j.jobname
FROM cron.job_run_details jrd
LEFT JOIN cron.job j ON jrd.jobid = j.jobid
WHERE jrd.end_time >= NOW() - INTERVAL '24 hours'
ORDER BY jrd.end_time DESC
LIMIT 100;

COMMENT ON VIEW public.cron_job_executions_recent IS 'Recent cron job executions (last 24 hours, without SECURITY DEFINER)';

-- Drop and recreate sync_alerts_active view (only if sync_alerts table exists)
DROP VIEW IF EXISTS public.sync_alerts_active CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sync_alerts') THEN
    EXECUTE '
      CREATE VIEW public.sync_alerts_active AS
      SELECT *
      FROM public.sync_alerts
      WHERE resolved = FALSE
      ORDER BY created_at DESC
    ';
    
    COMMENT ON VIEW public.sync_alerts_active IS 'Active (unresolved) sync alerts (without SECURITY DEFINER)';
    RAISE NOTICE 'Created sync_alerts_active view';
  ELSE
    RAISE NOTICE 'Skipping sync_alerts_active view - sync_alerts table does not exist';
  END IF;
END $$;

-- Drop and recreate sync_alerts_summary view (only if sync_alerts table exists)
DROP VIEW IF EXISTS public.sync_alerts_summary CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sync_alerts') THEN
    EXECUTE '
      CREATE VIEW public.sync_alerts_summary AS
      SELECT 
        university_id,
        alert_type,
        severity,
        COUNT(*) AS alert_count,
        MAX(created_at) AS last_alert_time
      FROM public.sync_alerts
      WHERE resolved = FALSE
      GROUP BY university_id, alert_type, severity
    ';
    
    COMMENT ON VIEW public.sync_alerts_summary IS 'Summary of active (unresolved) sync alerts by university and type (without SECURITY DEFINER)';
    RAISE NOTICE 'Created sync_alerts_summary view';
  ELSE
    RAISE NOTICE 'Skipping sync_alerts_summary view - sync_alerts table does not exist';
  END IF;
END $$;

-- Drop and recreate cron_job_health view
DROP VIEW IF EXISTS public.cron_job_health CASCADE;
CREATE VIEW public.cron_job_health AS
SELECT 
  j.jobname,
  j.jobid,
  COUNT(*) AS total_runs,
  COUNT(*) FILTER (WHERE jrd.status = 'succeeded') AS successful_runs,
  COUNT(*) FILTER (WHERE jrd.status = 'failed') AS failed_runs,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE jrd.status = 'succeeded') / NULLIF(COUNT(*), 0),
    2
  ) AS success_rate,
  MAX(jrd.end_time) AS last_run_time
FROM cron.job j
LEFT JOIN cron.job_run_details jrd ON j.jobid = jrd.jobid
  AND jrd.end_time >= NOW() - INTERVAL '7 days'
GROUP BY j.jobname, j.jobid;

COMMENT ON VIEW public.cron_job_health IS 'Cron job health metrics (last 7 days, without SECURITY DEFINER)';

-- ============================================
-- PART 2: Fix RLS Performance Issues (WARN)
-- ============================================
-- Issue: auth.uid() is re-evaluated for each row
-- Solution: Replace auth.uid() with (select auth.uid())

-- Fix students table RLS
DROP POLICY IF EXISTS "Students can view own data" ON public.students;
CREATE POLICY "Students can view own data"
  ON public.students
  FOR SELECT
  USING ((select auth.uid()) = id);

-- Fix attendance table RLS
DROP POLICY IF EXISTS "Students can view own attendance" ON public.attendance;
CREATE POLICY "Students can view own attendance"
  ON public.attendance
  FOR SELECT
  USING ((select auth.uid()) = student_id);

-- Fix streaks table RLS
DROP POLICY IF EXISTS "Students can view own streaks" ON public.streaks;
CREATE POLICY "Students can view own streaks"
  ON public.streaks
  FOR SELECT
  USING ((select auth.uid()) = student_id);

-- Fix student_achievements table RLS
DROP POLICY IF EXISTS "Students can view own achievements" ON public.student_achievements;
CREATE POLICY "Students can view own achievements"
  ON public.student_achievements
  FOR SELECT
  USING ((select auth.uid()) = student_id);

-- Fix notifications table RLS (SELECT)
DROP POLICY IF EXISTS "Students can view own notifications" ON public.notifications;
CREATE POLICY "Students can view own notifications"
  ON public.notifications
  FOR SELECT
  USING ((select auth.uid()) = student_id);

-- Fix notifications table RLS (UPDATE)
DROP POLICY IF EXISTS "Students can update own notifications" ON public.notifications;
CREATE POLICY "Students can update own notifications"
  ON public.notifications
  FOR UPDATE
  USING ((select auth.uid()) = student_id);

-- Fix class_schedules table RLS
-- Note: class_schedules doesn't have student_id, students access via enrollments
DROP POLICY IF EXISTS "class_schedules_select_own" ON public.class_schedules;
CREATE POLICY "class_schedules_select_own"
  ON public.class_schedules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = class_schedules.course_id
        AND e.student_id = (select auth.uid())
    )
  );

-- Fix classes table RLS
-- Note: Students access classes through enrollments, not directly through schedules
DROP POLICY IF EXISTS "classes_select_via_schedule_or_enrollment" ON public.classes;
CREATE POLICY "classes_select_via_schedule_or_enrollment"
  ON public.classes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = classes.course_id
        AND e.student_id = (select auth.uid())
    )
  );

-- Fix courses table RLS
DROP POLICY IF EXISTS "courses_select_enrolled_or_attendance" ON public.courses;
CREATE POLICY "courses_select_enrolled_or_attendance"
  ON public.courses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = courses.id
        AND e.student_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.attendance a
      WHERE a.course_id = courses.id
        AND a.student_id = (select auth.uid())
    )
  );

-- Fix class_feedback table RLS (SELECT)
DROP POLICY IF EXISTS "Students can read own feedback" ON public.class_feedback;
CREATE POLICY "Students can read own feedback"
  ON public.class_feedback
  FOR SELECT
  USING ((select auth.uid()) = student_id);

-- Fix class_feedback table RLS (INSERT)
DROP POLICY IF EXISTS "Students can insert own feedback" ON public.class_feedback;
CREATE POLICY "Students can insert own feedback"
  ON public.class_feedback
  FOR INSERT
  WITH CHECK ((select auth.uid()) = student_id);

-- Fix class_feedback table RLS (Service role)
DROP POLICY IF EXISTS "Service role has full access to feedback" ON public.class_feedback;
CREATE POLICY "Service role has full access to feedback"
  ON public.class_feedback
  FOR ALL
  USING ((select auth.role()) = 'service_role');

-- Fix feedback_prompts table RLS (SELECT)
DROP POLICY IF EXISTS "Students can read own prompts" ON public.feedback_prompts;
CREATE POLICY "Students can read own prompts"
  ON public.feedback_prompts
  FOR SELECT
  USING ((select auth.uid()) = student_id);

-- Fix feedback_prompts table RLS (UPDATE)
DROP POLICY IF EXISTS "Students can update own prompts" ON public.feedback_prompts;
CREATE POLICY "Students can update own prompts"
  ON public.feedback_prompts
  FOR UPDATE
  USING ((select auth.uid()) = student_id);

-- Fix feedback_prompts table RLS (Service role)
DROP POLICY IF EXISTS "Service role has full access to prompts" ON public.feedback_prompts;
CREATE POLICY "Service role has full access to prompts"
  ON public.feedback_prompts
  FOR ALL
  USING ((select auth.role()) = 'service_role');

-- Fix redemptions table RLS (SELECT)
DROP POLICY IF EXISTS "Students can view own redemptions" ON public.redemptions;
CREATE POLICY "Students can view own redemptions"
  ON public.redemptions
  FOR SELECT
  USING ((select auth.uid()) = student_id);

-- Fix redemptions table RLS (INSERT)
DROP POLICY IF EXISTS "Students can insert own redemptions" ON public.redemptions;
CREATE POLICY "Students can insert own redemptions"
  ON public.redemptions
  FOR INSERT
  WITH CHECK ((select auth.uid()) = student_id);

-- Fix redemptions table RLS (UPDATE)
DROP POLICY IF EXISTS "Students can update own redemptions" ON public.redemptions;
CREATE POLICY "Students can update own redemptions"
  ON public.redemptions
  FOR UPDATE
  USING ((select auth.uid()) = student_id);

-- Fix points table RLS (SELECT)
DROP POLICY IF EXISTS "Students can view own points" ON public.points;
CREATE POLICY "Students can view own points"
  ON public.points
  FOR SELECT
  USING ((select auth.uid()) = student_id);

-- Fix points table RLS (INSERT)
DROP POLICY IF EXISTS "Students can insert own points" ON public.points;
CREATE POLICY "Students can insert own points"
  ON public.points
  FOR INSERT
  WITH CHECK ((select auth.uid()) = student_id);

-- Fix leaderboards table RLS
DROP POLICY IF EXISTS "select_same_university" ON public.leaderboards;
CREATE POLICY "select_same_university"
  ON public.leaderboards
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = (select auth.uid())
        AND s.university_id = leaderboards.university_id
    )
  );

-- ============================================
-- PART 3: Remove Duplicate RLS Policies (WARN)
-- ============================================
-- Issue: Multiple permissive policies for same role/action
-- Solution: Keep only one policy per role/action

-- Remove duplicate notification policies (keep the newer ones)
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

-- The "Students can view/update own notifications" policies are already fixed above

-- ============================================
-- PART 4: Fix Function Search Paths (WARN)
-- ============================================
-- Issue: Functions without fixed search_path are vulnerable
-- Solution: Add SET search_path = public, pg_temp to all functions

-- Fix get_achievements_stats
CREATE OR REPLACE FUNCTION public.get_achievements_stats(p_student_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_achievements', COUNT(*),
    'unlocked_count', COUNT(*) FILTER (WHERE sa.unlocked_at IS NOT NULL),
    'total_points', COALESCE(SUM(a.points_reward) FILTER (WHERE sa.unlocked_at IS NOT NULL), 0)
  )
  INTO result
  FROM public.achievements a
  LEFT JOIN public.student_achievements sa ON a.id = sa.achievement_id AND sa.student_id = p_student_id;
  
  RETURN result;
END;
$$;

-- Fix update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix set_unlocked_from_unlocked_at
CREATE OR REPLACE FUNCTION public.set_unlocked_from_unlocked_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.unlocked_at IS NOT NULL THEN
    NEW.unlocked = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix generate_redemption_code
CREATE OR REPLACE FUNCTION public.generate_redemption_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    
    SELECT EXISTS(SELECT 1 FROM public.redemptions WHERE redemption_code = code) INTO exists;
    
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN code;
END;
$$;

-- Fix set_redemption_code
CREATE OR REPLACE FUNCTION public.set_redemption_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.redemption_code IS NULL THEN
    NEW.redemption_code := public.generate_redemption_code();
  END IF;
  RETURN NEW;
END;
$$;

-- Note: Other functions (vault, sync, alert functions) require more complex refactoring
-- and should be addressed in a separate migration to avoid breaking existing functionality

-- ============================================
-- PART 5: Move HTTP Extension (WARN)
-- ============================================
-- Issue: http extension in public schema
-- Solution: Move to extensions schema

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move http extension to extensions schema
-- Note: This requires superuser privileges and may need to be done manually
-- ALTER EXTENSION http SET SCHEMA extensions;

-- For now, add a comment noting this needs manual intervention
COMMENT ON EXTENSION http IS 'HTTP extension - should be moved to extensions schema manually by superuser';

-- ============================================
-- PART 6: Add Indexes for Performance
-- ============================================
-- Add missing indexes to support RLS policies

-- Index for student_achievements lookups
CREATE INDEX IF NOT EXISTS idx_student_achievements_student_achievement 
  ON public.student_achievements(student_id, achievement_id);

-- Index for class_schedules lookups (no student_id column exists)
-- Note: class_schedules already has idx_class_schedules_course_day index
-- CREATE INDEX IF NOT EXISTS idx_class_schedules_course_class
--   ON public.class_schedules(course_id, class_id);

-- Index for enrollments student lookups  
CREATE INDEX IF NOT EXISTS idx_enrollments_student_course
  ON public.enrollments(student_id, course_id);

-- Index for attendance student lookups
CREATE INDEX IF NOT EXISTS idx_attendance_student_course
  ON public.attendance(student_id, course_id);

-- ============================================
-- PART 7: Grant Permissions
-- ============================================
-- Ensure proper permissions on views

GRANT SELECT ON public.student_points_balance TO authenticated;
GRANT SELECT ON public.achievements_with_progress TO authenticated;
GRANT SELECT ON public.cron_job_executions_recent TO service_role;

-- Grant permissions on sync_alerts views only if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'sync_alerts_active') THEN
    GRANT SELECT ON public.sync_alerts_active TO service_role;
    RAISE NOTICE 'Granted SELECT on sync_alerts_active to service_role';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'sync_alerts_summary') THEN
    GRANT SELECT ON public.sync_alerts_summary TO service_role;
    RAISE NOTICE 'Granted SELECT on sync_alerts_summary to service_role';
  END IF;
END $$;

GRANT SELECT ON public.cron_job_health TO service_role;

-- ============================================
-- Migration Complete
-- ============================================

COMMENT ON SCHEMA public IS 'Fixed Supabase Advisor issues: Security Definer views, RLS performance, duplicate policies, function search paths';
