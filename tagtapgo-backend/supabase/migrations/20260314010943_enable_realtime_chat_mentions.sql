-- Add the chat_mentions table to the supabase_realtime publication
-- This allows the frontend to listen to INSERT/UPDATE events for the unread badge
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_mentions;
