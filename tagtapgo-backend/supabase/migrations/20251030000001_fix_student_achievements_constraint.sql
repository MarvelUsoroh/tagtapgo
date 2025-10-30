-- ============================================================================
-- Fix Student Achievements Constraint
-- ============================================================================
-- 
-- Problem: The unique constraint on student_achievements is DEFERRABLE,
-- which prevents using ON CONFLICT in upsert operations.
--
-- Error: "ON CONFLICT does not support deferrable unique constraints"
--
-- Solution: Drop and recreate the constraint as NOT DEFERRABLE
--
-- Related: Achievement Checker, Gamification Job
-- ============================================================================

-- Drop the existing DEFERRABLE constraint
ALTER TABLE public.student_achievements
  DROP CONSTRAINT IF EXISTS student_achievements_unique;

-- Recreate as NOT DEFERRABLE (allows ON CONFLICT)
ALTER TABLE public.student_achievements
  ADD CONSTRAINT student_achievements_unique 
  UNIQUE (student_id, achievement_id);

-- Verify the constraint
DO $$
DECLARE
  v_is_deferrable BOOLEAN;
BEGIN
  SELECT condeferrable INTO v_is_deferrable
  FROM pg_constraint
  WHERE conrelid = 'public.student_achievements'::regclass
    AND conname = 'student_achievements_unique';
  
  IF v_is_deferrable THEN
    RAISE EXCEPTION 'Constraint is still DEFERRABLE!';
  ELSE
    RAISE NOTICE '✓ Constraint is now NOT DEFERRABLE (allows ON CONFLICT)';
  END IF;
END $$;
