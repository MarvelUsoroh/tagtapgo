
-- Unschedule jobs related to feedback
SELECT cron.unschedule('feedback-prompt-job');
SELECT cron.unschedule('feedback-expiry-job');

-- Drop tables
DROP TABLE IF EXISTS public.feedback_messages CASCADE;
DROP TABLE IF EXISTS public.feedback_conversations CASCADE;
DROP TABLE IF EXISTS public.feedback_prompts CASCADE;
DROP TABLE IF EXISTS public.class_feedback CASCADE;

