-- ============================================================================
-- Backfill Missing Achievement Notifications
-- ============================================================================
-- 
-- This migration creates notifications for achievements that were unlocked
-- but don't have corresponding notification records. This fixes the issue
-- where the achievement checker failed to create notifications.
--
-- Related: Achievement System, Push Notifications
-- ============================================================================

DO $$
DECLARE
  v_inserted_count INT := 0;
  v_achievement_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Backfilling Missing Achievement Notifications';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  
  -- Find unlocked achievements without notifications
  FOR v_achievement_record IN
    SELECT 
      sa.student_id,
      sa.achievement_id,
      sa.unlocked_at,
      a.name as achievement_name,
      a.description as achievement_description,
      a.points_reward,
      a.rarity
    FROM student_achievements sa
    JOIN achievements a ON sa.achievement_id = a.id
    WHERE sa.unlocked = true
      AND sa.unlocked_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 
        FROM notifications n
        WHERE n.student_id = sa.student_id
          AND n.notification_type = 'achievement'
          AND n.data->>'achievementName' = a.name
          AND n.created_at >= sa.unlocked_at - INTERVAL '5 minutes'
          AND n.created_at <= sa.unlocked_at + INTERVAL '5 minutes'
      )
    ORDER BY sa.unlocked_at DESC
  LOOP
    -- Create missing notification
    INSERT INTO notifications (
      student_id,
      notification_type,
      title,
      message,
      data,
      read,
      created_at
    ) VALUES (
      v_achievement_record.student_id,
      'achievement',
      '🏆 Achievement Unlocked!',
      'You earned "' || v_achievement_record.achievement_name || '" and ' || v_achievement_record.points_reward || ' points!',
      jsonb_build_object(
        'type', 'achievement',
        'achievementName', v_achievement_record.achievement_name,
        'achievementDescription', v_achievement_record.achievement_description,
        'pointsEarned', v_achievement_record.points_reward,
        'rarity', v_achievement_record.rarity,
        'trigger_confetti', true,
        'backfilled', true
      ),
      false,
      v_achievement_record.unlocked_at
    );
    
    v_inserted_count := v_inserted_count + 1;
    
    RAISE NOTICE 'Created notification for: % (student: %, unlocked: %)',
      v_achievement_record.achievement_name,
      v_achievement_record.student_id,
      v_achievement_record.unlocked_at;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Backfill Complete';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Total notifications created: %', v_inserted_count;
  RAISE NOTICE '';
  
  IF v_inserted_count = 0 THEN
    RAISE NOTICE 'No missing notifications found - all achievements have notifications!';
  END IF;
  
END $$;

-- ============================================================================
-- Verification Query
-- ============================================================================

-- Check that all unlocked achievements now have notifications
SELECT 
  COUNT(*) as unlocked_achievements,
  COUNT(n.id) as notifications_exist,
  COUNT(*) - COUNT(n.id) as still_missing
FROM student_achievements sa
JOIN achievements a ON sa.achievement_id = a.id
LEFT JOIN notifications n ON 
  n.student_id = sa.student_id
  AND n.notification_type = 'achievement'
  AND n.data->>'achievementName' = a.name
  AND n.created_at >= sa.unlocked_at - INTERVAL '5 minutes'
  AND n.created_at <= sa.unlocked_at + INTERVAL '5 minutes'
WHERE sa.unlocked = true
  AND sa.unlocked_at IS NOT NULL;
