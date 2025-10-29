-- Fix gamification cron job to use http extension instead of net extension
-- The net.http_post() function doesn't exist - should use http() function instead
-- This matches the pattern used by attendance-sync-job

-- First, unschedule the existing job (if it exists)
SELECT cron.unschedule('gamification-job')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'gamification-job'
);

-- Re-schedule gamification job using http extension (same as attendance-sync-job)
SELECT cron.schedule(
  'gamification-job',
  '2,7,12,17,22,27,32,37,42,47,52,57 * * * *', -- Every 5 minutes at :02, :07, :12, etc.
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

-- Verify cron job was updated
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'gamification-job'
  ) THEN
    RAISE NOTICE '✓ Gamification cron job fixed to use http extension';
  ELSE
    RAISE WARNING '✗ Failed to update gamification cron job';
  END IF;
END $$;

-- Add helpful comment
COMMENT ON EXTENSION pg_cron IS 'Gamification job scheduled to run every 5 minutes using http extension for Edge Function calls';
