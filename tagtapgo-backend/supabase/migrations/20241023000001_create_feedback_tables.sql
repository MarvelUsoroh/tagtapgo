-- Create class_feedback table
CREATE TABLE IF NOT EXISTS public.class_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  class_schedule_id UUID NOT NULL REFERENCES public.class_schedules(id) ON DELETE CASCADE,
  content_quality INTEGER NOT NULL CHECK (content_quality >= 1 AND content_quality <= 5),
  clarity INTEGER NOT NULL CHECK (clarity >= 1 AND clarity <= 5),
  pace INTEGER NOT NULL CHECK (pace >= 1 AND pace <= 5),
  comment TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT true,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  helpful_count INTEGER NOT NULL DEFAULT 0,
  flagged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, class_schedule_id)
);

-- Create feedback_prompts table
CREATE TABLE IF NOT EXISTS public.feedback_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_schedule_id UUID NOT NULL REFERENCES public.class_schedules(id) ON DELETE CASCADE,
  prompt_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'skipped')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, class_schedule_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_class_feedback_student_id ON public.class_feedback(student_id);
CREATE INDEX IF NOT EXISTS idx_class_feedback_class_id ON public.class_feedback(class_id);
CREATE INDEX IF NOT EXISTS idx_class_feedback_class_schedule_id ON public.class_feedback(class_schedule_id);
CREATE INDEX IF NOT EXISTS idx_class_feedback_submitted_at ON public.class_feedback(submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_prompts_student_id ON public.feedback_prompts(student_id);
CREATE INDEX IF NOT EXISTS idx_feedback_prompts_status ON public.feedback_prompts(status);
CREATE INDEX IF NOT EXISTS idx_feedback_prompts_expires_at ON public.feedback_prompts(expires_at);
CREATE INDEX IF NOT EXISTS idx_feedback_prompts_student_status ON public.feedback_prompts(student_id, status);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_class_feedback_updated_at
  BEFORE UPDATE ON public.class_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_prompts_updated_at
  BEFORE UPDATE ON public.feedback_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.class_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_prompts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for class_feedback
-- Students can read their own feedback
CREATE POLICY "Students can read own feedback"
  ON public.class_feedback
  FOR SELECT
  USING (auth.uid() = student_id);

-- Students can insert their own feedback
CREATE POLICY "Students can insert own feedback"
  ON public.class_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Service role has full access (for admin dashboard - future)
CREATE POLICY "Service role has full access to feedback"
  ON public.class_feedback
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for feedback_prompts
-- Students can read their own prompts
CREATE POLICY "Students can read own prompts"
  ON public.feedback_prompts
  FOR SELECT
  USING (auth.uid() = student_id);

-- Students can update their own prompts (for status changes)
CREATE POLICY "Students can update own prompts"
  ON public.feedback_prompts
  FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- Service role has full access
CREATE POLICY "Service role has full access to prompts"
  ON public.feedback_prompts
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Grant permissions
GRANT SELECT, INSERT ON public.class_feedback TO authenticated;
GRANT SELECT, UPDATE ON public.feedback_prompts TO authenticated;
GRANT ALL ON public.class_feedback TO service_role;
GRANT ALL ON public.feedback_prompts TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.class_feedback IS 'Stores student feedback for class sessions';
COMMENT ON TABLE public.feedback_prompts IS 'Tracks feedback prompts sent to students';
COMMENT ON COLUMN public.class_feedback.is_anonymous IS 'Whether feedback is submitted anonymously (default: true)';
COMMENT ON COLUMN public.class_feedback.helpful_count IS 'Number of times feedback was marked as helpful (future feature)';
COMMENT ON COLUMN public.class_feedback.flagged IS 'Whether feedback was flagged for review (future feature)';
COMMENT ON COLUMN public.feedback_prompts.status IS 'Status: pending, completed, expired, or skipped';
