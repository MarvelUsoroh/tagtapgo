-- Migration: Remove SECURITY DEFINER from Views
-- Description: Recreates views with explicit SECURITY INVOKER to remove SECURITY DEFINER property

-- ============================================================================
-- Fix student_points_balance
-- ============================================================================
DROP VIEW IF EXISTS public.student_points_balance CASCADE;
CREATE VIEW public.student_points_balance
WITH (security_invoker=true) AS
SELECT
  p.student_id,
  COALESCE(SUM(p.points), 0) AS total_points
FROM public.points p
GROUP BY p.student_id;

COMMENT ON VIEW public.student_points_balance IS 'Aggregated points balance per student (security_invoker)';

-- ============================================================================
-- Fix achievements_with_progress
-- ============================================================================
DROP VIEW IF EXISTS public.achievements_with_progress CASCADE;
CREATE VIEW public.achievements_with_progress
WITH (security_invoker=true) AS
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

COMMENT ON VIEW public.achievements_with_progress IS 'Achievements with student progress (security_invoker)';

-- ============================================================================
-- Fix cron_job_executions_recent
-- ============================================================================
DROP VIEW IF EXISTS public.cron_job_executions_recent CASCADE;
CREATE VIEW public.cron_job_executions_recent
WITH (security_invoker=true) AS
SELECT 
  jrd.*,
  j.jobname
FROM cron.job_run_details jrd
LEFT JOIN cron.job j ON jrd.jobid = j.jobid
WHERE jrd.end_time >= NOW() - INTERVAL '24 hours'
ORDER BY jrd.end_time DESC
LIMIT 100;

COMMENT ON VIEW public.cron_job_executions_recent IS 'Recent cron job executions (last 24 hours, security_invoker)';

-- ============================================================================
-- Fix cron_job_health
-- ============================================================================
DROP VIEW IF EXISTS public.cron_job_health CASCADE;
CREATE VIEW public.cron_job_health
WITH (security_invoker=true) AS
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

COMMENT ON VIEW public.cron_job_health IS 'Cron job health metrics (last 7 days, security_invoker)';

-- ============================================================================
-- Fix students_display
-- ============================================================================
DROP VIEW IF EXISTS public.students_display CASCADE;
CREATE VIEW public.students_display
WITH (security_invoker=true) AS
SELECT 
  id,
  university_id,
  external_id,
  email,
  username,
  first_name,
  last_name,
  full_name,
  -- Display name: prefer full_name, fallback to username or email
  COALESCE(
    NULLIF(full_name, ''),
    username,
    split_part(email, '@', 1)
  ) AS display_name,
  -- Formal name: Last, First
  CASE 
    WHEN first_name IS NOT NULL AND last_name IS NOT NULL 
    THEN last_name || ', ' || first_name
    ELSE full_name
  END AS formal_name,
  -- Short name: First name or username
  COALESCE(
    first_name,
    username,
    split_part(email, '@', 1)
  ) AS short_name,
  status,
  grade_level,
  student_number,
  year,
  major,
  avatar_url,
  settings,
  metadata,
  created_at,
  updated_at
FROM students;

COMMENT ON VIEW public.students_display IS 'Provides various name formats for display purposes (security_invoker)';

-- ============================================================================
-- Fix brand_performance
-- ============================================================================
DROP VIEW IF EXISTS public.brand_performance CASCADE;
CREATE VIEW public.brand_performance
WITH (security_invoker=true) AS
SELECT 
  ra.brand_id,
  ra.brand_name,
  ra.category,
  
  -- Volume metrics
  COUNT(DISTINCT ra.student_id) as unique_redeemers,
  COUNT(*) as total_redemptions,
  SUM(ra.redemption_value) as total_value,
  
  -- Engagement metrics
  AVG(ra.attendance_rate) as avg_student_attendance,
  AVG(ra.current_streak) as avg_student_streak,
  AVG(ra.repeat_redemption_count) as avg_repeat_rate,
  
  -- Conversion metrics
  AVG(ra.views_before_redemption) as avg_views_to_convert,
  AVG(EXTRACT(EPOCH FROM ra.view_to_redemption_time) / 3600) as avg_hours_to_convert,
  
  -- Time period
  MIN(ra.created_at) as first_redemption,
  MAX(ra.created_at) as last_redemption
FROM redemption_analytics ra
GROUP BY ra.brand_id, ra.brand_name, ra.category;

COMMENT ON VIEW public.brand_performance IS 'Brand partner performance dashboard metrics (security_invoker)';

-- ============================================================================
-- Fix conversion_by_engagement
-- ============================================================================
DROP VIEW IF EXISTS public.conversion_by_engagement CASCADE;
CREATE VIEW public.conversion_by_engagement
WITH (security_invoker=true) AS
SELECT 
  CASE 
    WHEN s.attendance_rate >= 90 THEN 'High (90%+)'
    WHEN s.attendance_rate >= 70 THEN 'Medium (70-89%)'
    ELSE 'Low (<70%)'
  END as engagement_tier,
  
  -- Funnel metrics
  COUNT(DISTINCT rv.student_id) as students_who_viewed,
  COUNT(DISTINCT ra.student_id) as students_who_redeemed,
  ROUND(
    COUNT(DISTINCT ra.student_id)::DECIMAL / 
    NULLIF(COUNT(DISTINCT rv.student_id), 0) * 100, 
    2
  ) as conversion_rate,
  
  -- Value metrics
  AVG(ra.redemption_value) as avg_transaction_value,
  SUM(ra.redemption_value) as total_value,
  
  -- Behavioral metrics
  AVG(ra.repeat_redemption_count) as avg_repeat_rate
FROM (
  SELECT 
    s.id as student_id,
    ROUND(
      (SELECT COUNT(*) FROM attendance WHERE student_id = s.id AND status = 'present')::DECIMAL /
      NULLIF((SELECT COUNT(*) FROM attendance WHERE student_id = s.id), 0) * 100,
      2
    ) as attendance_rate
  FROM students s
) s
LEFT JOIN reward_views rv ON s.student_id = rv.student_id
LEFT JOIN redemption_analytics ra ON s.student_id = ra.student_id
GROUP BY engagement_tier
ORDER BY engagement_tier DESC;

COMMENT ON VIEW public.conversion_by_engagement IS 'Conversion funnel analysis by student engagement tier (security_invoker)';

-- ============================================================================
-- Grant Permissions (ensure they're still accessible)
-- ============================================================================
GRANT SELECT ON public.student_points_balance TO authenticated;
GRANT SELECT ON public.achievements_with_progress TO authenticated;
GRANT SELECT ON public.cron_job_executions_recent TO service_role;
GRANT SELECT ON public.cron_job_health TO service_role;
GRANT SELECT ON public.students_display TO authenticated;
GRANT SELECT ON public.students_display TO service_role;
