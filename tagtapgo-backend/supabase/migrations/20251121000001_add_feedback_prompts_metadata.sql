-- Migration: Add metadata to feedback_prompts
-- Description: Adds a metadata column to feedback_prompts to store context (e.g., session topic) from attendance records.

ALTER TABLE public.feedback_prompts
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.feedback_prompts.metadata IS 'Contextual data for the feedback prompt (e.g., session topic, learning objectives).';
