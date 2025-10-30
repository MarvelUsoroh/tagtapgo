-- ============================================================================
-- Normalize Achievement Points to 10
-- ============================================================================
-- 
-- For MVP simplicity, all achievements award 10 points.
-- This makes the system easier to understand and balance.
--
-- Related: Achievement System, Gamification
-- ============================================================================

-- Update all achievements to award 10 points
UPDATE public.achievements
SET points_reward = 10
WHERE points_reward != 10;

-- Verify the update
DO $$
DECLARE
  v_total_achievements INTEGER;
  v_updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_achievements
  FROM public.achievements;
  
  SELECT COUNT(*) INTO v_updated_count
  FROM public.achievements
  WHERE points_reward = 10;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Achievement Points Normalization';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Total achievements: %', v_total_achievements;
  RAISE NOTICE 'Achievements with 10 points: %', v_updated_count;
  
  IF v_total_achievements = v_updated_count THEN
    RAISE NOTICE '✓ All achievements now award 10 points';
  ELSE
    RAISE WARNING '⚠ Some achievements still have different point values';
  END IF;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
END $$;

-- Show all achievements with their new point values
SELECT 
  name,
  category,
  rarity,
  points_reward,
  criteria->>'type' as criteria_type,
  COALESCE(
    criteria->>'threshold',
    criteria->>'target',
    criteria->>'value'
  ) as threshold
FROM public.achievements
ORDER BY category, name;
