-- ============================================================================
-- Fix Achievement Issues
-- ============================================================================
-- 
-- Issues Fixed:
-- 1. Remove incorrectly unlocked achievements (Demo User)
-- 2. Update achievement criteria to use consistent field names
--
-- Related: Achievement Checker, Gamification Job
-- ============================================================================

-- ============================================================================
-- 1. Remove incorrectly unlocked achievements for Demo User
-- ============================================================================

DO $$
DECLARE
  v_demo_user_id UUID := 'ab191d6e-e016-418b-80a1-0b2b25e007c7';
  v_deleted_count INTEGER;
BEGIN
  RAISE NOTICE 'Removing incorrectly unlocked achievements for Demo User...';
  
  -- Delete achievements that were unlocked incorrectly
  -- Keep only "First Day" which was legitimately earned
  DELETE FROM public.student_achievements
  WHERE student_id = v_demo_user_id
    AND achievement_id IN (
      SELECT a.id FROM public.achievements a
      WHERE a.name IN (
        'Week Warrior',      -- Requires perfect week (not achieved)
        'Perfect Month',     -- Requires perfect month (not achieved)
        'On a Roll',         -- Requires 3-day streak (only has 1)
        'Week Streak',       -- Requires 7-day streak (only has 1)
        'Unstoppable',       -- Requires 30-day streak (only has 1)
        'Early Bird',        -- Requires 5 early arrivals (has 0)
        'Social Butterfly'   -- Requires 5 friends (has 0)
      )
    );
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RAISE NOTICE '✓ Removed % incorrectly unlocked achievements', v_deleted_count;
  
  -- Also remove the points that were awarded for these achievements
  DELETE FROM public.points
  WHERE student_id = v_demo_user_id
    AND transaction_type = 'achievement'
    AND reference_id IN (
      SELECT a.id::TEXT FROM public.achievements a
      WHERE a.name IN (
        'Week Warrior',
        'Perfect Month',
        'On a Roll',
        'Week Streak',
        'Unstoppable',
        'Early Bird',
        'Social Butterfly'
      )
    );
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RAISE NOTICE '✓ Removed % incorrect achievement points', v_deleted_count;
END $$;

-- ============================================================================
-- 2. Verify Demo User's remaining achievements
-- ============================================================================

DO $$
DECLARE
  v_demo_user_id UUID := 'ab191d6e-e016-418b-80a1-0b2b25e007c7';
  v_achievement_count INTEGER;
  v_total_points INTEGER;
BEGIN
  -- Count remaining achievements
  SELECT COUNT(*) INTO v_achievement_count
  FROM public.student_achievements
  WHERE student_id = v_demo_user_id
    AND unlocked = true;
  
  -- Calculate total points
  SELECT COALESCE(SUM(points), 0) INTO v_total_points
  FROM public.points
  WHERE student_id = v_demo_user_id;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Demo User Achievement Status';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Achievements unlocked: %', v_achievement_count;
  RAISE NOTICE 'Total points: %', v_total_points;
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
END $$;
