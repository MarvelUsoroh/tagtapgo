-- Setup cron job for gamification engine
-- Runs every 5 minutes after attendance sync completes

-- Ensure pg_cron extension is enabled (should already be enabled from previous migration)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule gamification job (every 5 minutes, offset by 2 minutes after attendance sync)
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

-- Add comment for documentation
-- Note: pg_cron extension is used for scheduling

-- Verify cron job was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'gamification-job'
  ) THEN
    RAISE NOTICE 'Gamification cron job created successfully';
  ELSE
    RAISE WARNING 'Failed to create gamification cron job';
  END IF;
END $$;
