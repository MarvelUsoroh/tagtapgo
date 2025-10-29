-- Add feedback achievements to the achievements table
-- These achievements reward students for providing course feedback

-- Voice Heard: Submit 5 feedback responses
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
  'Voice Heard',
  'Submit feedback for 5 classes',
  'social',
  '{"type": "feedback_count", "target": 5}',
  50,
  'common',
  NOW()
) ON CONFLICT DO NOTHING;

-- Course Critic: Submit feedback for 10 different courses
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
  'Course Critic',
  'Provide feedback for 10 different courses',
  'social',
  '{"type": "feedback_unique_courses", "target": 10}',
  100,
  'rare',
  NOW()
) ON CONFLICT DO NOTHING;

-- Feedback Champion: Submit 25 feedback responses
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
  'Feedback Champion',
  'Submit feedback for 25 classes',
  'social',
  '{"type": "feedback_count", "target": 25}',
  250,
  'epic',
  NOW()
) ON CONFLICT DO NOTHING;

-- Thoughtful Contributor: Submit 10 feedback responses with comments
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
  'Thoughtful Contributor',
  'Submit 10 detailed feedback responses with comments',
  'social',
  '{"type": "feedback_with_comments", "target": 10}',
  150,
  'rare',
  NOW()
) ON CONFLICT DO NOTHING;

-- Add comment for documentation
COMMENT ON COLUMN public.achievements.criteria IS 'JSON criteria for achievement unlock. Feedback types: feedback_count (total submissions), feedback_unique_courses (unique courses), feedback_with_comments (submissions with comments)';
