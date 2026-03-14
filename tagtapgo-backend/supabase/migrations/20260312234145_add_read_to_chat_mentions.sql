-- Add boolean read column for tracking if user saw the mention inside the chat UI
ALTER TABLE public.chat_mentions
ADD COLUMN read BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.chat_mentions.read IS 'Whether the user has seen this mention in the chat UI. Used for badges.';
