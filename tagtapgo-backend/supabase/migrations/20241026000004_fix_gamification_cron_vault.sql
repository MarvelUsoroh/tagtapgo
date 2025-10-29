-- Fix gamification cron job to use Supabase Vault instead of app settings
-- This ensures secure access to service role key

-- First, unschedule the existing job (if it exists)
SELECT cron.unschedule('gamification-job');

-- Re-schedule gamification job using Vault for secure credential access
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
    RAISE NOTICE 'Gamification cron job updated successfully to use Vault';
  ELSE
    RAISE WARNING 'Failed to update gamification cron job';
  END IF;
END $$;

-- Add helpful comment
COMMENT ON EXTENSION pg_cron IS 'Gamification job scheduled to run every 5 minutes using Supabase Vault for secure credential access';
