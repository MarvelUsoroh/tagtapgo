-- Migration: Add status column to feedback_conversations
-- Description: Adds a status column to track conversation state (active, completed, etc.)

ALTER TABLE public.feedback_conversations 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived'));

-- Backfill existing rows
UPDATE public.feedback_conversations SET status = 'active' WHERE status IS NULL;
