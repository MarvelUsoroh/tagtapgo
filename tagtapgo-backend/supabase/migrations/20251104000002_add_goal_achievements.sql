-- ============================================================================
-- Add Goal-Related Achievements
-- ============================================================================
-- Purpose:
--   Add four new achievements related to attendance goals:
--   1. Goal Setter - Set your first attendance goal
--   2. Goal Achiever - Achieve your attendance goal 3 times
--   3. Overachiever - Exceed 95% attendance for 4 consecutive weeks
--   4. Comeback Kid - Recover from < 70% to > 90% attendance
-- ============================================================================

-- Insert Goal Setter achievement
INSERT INTO public.achievements (
  id,
  name,
  description,
  category,
  badge_image_url,
  points_reward,
  criteria,
  rarity,
  metadata
) VALUES (
  gen_random_uuid(),
  'Goal Setter',
  'Set your first attendance goal',
  'reward',
  '🎯',
  25,
  jsonb_build_object(
    'type', 'goal_set',
    'count', 1
  ),
  'common',
  jsonb_build_object(
    'order', 100,
    'hidden', false,
    'icon', '🎯'
  )
) ON CONFLICT (name) DO NOTHING;

-- Insert Goal Achiever achievement
INSERT INTO public.achievements (
  id,
  name,
  description,
  category,
  badge_image_url,
  points_reward,
  criteria,
  rarity,
  metadata
) VALUES (
  gen_random_uuid(),
  'Goal Achiever',
  'Achieve your attendance goal 3 times',
  'reward',
  '🏆',
  100,
  jsonb_build_object(
    'type', 'goal_achieved',
    'count', 3
  ),
  'rare',
  jsonb_build_object(
    'order', 101,
    'hidden', false,
    'icon', '🏆'
  )
) ON CONFLICT (name) DO NOTHING;

-- Insert Overachiever achievement
INSERT INTO public.achievements (
  id,
  name,
  description,
  category,
  badge_image_url,
  points_reward,
  criteria,
  rarity,
  metadata
) VALUES (
  gen_random_uuid(),
  'Overachiever',
  'Exceed 95% attendance for 4 consecutive weeks',
  'attendance',
  '⭐',
  200,
  jsonb_build_object(
    'type', 'overachiever',
    'threshold', 95,
    'weeks', 4
  ),
  'epic',
  jsonb_build_object(
    'order', 102,
    'hidden', false,
    'icon', '⭐'
  )
) ON CONFLICT (name) DO NOTHING;

-- Insert Comeback Kid achievement
INSERT INTO public.achievements (
  id,
  name,
  description,
  category,
  badge_image_url,
  points_reward,
  criteria,
  rarity,
  metadata
) VALUES (
  gen_random_uuid(),
  'Comeback Kid',
  'Recover from below 70% to above 90% attendance',
  'attendance',
  '💪',
  150,
  jsonb_build_object(
    'type', 'comeback',
    'from_threshold', 70,
    'to_threshold', 90
  ),
  'epic',
  jsonb_build_object(
    'order', 103,
    'hidden', false,
    'icon', '💪'
  )
) ON CONFLICT (name) DO NOTHING;

-- Create table to track goal achievement history
CREATE TABLE IF NOT EXISTS public.goal_achievement_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('weekly', 'monthly')),
  target_percentage INTEGER NOT NULL CHECK (target_percentage >= 50 AND target_percentage <= 100),
  achieved_percentage NUMERIC(5,2) NOT NULL,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.goal_achievement_history IS 
'Tracks when students achieve their attendance goals for achievement progress tracking.';

CREATE INDEX IF NOT EXISTS idx_goal_achievement_history_student 
  ON public.goal_achievement_history(student_id, achieved_at DESC);

-- Enable RLS
ALTER TABLE public.goal_achievement_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Students can read their own goal achievement history
CREATE POLICY goal_achievement_history_select_own 
  ON public.goal_achievement_history
  FOR SELECT
  USING (auth.uid() = student_id);

-- RLS Policy: Service role has full access
CREATE POLICY goal_achievement_history_service_role 
  ON public.goal_achievement_history
  FOR ALL
  USING (auth.role() = 'service_role');

-- Log the results
DO $$
DECLARE
  achievement_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO achievement_count
  FROM public.achievements
  WHERE name IN ('Goal Setter', 'Goal Achiever', 'Overachiever', 'Comeback Kid');
  
  RAISE NOTICE 'Goal achievements migration complete. % goal-related achievements added.', achievement_count;
END $$;
