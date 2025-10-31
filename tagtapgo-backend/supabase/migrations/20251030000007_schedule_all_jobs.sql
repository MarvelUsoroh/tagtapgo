-- ============================================================================
-- Schedule All Missing Jobs
-- ============================================================================
-- This migration ensures all required cron jobs are scheduled:
-- 1. attendance-sync-job (every 5 minutes)
-- 2. feedback-prompt-job (every 5 minutes)
-- 3. feedback-expiry-job (every hour)
-- 4. gamification-job (already scheduled, verify)
-- ============================================================================

-- Unschedule existing jobs to avoid duplicates
SELECT cron.unschedule('attendance-sync-job') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'attendance-sync-job');

SELECT cron.unschedule('feedback-prompt-job') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'feedback-prompt-job');

SELECT cron.unschedule('feedback-expiry-job') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'feedback-expiry-job');

-- ============================================================================
-- 1. Schedule Attendance Sync Job
-- ============================================================================
-- Runs every 5 minutes to sync attendance data from SIS/LMS
-- Uses public.execute_attendance_sync_job() function with Vault credentials

SELECT cron.schedule(
  'attendance-sync-job',
  '*/5 * * * *',  -- Every 5 minutes
  'SELECT public.execute_attendance_sync_job();'
);

COMMENT ON EXTENSION pg_cron IS 'Attendance sync job scheduled to run every 5 minutes';

-- ============================================================================
-- 2. Schedule Feedback Prompt Job
-- ============================================================================
-- Runs every 5 minutes to create feedback prompts for classes that ended 15-20 min ago

SELECT cron.schedule(
  'feedback-prompt-job',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT content::jsonb
  FROM http((
    'POST',
    (SELECT public.get_vault_secret('supabase_url')) || '/functions/v1/feedback-prompt-job',
    ARRAY[
      http_header('Authorization', 'Bearer ' || (SELECT public.get_vault_secret('service_role_key'))),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    '{}'
  )::http_request);
  $$
);

-- ============================================================================
-- 3. Schedule Feedback Expiry Job
-- ============================================================================
-- Runs every hour to expire pending feedback prompts after 24 hours

SELECT cron.schedule(
  'feedback-expiry-job',
  '0 * * * *',  -- Every hour at :00
  $$
  SELECT content::jsonb
  FROM http((
    'POST',
    (SELECT public.get_vault_secret('supabase_url')) || '/functions/v1/feedback-expiry-job',
    ARRAY[
      http_header('Authorization', 'Bearer ' || (SELECT public.get_vault_secret('service_role_key'))),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    '{}'
  )::http_request);
  $$
);

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
  v_job_count INTEGER;
BEGIN
  -- Count scheduled jobs
  SELECT COUNT(*) INTO v_job_count
  FROM cron.job
  WHERE jobname IN (
    'attendance-sync-job',
    'feedback-prompt-job',
    'feedback-expiry-job',
    'gamification-job'
  );
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Job Scheduling Complete';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE '✓ Scheduled % jobs:', v_job_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Jobs:';
  RAISE NOTICE '  1. attendance-sync-job   - Every 5 minutes';
  RAISE NOTICE '  2. feedback-prompt-job   - Every 5 minutes';
  RAISE NOTICE '  3. feedback-expiry-job   - Every hour';
  RAISE NOTICE '  4. gamification-job      - Every 5 minutes (offset)';
  RAISE NOTICE '';
  RAISE NOTICE 'Verify with:';
  RAISE NOTICE '  SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;';
  RAISE NOTICE '';
  
  IF v_job_count < 4 THEN
    RAISE WARNING 'Expected 4 jobs but found %. Check for errors above.', v_job_count;
  END IF;
END $$;
