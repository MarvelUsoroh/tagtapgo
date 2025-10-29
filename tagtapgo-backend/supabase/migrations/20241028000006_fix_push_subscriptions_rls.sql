-- ============================================================================
-- Migration: Fix Push Subscriptions RLS Policies
-- Date: 2024-10-28
-- Description: Add RLS policies for authenticated users to manage their own push subscriptions
-- ============================================================================

-- ============================================================================
-- Add RLS Policies for Push Subscriptions
-- ============================================================================

-- Policy: Students can insert their own push subscriptions
CREATE POLICY "Students can insert own push subscriptions"
  ON push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

-- Policy: Students can view their own push subscriptions
CREATE POLICY "Students can view own push subscriptions"
  ON push_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

-- Policy: Students can update their own push subscriptions
CREATE POLICY "Students can update own push subscriptions"
  ON push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- Policy: Students can delete their own push subscriptions
CREATE POLICY "Students can delete own push subscriptions"
  ON push_subscriptions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = student_id);

-- ============================================================================
-- Summary
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Push Subscriptions RLS Policies Added';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Students can now:';
  RAISE NOTICE '  - Insert their own push subscriptions';
  RAISE NOTICE '  - View their own push subscriptions';
  RAISE NOTICE '  - Update their own push subscriptions';
  RAISE NOTICE '  - Delete their own push subscriptions';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
END $$;
