-- Clean up legacy achievement_unlocked notifications
-- Converts them to the unified achievement schema used by the PWA
BEGIN;

WITH legacy AS (
  SELECT
    id,
    COALESCE(data->>'achievementName', data->>'achievement_name') AS achievement_name,
    COALESCE(data->>'achievementDescription', data->>'achievement_description') AS achievement_description,
    COALESCE((data->>'pointsEarned')::int, (data->>'points_reward')::int) AS points_earned,
    COALESCE(data->>'rarity', 'common') AS rarity
  FROM public.notifications
  WHERE notification_type = 'achievement_unlocked'
)
UPDATE public.notifications AS n
SET
  notification_type = 'achievement',
  data = (
    n.data
    || CASE WHEN legacy.achievement_name IS NOT NULL
         THEN jsonb_build_object('achievementName', legacy.achievement_name)
         ELSE '{}'::jsonb
       END
    || CASE WHEN legacy.achievement_description IS NOT NULL
         THEN jsonb_build_object('achievementDescription', legacy.achievement_description)
         ELSE '{}'::jsonb
       END
    || CASE WHEN legacy.points_earned IS NOT NULL
         THEN jsonb_build_object('pointsEarned', legacy.points_earned)
         ELSE '{}'::jsonb
       END
    || CASE WHEN legacy.rarity IS NOT NULL
         THEN jsonb_build_object('rarity', legacy.rarity)
         ELSE '{}'::jsonb
       END
  )
  - 'achievement_name'
  - 'achievement_description'
  - 'points_reward',
  message = CASE
    WHEN legacy.achievement_name IS NOT NULL AND legacy.points_earned IS NOT NULL
      THEN format('You earned "%s" and %s points!', legacy.achievement_name, legacy.points_earned)
    ELSE n.message
  END,
  updated_at = timezone('utc', now())
FROM legacy
WHERE n.id = legacy.id;

COMMIT;
