-- Optimize attendance sync job to use pg_net (async) instead of http (sync)
-- This prevents timeouts for long-running sync jobs and aligns with the gamification job pattern.

-- Unschedule the existing job (which used the blocking execute_attendance_sync_job function)
SELECT cron.unschedule('attendance-sync-job');

-- Schedule the job using pg_net directly
-- This is non-blocking and robust against timeouts
SELECT cron.schedule(
  'attendance-sync-job',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := public.get_vault_secret('supabase_url') || '/functions/v1/attendance-sync-job',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || public.get_vault_secret('service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Note: We are bypassing the 'execute_attendance_sync_job' wrapper function.
-- This means 'cron_job_executions' table will no longer be populated by the SQL job.
-- Monitoring should be done via Supabase Dashboard > Edge Functions > Logs.
