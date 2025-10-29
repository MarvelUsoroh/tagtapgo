-- Fix gamification cron job to use correct vault function name
-- The previous migration used vault.get_decrypted_secret() which doesn't exist
-- The correct function is public.get_vault_secret()

-- First, unschedule the existing job (if it exists)
SELECT cron.unschedule('gamification-job')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'gamification-job'
);

-- Re-schedule gamification job using correct vault function
SELECT cron.schedule(
  'gamification-job',
  '2,7,12,17,22,27,32,37,42,47,52,57 * * * *', -- Every 5 minutes at :02, :07, :12, etc.
  $$
  SELECT
    net.http_post(
      url := public.get_vault_secret('supabase_url') || '/functions/v1/gamification-job',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || public.get_vault_secret('service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Verify cron job was updated
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'gamification-job'
  ) THEN
    RAISE NOTICE '✓ Gamification cron job fixed to use public.get_vault_secret()';
  ELSE
    RAISE WARNING '✗ Failed to update gamification cron job';
  END IF;
END $$;

-- Add helpful comment
COMMENT ON EXTENSION pg_cron IS 'Gamification job scheduled to run every 5 minutes using public.get_vault_secret() for secure credential access';
