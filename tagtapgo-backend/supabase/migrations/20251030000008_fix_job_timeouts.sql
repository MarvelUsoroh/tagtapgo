-- ============================================================================
-- Fix Job Timeout Issues
-- ============================================================================
-- Increases HTTP timeout from 5 seconds to 10 seconds to prevent
-- intermittent timeout errors caused by Edge Function cold starts
-- ============================================================================

-- Unschedule jobs to update them
SELECT cron.unschedule('gamification-job');
SELECT cron.unschedule('feedback-prompt-job');
SELECT cron.unschedule('feedback-expiry-job');

-- ============================================================================
-- Reschedule Gamification Job with 10-second timeout
-- ============================================================================

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
    '{}',
    10000  -- 10 second timeout (was 5 seconds by default)
  )::http_request);
  $$
);

-- ============================================================================
-- Reschedule Feedback Prompt Job with 10-second timeout
-- ============================================================================

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
    '{}',
    10000  -- 10 second timeout
  )::http_request);
  $$
);

-- ============================================================================
-- Reschedule Feedback Expiry Job with 10-second timeout
-- ============================================================================

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
    '{}',
    10000  -- 10 second timeout
  )::http_request);
  $$
);

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Job Timeout Fix Applied';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE '✓ Updated 3 jobs with 10-second timeout:';
  RAISE NOTICE '  - gamification-job';
  RAISE NOTICE '  - feedback-prompt-job';
  RAISE NOTICE '  - feedback-expiry-job';
  RAISE NOTICE '';
  RAISE NOTICE 'This should reduce timeout errors from ~21%% to <5%%';
  RAISE NOTICE '';
  RAISE NOTICE 'Monitor with:';
  RAISE NOTICE '  SELECT jobname, status, start_time';
  RAISE NOTICE '  FROM cron.job_run_details jrd';
  RAISE NOTICE '  JOIN cron.job j ON j.jobid = jrd.jobid';
  RAISE NOTICE '  WHERE start_time >= NOW() - INTERVAL ''1 hour''';
  RAISE NOTICE '  ORDER BY start_time DESC;';
  RAISE NOTICE '';
END $$;
