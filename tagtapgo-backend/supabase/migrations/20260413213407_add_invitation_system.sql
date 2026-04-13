-- Migration: Add invitation system for student signup
-- Created: 2026-04-13
-- Description: Creates invitation_tokens table and adds auth_user_id to students table

-- ============================================================================
-- 1. Add auth_user_id column to students table
-- ============================================================================

-- Add auth_user_id column to link students to Supabase auth accounts
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_students_auth_user ON public.students(auth_user_id);

-- Add comment
COMMENT ON COLUMN public.students.auth_user_id IS 'Links student record to Supabase auth account. Nullable because students can exist before account creation.';

-- ============================================================================
-- 2. Create invitation_tokens table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invitation_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'expired', 'invalidated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Add comments
COMMENT ON TABLE public.invitation_tokens IS 'Stores invitation tokens for student signup. Tokens are hashed for security.';
COMMENT ON COLUMN public.invitation_tokens.student_id IS 'Reference to the student being invited';
COMMENT ON COLUMN public.invitation_tokens.email IS 'Email address where invitation was sent';
COMMENT ON COLUMN public.invitation_tokens.token_hash IS 'Hashed version of the invitation token (bcrypt)';
COMMENT ON COLUMN public.invitation_tokens.status IS 'Current status: pending (not used), used (signup completed), expired (past expiration), invalidated (replaced by new invitation)';
COMMENT ON COLUMN public.invitation_tokens.expires_at IS 'Token expiration timestamp (7 days from creation)';
COMMENT ON COLUMN public.invitation_tokens.used_at IS 'Timestamp when token was used for signup';
COMMENT ON COLUMN public.invitation_tokens.metadata IS 'Additional metadata (invitation source, admin who sent it, etc.)';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_student ON public.invitation_tokens(student_id);
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_email ON public.invitation_tokens(email);
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_status ON public.invitation_tokens(status);
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_expires ON public.invitation_tokens(expires_at);

-- ============================================================================
-- 3. Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.invitation_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can manage invitation tokens
-- (API routes will use service role to generate and validate tokens)
CREATE POLICY "Service role can manage invitation tokens"
  ON public.invitation_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 4. Create helper function to invalidate old tokens
-- ============================================================================

CREATE OR REPLACE FUNCTION public.invalidate_old_invitation_tokens(p_student_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark all pending tokens for this student as invalidated
  UPDATE public.invitation_tokens
  SET status = 'invalidated',
      metadata = jsonb_set(
        metadata,
        '{invalidated_at}',
        to_jsonb(timezone('utc', now()))
      )
  WHERE student_id = p_student_id
    AND status = 'pending';
END;
$$;

COMMENT ON FUNCTION public.invalidate_old_invitation_tokens IS 'Invalidates all pending invitation tokens for a student when a new invitation is generated';

-- ============================================================================
-- 5. Create helper function to cleanup expired tokens
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_invitation_tokens()
RETURNS TABLE(deleted_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete tokens older than 30 days
  DELETE FROM public.invitation_tokens
  WHERE created_at < (timezone('utc', now()) - INTERVAL '30 days');
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_invitation_tokens IS 'Deletes invitation tokens older than 30 days. Returns count of deleted tokens.';
