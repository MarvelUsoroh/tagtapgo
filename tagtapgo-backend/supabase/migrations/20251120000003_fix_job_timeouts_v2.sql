-- Migration: Fix Job Timeouts (v2)
-- Description: Uses http_set_curlopt to correctly set timeouts for cron jobs.

-- 1. Fix feedback-prompt-job
SELECT cron.unschedule('feedback-prompt-job');
SELECT cron.schedule(
  'feedback-prompt-job',
  '*/5 * * * *',
  $$
  WITH settings AS (
    SELECT http_set_curlopt('CURLOPT_TIMEOUT_MS', '60000')
  )
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
  )::http_request)
  CROSS JOIN settings;
  $$
);

-- 2. Fix gamification-job (also timing out)
SELECT cron.unschedule('gamification-job');
SELECT cron.schedule(
  'gamification-job',
  '2,7,12,17,22,27,32,37,42,47,52,57 * * * *', -- Every 5 minutes, offset by 2
  $$
  WITH settings AS (
    SELECT http_set_curlopt('CURLOPT_TIMEOUT_MS', '60000')
  )
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
  )::http_request)
  CROSS JOIN settings;
  $$
);
