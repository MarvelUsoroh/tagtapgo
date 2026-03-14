-- Enable REPLICA IDENTITY FULL on chat_reactions so that DELETE events
-- include the full row payload, not just the ID. This lets the frontend
-- know *which* message and emoji was un-reacted.
ALTER TABLE public.chat_reactions REPLICA IDENTITY FULL;

-- We'll do the same for chat_messages just in case we need to know
-- original content before an UPDATE/DELETE, though not strictly required
-- for the MVP soft-delete pattern we just implemented.
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
