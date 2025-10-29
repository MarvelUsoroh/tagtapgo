-- Seed common achievements for the gamification system
-- This migration adds achievement definitions across all categories

-- ============================================
-- ATTENDANCE ACHIEVEMENTS
-- ============================================

-- First Day: Attend your first class
INSERT INTO public.achievements (
  id,
  name,
  description,
  category,
  criteria,
  points_reward,
  rarity,
  created_at
) VALUES (
  gen_random_uuid(),
  'First Day',
  'Attend your first class',
  'attendance',
  '{"type": "attendance_count", "target": 1}',
  10,
  'common',
  NOW()
) ON CONFLICT DO NOTHING;

-- Getting Started: Attend 10 classes
INSERT INTO public.achievements (
  id,
  name,
  description,
  category,
  criteria,
  points_reward,
  rarity,
  created_at
) VALUES (
  gen_random_uuid(),
  'Getting Started',
  'Attend 10 classes',
  'attendance',
  '{"type": "attendance_count", "target": 10}',
  50,
  'common',
  NOW()
) ON CONFLICT DO NOTHING;

-- Dedicated Student: Attend 50 classes
INSERT INTO public.achievements (
  id,
  name,
  description,
  category,
  criteria,
  points_reward,
  rarity,
  created_at
) VALUES (
  gen_random_uuid(),
  'Dedicated Student',
  'Attend 50 classes',
  'attendance',
  '{"type": "attendance_count", "target": 50}',
  200,
  'rare',
  NOW()
) ON CONFLICT DO NOTHING;

-- Century Club: Attend 100 classes
INSERT INTO public.achievements (
  id,
  name,
  description,
  category,
  criteria,
  points_reward,
  rarity,
  created_at
) VALUES (
  gen_random_uuid(),
  'Century Club',
  'Attend 100 classes',
  'attendance',
  '{"type": "attendance_count", "target": 100}',
  500,
  'epic',
  NOW()
) ON CONFLICT DO NOTHING;

-- ============================================
-- STREAK ACHIEVEMENTS
-- ============================================

-- Fire Starter: Achieve a 3-day streak
INSERT INTO public.achievements (
  id,
  name,
  description,
  category,
  criteria,
  points_reward,
  rarity,
  created_at
) VALUES (
  gen_random_uuid(),
  'Fire Starter',
  'Maintain a 3-day attendance streak',
  'streak',
  '{"type": "streak_milestone", "target": 3}',
  30,
  'common',
  NOW()
) ON CONFLICT DO NOTHING;

-- Week Warrior: Achieve a 7-day streak
INSERT INTO public.achievements (
  id,
  name,
  description,
  category,
  criteria,
  points_reward,
  rarity,
  created_at
) VALUES (
  gen_random_uuid(),
  'Week Warrior',
  'Maintain a 7-day attendance streak',
  'streak',
  '{"type": "streak_milestone", "target": 7}',
  100,
  'rare',
  NOW()
) ON CONFLICT DO NOTHING;

-- Month Master: Achieve a 30-day streak
INSERT INTO public.achievements (
  id,
  name,
  description,
  category,
  criteria,
  points_reward,
  rarity,
  created_at
) VALUES (
  gen_random_uuid(),
  'Month Master',
  'Maintain a 30-day attendance streak',
  'streak',
  '{"type": "streak_milestone", "target": 30}',
  500,
  'epic',
  NOW()
) ON CONFLICT DO NOTHING;

-- Legendary Streak: Achieve a 100-day streak
INSERT INTO public.achievements (
  id,
  name,
  description,
  category,
  criteria,
  points_reward,
  rarity,
  created_at
) VALUES (
  gen_random_uuid(),
  'Legendary Streak',
  'Maintain a 100-day attendance streak',
  'streak',
  '{"type": "streak_milestone", "target": 100}',
  2000,
  'legendary',
  NOW()
) ON CONFLICT DO NOTHING;

-- ============================================
-- TIME-BASED ACHIEVEMENTS (Early Arrival)
-- ============================================

-- Early Bird: Arrive early 5 times
INSERT INTO public.achievements (
  id,
  name,
  description,
  category,
  criteria,
  points_reward,
  rarity,
  created_at
) VALUES (
  gen_random_uuid(),
  'Early Bird',
  'Arrive 5+ minutes early to 5 classes',
  'time',
  '{"type": "early_arrival_count", "target": 5}',
  50,
  'common',
  NOW()
) ON CONFLICT DO NOTHING;

-- Punctuality Pro: Arrive early 20 times
INSERT INTO public.achievements (
  id,
  name,
  description,
  category,
  criteria,
  points_reward,
  rarity,
  created_at
) VALUES (
  gen_random_uuid(),
  'Punctuality Pro',
  'Arrive 5+ minutes early to 20 classes',
  'time',
  '{"type": "early_arrival_count", "target": 20}',
  200,
  'rare',
  NOW()
) ON CONFLICT DO NOTHING;

-- Perfect Week: Complete a perfect week
INSERT INTO public.achievements (
  id,
  name,
  description,
  category,
  criteria,
  points_reward,
  rarity,
  created_at
) VALUES (
  gen_random_uuid(),
  'Perfect Week',
  'Attend all classes for 1 week (5/5 days)',
  'time',
  '{"type": "perfect_week_count", "target": 1}',
  100,
  'rare',
  NOW()
) ON CONFLICT DO NOTHING;

-- Perfect Month: Complete a perfect month
INSERT INTO public.achievements (
  id,
  name,
  description,
  category,
  criteria,
  points_reward,
  rarity,
  created_at
) VALUES (
  gen_random_uuid(),
  'Perfect Month',
  'Attend all classes for 1 month (20/20 days)',
  'time',
  '{"type": "perfect_month_count", "target": 1}',
  500,
  'epic',
  NOW()
) ON CONFLICT DO NOTHING;

-- ============================================
-- REWARD ACHIEVEMENTS
-- ============================================

-- First Reward: Redeem your first reward
INSERT INTO public.achievements (
  id,
  name,
  description,
  category,
  criteria,
  points_reward,
  rarity,
  created_at
) VALUES (
  gen_random_uuid(),
  'First Reward',
  'Redeem your first reward',
  'reward',
  '{"type": "reward_redemption_count", "target": 1}',
  25,
  'common',
  NOW()
) ON CONFLICT DO NOTHING;

-- Reward Hunter: Redeem 5 rewards
INSERT INTO public.achievements (
  id,
  name,
  description,
  category,
  criteria,
  points_reward,
  rarity,
  created_at
) VALUES (
  gen_random_uuid(),
  'Reward Hunter',
  'Redeem 5 rewards',
  'reward',
  '{"type": "reward_redemption_count", "target": 5}',
  100,
  'rare',
  NOW()
) ON CONFLICT DO NOTHING;

-- Reward Master: Redeem 10 rewards
INSERT INTO public.achievements (
  id,
  name,
  description,
  category,
  criteria,
  points_reward,
  rarity,
  created_at
) VALUES (
  gen_random_uuid(),
  'Reward Master',
  'Redeem 10 rewards',
  'reward',
  '{"type": "reward_redemption_count", "target": 10}',
  250,
  'epic',
  NOW()
) ON CONFLICT DO NOTHING;

-- ============================================
-- FEEDBACK ACHIEVEMENTS (Already added in previous migration)
-- ============================================
-- Voice Heard, Course Critic, Feedback Champion, Thoughtful Contributor

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_achievements_category ON public.achievements(category);
CREATE INDEX IF NOT EXISTS idx_achievements_rarity ON public.achievements(rarity);
CREATE INDEX IF NOT EXISTS idx_student_achievements_unlocked_at ON public.student_achievements(unlocked_at, student_id);
CREATE INDEX IF NOT EXISTS idx_student_achievements_student_id ON public.student_achievements(student_id);

-- Add comment for documentation
COMMENT ON TABLE public.achievements IS 'Achievement definitions with criteria and rewards. Criteria types: attendance_count, streak_milestone, early_arrival_count, perfect_week_count, perfect_month_count, feedback_count, feedback_unique_courses, feedback_with_comments, reward_redemption_count';

