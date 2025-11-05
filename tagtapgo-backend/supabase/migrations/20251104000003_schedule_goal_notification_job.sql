-- ============================================================================
-- Schedule Goal Notification Job
-- ============================================================================
-- Purpose:
--   Schedule the goal-notification-job Edge Function to run periodically
--   to check goal progress and send notifications.
--
-- Schedule:
--   - Every 6 hours for goal achievement and behind checks
--   - Sunday evening (18:00 UTC) for weekly progress updates
-- ============================================================================

-- Create helper function to invoke goal notification job
CREATE OR REPLACE FUNCTION public.invoke_goal_notification_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  service_role_key TEXT;
  project_url TEXT;
  response_status INTEGER;
  response_body TEXT;
BEGIN
  -- Get service role key from vault
  SELECT decrypted_secret INTO service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  -- Get project URL from vault
  SELECT decrypted_secret INTO project_url
  FROM vault.decrypted_secrets
  WHERE name = 'project_url'
  LIMIT 1;

  IF service_role_key IS NULL OR project_url IS NULL THEN
    RAISE WARNING 'Missing service_role_key or project_url in vault';
    RETURN;
  END IF;

  -- Invoke the Edge Function
  SELECT status, content::text INTO response_status, response_body
  FROM http((
    'POST',
    project_url || '/functions/v1/goal-notification-job',
    ARRAY[
      http_header('Authorization', 'Bearer ' || service_role_key),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    '{}'
  )::http_request);

  IF response_status >= 200 AND response_status < 300 THEN
    RAISE NOTICE 'Goal notification job completed successfully: %', response_body;
  ELSE
    RAISE WARNING 'Goal notification job failed with status %: %', response_status, response_body;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error invoking goal notification job: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.invoke_goal_notification_job() IS 
'Invokes the goal-notification-job Edge Function to check goal progress and send notifications.';

-- Schedule the job to run every 6 hours
SELECT cron.schedule(
  'goal-notification-job-6h',
  '0 */6 * * *', -- Every 6 hours at minute 0
  $$SELECT public.invoke_goal_notification_job();$$
);

-- Schedule a special run on Sunday evening (18:00 UTC) for weekly progress updates
SELECT cron.schedule(
  'goal-notification-job-sunday',
  '0 18 * * 0', -- Every Sunday at 18:00 UTC
  $$SELECT public.invoke_goal_notification_job();$$
);

-- Log the scheduling
DO $$
BEGIN
  RAISE NOTICE 'Goal notification job scheduled:';
  RAISE NOTICE '  - Every 6 hours for goal checks';
  RAISE NOTICE '  - Sunday 18:00 UTC for weekly progress updates';
END $$;
