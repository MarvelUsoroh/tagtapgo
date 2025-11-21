-- Migration: Switch all cron jobs to pg_net
-- Description: Switches all cron jobs to use pg_net (asynchronous) instead of pgsql-http (synchronous) to avoid timeouts.

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";

-- ============================================================================
-- 1. Update Helper Functions to use pg_net
-- ============================================================================

-- Update execute_attendance_sync_job
CREATE OR REPLACE FUNCTION public.execute_attendance_sync_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url text;
  v_service_key text;
BEGIN
  -- Get secrets from Vault
  v_supabase_url := public.get_vault_secret('supabase_url');
  v_service_key := public.get_vault_secret('service_role_key');

  -- Call Edge Function using pg_net (async)
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/attendance-sync-job',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Update invoke_goal_notification_job
CREATE OR REPLACE FUNCTION public.invoke_goal_notification_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url text;
  v_service_key text;
BEGIN
  -- Get secrets from Vault
  v_supabase_url := public.get_vault_secret('supabase_url');
  v_service_key := public.get_vault_secret('service_role_key');

  -- Call Edge Function using pg_net (async)
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/goal-notification-job',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- ============================================================================
-- 2. Update Cron Schedules to use pg_net directly (for jobs without helper functions)
-- ============================================================================

-- Update feedback-prompt-job
SELECT cron.unschedule('feedback-prompt-job');
SELECT cron.schedule(
  'feedback-prompt-job',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT public.get_vault_secret('supabase_url')) || '/functions/v1/feedback-prompt-job',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT public.get_vault_secret('service_role_key'))
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Update gamification-job
SELECT cron.unschedule('gamification-job');
SELECT cron.schedule(
  'gamification-job',
  '2,7,12,17,22,27,32,37,42,47,52,57 * * * *', -- Every 5 minutes, offset by 2
  $$
  SELECT net.http_post(
    url := (SELECT public.get_vault_secret('supabase_url')) || '/functions/v1/gamification-job',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT public.get_vault_secret('service_role_key'))
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Update feedback-expiry-job
SELECT cron.unschedule('feedback-expiry-job');
SELECT cron.schedule(
  'feedback-expiry-job',
  '0 * * * *', -- Every hour
  $$
  SELECT net.http_post(
    url := (SELECT public.get_vault_secret('supabase_url')) || '/functions/v1/feedback-expiry-job',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT public.get_vault_secret('service_role_key'))
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Note: attendance-sync-job and goal-notification-job schedules don't need to change
-- because they call the helper functions we just updated.
