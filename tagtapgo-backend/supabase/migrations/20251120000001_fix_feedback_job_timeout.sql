-- Migration: Fix feedback-prompt-job timeout
-- Description: Increases the timeout for the feedback-prompt-job to 60 seconds to prevent "Operation timed out after 5002 milliseconds" errors.

-- 1. Unschedule the existing job
SELECT cron.unschedule('feedback-prompt-job');

-- 2. Reschedule with increased timeout (60s)
SELECT cron.schedule(
  'feedback-prompt-job',
  '*/5 * * * *', -- Every 5 minutes
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
  )::http_request,
  jsonb_build_object('timeout_msec', 60000) -- Set 60s timeout
  );
  $$
);
