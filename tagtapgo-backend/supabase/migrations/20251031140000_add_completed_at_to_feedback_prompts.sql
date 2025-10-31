-- Add completed_at column to feedback_prompts table
-- This tracks when a student completes the feedback

ALTER TABLE feedback_prompts
ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;

-- Add index for querying completed prompts
CREATE INDEX idx_feedback_prompts_completed_at ON feedback_prompts(completed_at);

-- Add comment
COMMENT ON COLUMN feedback_prompts.completed_at IS 'Timestamp when the feedback was completed by the student';
