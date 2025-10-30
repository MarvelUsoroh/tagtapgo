-- ============================================================================
-- Delete Incorrect Achievements (Again)
-- ============================================================================
-- 
-- The achievements were re-unlocked by the gamification job before the fix
-- was deployed. This migration removes them again.
--
-- After this migration, redeploy gamification-job with the threshold fix.
--
-- Related: Achievement Checker Bug Fix
-- ============================================================================

DO $$
DECLARE
  v_demo_user_id UUID := 'ab191d6e-e016-418b-80a1-0b2b25e007c7';
  v_deleted_achievements INTEGER;
  v_deleted_points INTEGER;
  v_achievement RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Removing Incorrectly Unlocked Achievements';
  RAISE NOTICE '============================================';
  
  -- Delete incorrect achievements
  DELETE FROM public.student_achievements
  WHERE student_id = v_demo_user_id
    AND achievement_id IN (
      SELECT a.id FROM public.achievements a
      WHERE a.name IN (
        'Week Warrior',      -- current: 0, target: 1
        'Perfect Month',     -- current: 0, target: 1
        'On a Roll',         -- current: 1, target: 3
        'Week Streak',       -- current: 1, target: 7
        'Unstoppable',       -- current: 1, target: 30
        'Early Bird',        -- current: 0, target: 5
        'Social Butterfly'   -- current: 0, target: 5
      )
    );
  
  GET DIAGNOSTICS v_deleted_achievements = ROW_COUNT;
  RAISE NOTICE '✓ Deleted % incorrect achievements', v_deleted_achievements;
  
  -- Delete incorrect achievement points
  DELETE FROM public.points
  WHERE student_id = v_demo_user_id
    AND transaction_type = 'achievement'
    AND created_at > '2025-10-30T15:30:00'  -- Only recent ones
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
  
  GET DIAGNOSTICS v_deleted_points = ROW_COUNT;
  RAISE NOTICE '✓ Deleted % incorrect achievement points', v_deleted_points;
  
  -- Show remaining achievements
  RAISE NOTICE '';
  RAISE NOTICE 'Remaining achievements for Demo User:';
  
  FOR v_achievement IN (
    SELECT a.name, sa.unlocked_at
    FROM public.student_achievements sa
    JOIN public.achievements a ON sa.achievement_id = a.id
    WHERE sa.student_id = v_demo_user_id
      AND sa.unlocked = true
    ORDER BY sa.unlocked_at
  ) LOOP
    RAISE NOTICE '  - % (unlocked: %)', v_achievement.name, v_achievement.unlocked_at;
  END LOOP;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
END $$;
