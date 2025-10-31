-- ============================================================================
-- Fix Job Syntax Errors
-- ============================================================================
-- Fixes two issues:
-- 1. HTTP request casting error (timeout parameter syntax)
-- 2. Missing execute_attendance_sync_job function
-- ============================================================================

-- ============================================================================
-- Create execute_attendance_sync_job function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.execute_attendance_sync_job()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_response JSONB;
BEGIN
  -- Get credentials from Vault
  v_supabase_url := public.get_vault_secret('supabase_url');
  v_service_key := public.get_vault_secret('service_role_key');
  
  -- Call attendance sync Edge Function
  SELECT content::jsonb INTO v_response
  FROM http_post(
    v_supabase_url || '/functions/v1/attendance-sync-job',
    '{}',
    'application/json',
    ARRAY[
      http_header('Authorization', 'Bearer ' || v_service_key),
      http_header('Content-Type', 'application/json')
    ]
  );
  
  RAISE NOTICE 'Attendance sync job executed: %', v_response;
END;
$$;

-- ============================================================================
-- Unschedule all jobs to fix them
-- ============================================================================

SELECT cron.unschedule('gamification-job');
SELECT cron.unschedule('feedback-prompt-job');
SELECT cron.unschedule('feedback-expiry-job');
SELECT cron.unschedule('attendance-sync-job');

-- ============================================================================
-- Reschedule jobs with correct syntax (no timeout parameter)
-- ============================================================================

-- Gamification Job
SELECT cron.schedule(
  'gamification-job',
  '2,7,12,17,22,27,32,37,42,47,52,57 * * * *',
  $$
  SELECT content::jsonb
  FROM http_post(
    (SELECT public.get_vault_secret('supabase_url')) || '/functions/v1/gamification-job',
    '{}',
    'application/json',
    ARRAY[
      http_header('Authorization', 'Bearer ' || (SELECT public.get_vault_secret('service_role_key'))),
      http_header('Content-Type', 'application/json')
    ]
  );
  $$
);

-- Feedback Prompt Job
SELECT cron.schedule(
  'feedback-prompt-job',
  '*/5 * * * *',
  $$
  SELECT content::jsonb
  FROM http_post(
    (SELECT public.get_vault_secret('supabase_url')) || '/functions/v1/feedback-prompt-job',
    '{}',
    'application/json',
    ARRAY[
      http_header('Authorization', 'Bearer ' || (SELECT public.get_vault_secret('service_role_key'))),
      http_header('Content-Type', 'application/json')
    ]
  );
  $$
);

-- Feedback Expiry Job
SELECT cron.schedule(
  'feedback-expiry-job',
  '0 * * * *',
  $$
  SELECT content::jsonb
  FROM http_post(
    (SELECT public.get_vault_secret('supabase_url')) || '/functions/v1/feedback-expiry-job',
    '{}',
    'application/json',
    ARRAY[
      http_header('Authorization', 'Bearer ' || (SELECT public.get_vault_secret('service_role_key'))),
      http_header('Content-Type', 'application/json')
    ]
  );
  $$
);

-- Attendance Sync Job (uses function)
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
  RAISE NOTICE 'Job Syntax Errors Fixed';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE '✓ Fixed HTTP request casting errors';
  RAISE NOTICE '✓ Created execute_attendance_sync_job function';
  RAISE NOTICE '✓ Rescheduled % jobs with correct syntax', v_job_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Note: Using http_post() instead of http() for better compatibility';
  RAISE NOTICE '';
END $$;
