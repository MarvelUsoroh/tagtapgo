-- ============================================================================
-- Fix HTTP Function Syntax
-- ============================================================================
-- Uses the correct http() function syntax that was working before
-- ============================================================================

-- Unschedule all jobs
SELECT cron.unschedule('gamification-job');
SELECT cron.unschedule('feedback-prompt-job');
SELECT cron.unschedule('feedback-expiry-job');
SELECT cron.unschedule('attendance-sync-job');

-- ============================================================================
-- Fix execute_attendance_sync_job function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.execute_attendance_sync_job()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response JSONB;
BEGIN
  -- Call attendance sync Edge Function using http() function
  SELECT content::jsonb INTO v_response
  FROM http((
    'POST',
    (SELECT public.get_vault_secret('supabase_url')) || '/functions/v1/attendance-sync-job',
    ARRAY[
      http_header('Authorization', 'Bearer ' || (SELECT public.get_vault_secret('service_role_key'))),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    '{}'
  )::http_request);
  
  RAISE NOTICE 'Attendance sync job executed';
END;
$$;

-- ============================================================================
-- Reschedule all jobs with correct http() syntax
-- ============================================================================

-- Gamification Job
SELECT cron.schedule(
  'gamification-job',
  '2,7,12,17,22,27,32,37,42,47,52,57 * * * *',
  $$
  SELECT content::jsonb
  FROM http((
    'POST',
    (SELECT public.get_vault_secret('supabase_url')) || '/functions/v1/gamification-job',
    ARRAY[
      http_header('Authorization', 'Bearer ' || (SELECT public.get_vault_secret('service_role_key'))),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    '{}'
  )::http_request);
  $$
);

-- Feedback Prompt Job
SELECT cron.schedule(
  'feedback-prompt-job',
  '*/5 * * * *',
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

-- Feedback Expiry Job
SELECT cron.schedule(
  'feedback-expiry-job',
  '0 * * * *',
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

-- Attendance Sync Job
SELECT cron.schedule(
  'attendance-sync-job',
  '*/5 * * * *',
  'SELECT public.execute_attendance_sync_job();'
);

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
  v_job_count INTEGER;
BEGIN
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
  RAISE NOTICE 'HTTP Function Syntax Fixed';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE '✓ Using correct http() function syntax';
  RAISE NOTICE '✓ Rescheduled % jobs', v_job_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Jobs should now run successfully!';
  RAISE NOTICE '';
END $$;
