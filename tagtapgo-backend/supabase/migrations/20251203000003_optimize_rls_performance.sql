-- Migration: Optimize RLS Policy Performance
-- Description: Fixes auth.uid() init plan issues and consolidates multiple permissive policies

-- ============================================================================
-- Part 1: Fix RLS Init Plan Issues (auth.uid() -> (select auth.uid()))
-- ============================================================================

-- feedback_conversations table
DROP POLICY IF EXISTS "Students can view own conversations" ON public.feedback_conversations;
CREATE POLICY "Students can view own conversations" ON public.feedback_conversations
    FOR SELECT USING ((select auth.uid()) = student_id);

DROP POLICY IF EXISTS "Students can insert own conversations" ON public.feedback_conversations;
CREATE POLICY "Students can insert own conversations" ON public.feedback_conversations
    FOR INSERT WITH CHECK ((select auth.uid()) = student_id);

DROP POLICY IF EXISTS "Students can update own conversations" ON public.feedback_conversations;
CREATE POLICY "Students can update own conversations" ON public.feedback_conversations
    FOR UPDATE USING ((select auth.uid()) = student_id);

-- feedback_messages table
DROP POLICY IF EXISTS "Students can view own messages" ON public.feedback_messages;
CREATE POLICY "Students can view own messages" ON public.feedback_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.feedback_conversations 
            WHERE id = feedback_messages.conversation_id 
            AND student_id = (select auth.uid())
        )
    );

DROP POLICY IF EXISTS "Students can insert own messages" ON public.feedback_messages;
CREATE POLICY "Students can insert own messages" ON public.feedback_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.feedback_conversations 
            WHERE id = feedback_messages.conversation_id 
            AND student_id = (select auth.uid())
        )
    );

-- push_subscriptions table
DROP POLICY IF EXISTS "Students can insert own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Students can insert own push subscriptions"
  ON public.push_subscriptions
  FOR INSERT
  WITH CHECK ((select auth.uid()) = student_id);

DROP POLICY IF EXISTS "Students can view own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Students can view own push subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  USING ((select auth.uid()) = student_id);

DROP POLICY IF EXISTS "Students can update own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Students can update own push subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  USING ((select auth.uid()) = student_id);

DROP POLICY IF EXISTS "Students can delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Students can delete own push subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  USING ((select auth.uid()) = student_id);

-- enrollments table
DROP POLICY IF EXISTS "enrollments_select_own" ON public.enrollments;
CREATE POLICY "enrollments_select_own"
  ON public.enrollments
  FOR SELECT
  USING ((select auth.uid()) = student_id);

-- reward_views table
DROP POLICY IF EXISTS "Students can track their own reward views" ON public.reward_views;
CREATE POLICY "Students can track their own reward views"
  ON public.reward_views
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = student_id);

-- redemption_analytics table
DROP POLICY IF EXISTS "Students can read their own analytics" ON public.redemption_analytics;
CREATE POLICY "Students can read their own analytics"
  ON public.redemption_analytics
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = student_id);

-- ============================================================================
-- Part 2: Fix Multiple Permissive Policies
-- ============================================================================

-- class_feedback: Make service role policy apply ONLY to service_role
DROP POLICY IF EXISTS "Service role has full access to feedback" ON public.class_feedback;
CREATE POLICY "Service role has full access to feedback"
  ON public.class_feedback
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- feedback_prompts: Make service role policy apply ONLY to service_role
DROP POLICY IF EXISTS "Service role has full access to prompts" ON public.feedback_prompts;
CREATE POLICY "Service role has full access to prompts"
  ON public.feedback_prompts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON POLICY "Students can view own conversations" ON public.feedback_conversations 
  IS 'Optimized: uses (select auth.uid()) for performance';
COMMENT ON POLICY "Students can insert own conversations" ON public.feedback_conversations 
  IS 'Optimized: uses (select auth.uid()) for performance';
COMMENT ON POLICY "Students can update own conversations" ON public.feedback_conversations 
  IS 'Optimized: uses (select auth.uid()) for performance';
COMMENT ON POLICY "Students can view own messages" ON public.feedback_messages 
  IS 'Optimized: uses (select auth.uid()) for performance';
COMMENT ON POLICY "Students can insert own messages" ON public.feedback_messages 
  IS 'Optimized: uses (select auth.uid()) for performance';
COMMENT ON POLICY "Service role has full access to feedback" ON public.class_feedback 
  IS 'Optimized: applies to service_role only to avoid multiple permissive policies';
COMMENT ON POLICY "Service role has full access to prompts" ON public.feedback_prompts 
  IS 'Optimized: applies to service_role only to avoid multiple permissive policies';
