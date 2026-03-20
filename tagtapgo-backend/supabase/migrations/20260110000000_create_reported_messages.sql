-- Create reported_messages table for content moderation
CREATE TABLE IF NOT EXISTS reported_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES students(id),
  notes TEXT,
  
  -- Prevent duplicate reports from same user
  UNIQUE(message_id, reported_by)
);

-- Index for faster queries
CREATE INDEX idx_reported_messages_message_id ON reported_messages(message_id);
CREATE INDEX idx_reported_messages_resolved ON reported_messages(resolved) WHERE NOT resolved;
CREATE INDEX idx_reported_messages_created_at ON reported_messages(created_at DESC);

-- RLS Policies
ALTER TABLE reported_messages ENABLE ROW LEVEL SECURITY;

-- Students can report messages
CREATE POLICY "Students can report messages"
  ON reported_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reported_by = auth.uid()
  );

-- Students can view their own reports
CREATE POLICY "Students can view their own reports"
  ON reported_messages
  FOR SELECT
  TO authenticated
  USING (
    reported_by = auth.uid()
  );

-- Admins can view all reports (future: add admin role check)
-- CREATE POLICY "Admins can view all reports"
--   ON reported_messages
--   FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM students
--       WHERE students.id = auth.uid()
--       AND students.role = 'admin'
--     )
--   );

COMMENT ON TABLE reported_messages IS 'Stores user reports of inappropriate chat messages for moderation';
