-- ============================================================================
-- Community Chat Tables Migration
-- ============================================================================
-- Purpose:
--   Create tables for university-scoped community chat with:
--   - Unified feed with #course-tag targeting
--   - Thread replies
--   - Emoji reactions
--   - @mentions with class-aware notifications
--   - Full-text search
-- ============================================================================

-- --------------------------------------------------------------------------
-- Main Messages Table
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE public.chat_messages IS 'University community chat messages with optional course targeting and threading.';
COMMENT ON COLUMN public.chat_messages.parent_id IS 'Reference to parent message for thread replies.';
COMMENT ON COLUMN public.chat_messages.course_id IS 'If set, only students enrolled in this course can see the message.';
COMMENT ON COLUMN public.chat_messages.attachments IS 'Array of {url, type, name, size} objects for file attachments.';

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_university ON public.chat_messages(university_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_author ON public.chat_messages(author_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_parent ON public.chat_messages(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_course ON public.chat_messages(course_id) WHERE course_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(university_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_not_deleted ON public.chat_messages(university_id) WHERE deleted_at IS NULL;

-- Full-text search
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
CREATE INDEX IF NOT EXISTS idx_chat_messages_search ON public.chat_messages USING GIN(search_vector);

-- Updated at trigger
DROP TRIGGER IF EXISTS chat_messages_updated_at ON public.chat_messages;
CREATE TRIGGER chat_messages_updated_at
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- --------------------------------------------------------------------------
-- Reactions Table
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT chat_reactions_unique UNIQUE(message_id, user_id, emoji)
);

COMMENT ON TABLE public.chat_reactions IS 'Emoji reactions on chat messages.';

CREATE INDEX IF NOT EXISTS idx_chat_reactions_message ON public.chat_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_user ON public.chat_reactions(user_id);

-- --------------------------------------------------------------------------
-- Read Receipts Table
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_read_receipts (
  user_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, university_id)
);

COMMENT ON TABLE public.chat_read_receipts IS 'Tracks last read timestamp per user for unread count calculation.';

-- --------------------------------------------------------------------------
-- Mentions Table
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.chat_mentions IS 'Tracks @mentions in chat messages for notification delivery.';
COMMENT ON COLUMN public.chat_mentions.notified_at IS 'NULL until notification is sent. Used for class-aware delayed notifications.';

CREATE INDEX IF NOT EXISTS idx_chat_mentions_message ON public.chat_mentions(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_mentions_user ON public.chat_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_mentions_pending ON public.chat_mentions(mentioned_user_id) WHERE notified_at IS NULL;

-- --------------------------------------------------------------------------
-- Row Level Security
-- --------------------------------------------------------------------------
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_mentions ENABLE ROW LEVEL SECURITY;

-- Chat Messages: See message if same university AND (no course OR enrolled in course)
CREATE POLICY "chat_messages_select" ON public.chat_messages
  FOR SELECT USING (
    university_id = (SELECT university_id FROM public.students WHERE id = auth.uid())
    AND deleted_at IS NULL
    AND (
      course_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.enrollments
        WHERE student_id = auth.uid()
        AND course_id = chat_messages.course_id
        AND status = 'active'
      )
    )
  );

-- Chat Messages: Insert if authenticated and same university
CREATE POLICY "chat_messages_insert" ON public.chat_messages
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND university_id = (SELECT university_id FROM public.students WHERE id = auth.uid())
  );

-- Chat Messages: Update own messages only
CREATE POLICY "chat_messages_update" ON public.chat_messages
  FOR UPDATE USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Chat Messages: Soft delete own messages only (set deleted_at)
CREATE POLICY "chat_messages_delete" ON public.chat_messages
  FOR DELETE USING (author_id = auth.uid());

-- Reactions: See reactions on messages you can see
CREATE POLICY "chat_reactions_select" ON public.chat_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_messages cm
      WHERE cm.id = chat_reactions.message_id
      AND cm.university_id = (SELECT university_id FROM public.students WHERE id = auth.uid())
    )
  );

-- Reactions: Add/remove own reactions
CREATE POLICY "chat_reactions_insert" ON public.chat_reactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "chat_reactions_delete" ON public.chat_reactions
  FOR DELETE USING (user_id = auth.uid());

-- Read Receipts: Own receipts only
CREATE POLICY "chat_read_receipts_all" ON public.chat_read_receipts
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Mentions: See own mentions
CREATE POLICY "chat_mentions_select" ON public.chat_mentions
  FOR SELECT USING (mentioned_user_id = auth.uid());

-- --------------------------------------------------------------------------
-- Enable Realtime
-- --------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reactions;

-- --------------------------------------------------------------------------
-- Service role bypass for edge functions
-- --------------------------------------------------------------------------
-- Note: Service role automatically bypasses RLS, so edge functions can
-- create mentions and send notifications without additional policies.
