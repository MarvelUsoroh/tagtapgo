-- Fix RLS policies for redemptions and points tables
-- Allow students to manage their own redemptions and points transactions

-- ============================================================================
-- REDEMPTIONS TABLE
-- ============================================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Students can insert own redemptions" ON redemptions;
DROP POLICY IF EXISTS "Students can view own redemptions" ON redemptions;
DROP POLICY IF EXISTS "Students can update own redemptions" ON redemptions;
DROP POLICY IF EXISTS "Service role full access to redemptions" ON redemptions;

-- Enable RLS on redemptions table (if not already enabled)
ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;

-- Policy: Students can insert their own redemptions
CREATE POLICY "Students can insert own redemptions"
  ON redemptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

-- Policy: Students can view their own redemptions
CREATE POLICY "Students can view own redemptions"
  ON redemptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

-- Policy: Students can update their own redemptions (for status changes)
CREATE POLICY "Students can update own redemptions"
  ON redemptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- Policy: Service role has full access
CREATE POLICY "Service role full access to redemptions"
  ON redemptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- POINTS TABLE
-- ============================================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Students can insert own points" ON points;
DROP POLICY IF EXISTS "Students can view own points" ON points;
DROP POLICY IF EXISTS "Service role full access to points" ON points;

-- Enable RLS on points table (if not already enabled)
ALTER TABLE points ENABLE ROW LEVEL SECURITY;

-- Policy: Students can insert their own points transactions (for redemptions)
CREATE POLICY "Students can insert own points"
  ON points
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

-- Policy: Students can view their own points
CREATE POLICY "Students can view own points"
  ON points
  FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

-- Policy: Service role has full access
CREATE POLICY "Service role full access to points"
  ON points
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- REWARDS TABLE (read-only for students)
-- ============================================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Students can view all rewards" ON rewards;
DROP POLICY IF EXISTS "Students can view active rewards" ON rewards;
DROP POLICY IF EXISTS "Service role full access to rewards" ON rewards;

-- Enable RLS on rewards table (if not already enabled)
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

-- Policy: Students can view all active rewards
CREATE POLICY "Students can view all rewards"
  ON rewards
  FOR SELECT
  TO authenticated
  USING (active = true);

-- Policy: Service role has full access
CREATE POLICY "Service role full access to rewards"
  ON rewards
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Verify policies were created
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✓ RLS policies created successfully';
  RAISE NOTICE '';
  RAISE NOTICE 'REDEMPTIONS TABLE:';
  RAISE NOTICE '  - Students can insert own redemptions';
  RAISE NOTICE '  - Students can view own redemptions';
  RAISE NOTICE '  - Students can update own redemptions';
  RAISE NOTICE '  - Service role has full access';
  RAISE NOTICE '';
  RAISE NOTICE 'POINTS TABLE:';
  RAISE NOTICE '  - Students can insert own points';
  RAISE NOTICE '  - Students can view own points';
  RAISE NOTICE '  - Service role has full access';
  RAISE NOTICE '';
  RAISE NOTICE 'REWARDS TABLE:';
  RAISE NOTICE '  - Students can view all active rewards';
  RAISE NOTICE '  - Service role has full access';
  RAISE NOTICE '';
END $$;
