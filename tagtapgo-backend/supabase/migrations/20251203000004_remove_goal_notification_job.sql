-- Migration: Remove Goal Notification Job
-- Description: Removes the invoke_goal_notification_job function and its scheduled cron jobs

-- Unschedule the cron jobs
SELECT cron.unschedule('goal-notification-job-6h') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'goal-notification-job-6h');

SELECT cron.unschedule('goal-notification-job-sunday') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'goal-notification-job-sunday');

-- Drop the function
DROP FUNCTION IF EXISTS public.invoke_goal_notification_job();

-- Log the removal
DO $$
BEGIN
  RAISE NOTICE 'Goal notification job feature removed:';
  RAISE NOTICE '  - Unscheduled cron jobs';
  RAISE NOTICE '  - Dropped invoke_goal_notification_job function';
END $$;
