-- ============================================================================
-- TagTapGo Baseline Schema (Rebuild)
-- ============================================================================
-- Purpose:
--   Recreate the foundational public schema objects that the gamification MVP,
--   attendance sync pipeline, and cron monitoring features rely on.
--   This file is designed to run on an empty database before replaying the
--   incremental migrations already present in this repository.
--
-- Notes:
--   * All `CREATE` statements use IF NOT EXISTS / OR REPLACE where safe so the
--     script can be re-run idempotently during local development.
--   * Core tables include the superset of columns referenced by the frontend,
--     backend services, edge functions, and tests gathered during the schema
--     audit (2025-10-27 context).
--   * Row Level Security is enabled on user-facing tables with minimal baseline
--     policies so the Supabase service role (used by edge functions) retains
--     full access. Detailed student-facing policies can be layered by later
--     migrations or policy scripts.
-- ============================================================================

-- --------------------------------------------------------------------------
-- Extensions
-- --------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "http";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- --------------------------------------------------------------------------
-- Helper Functions (timestamps)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.update_updated_at_column() IS 'Set updated_at to now() on row updates (UTC).';

-- --------------------------------------------------------------------------
-- Universites & Students
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  sis_type TEXT NOT NULL CHECK (sis_type IN ('moodle', 'openSIS', 'generic')),
  timezone TEXT DEFAULT 'UTC',
  api_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT DEFAULT 'never' CHECK (last_sync_status IN ('success', 'error', 'never')),
  last_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.universities IS 'Institutions configured for attendance sync and gamification.';
COMMENT ON COLUMN public.universities.api_config IS 'Adapter configuration payload (includes credentials, endpoints, timezone, etc.).';
COMMENT ON COLUMN public.universities.metadata IS 'Additional per-university metadata (SIS flags, rollout config).';
CREATE INDEX IF NOT EXISTS idx_universities_active ON public.universities(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_universities_last_sync_at ON public.universities(last_sync_at DESC);
CREATE INDEX IF NOT EXISTS idx_universities_last_sync_status ON public.universities(last_sync_status);

CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  email TEXT,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  name TEXT,
  status TEXT DEFAULT 'active',
  grade_level TEXT,
  student_number TEXT,
  year INTEGER,
  major TEXT,
  avatar_url TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.students IS 'Student profiles (mirrors Supabase auth users via ensureStudentProfile).';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_email_unique'
  ) THEN
    ALTER TABLE public.students ADD CONSTRAINT students_email_unique UNIQUE (email) DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_external_unique'
  ) THEN
    ALTER TABLE public.students ADD CONSTRAINT students_external_unique UNIQUE (university_id, external_id) DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_students_university ON public.students(university_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status);

-- --------------------------------------------------------------------------
-- Courses, Classes, Enrollments
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  external_id TEXT,
  code TEXT,
  name TEXT NOT NULL,
  short_name TEXT,
  description TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  schedule JSONB DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_external_unique'
  ) THEN
    ALTER TABLE public.courses ADD CONSTRAINT courses_external_unique UNIQUE (university_id, external_id) DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_courses_university ON public.courses(university_id);
CREATE INDEX IF NOT EXISTS idx_courses_active ON public.courses(active);

CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  section TEXT,
  instructor_name TEXT,
  instructor_email TEXT,
  location TEXT,
  start_date DATE,
  end_date DATE,
  capacity INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_classes_course ON public.classes(course_id);

CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'ta', 'instructor')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dropped', 'completed', 'pending')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_unique'
  ) THEN
    ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_unique UNIQUE (student_id, course_id) DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.enrollments(course_id);

-- --------------------------------------------------------------------------
-- Attendance & Scheduling
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  session_id TEXT,
  period TEXT,
  date DATE,
  status TEXT NOT NULL CHECK (status IN ('present', 'late', 'excused', 'absent', 'unknown')),
  status_code TEXT,
  source TEXT NOT NULL DEFAULT 'sis' CHECK (source IN ('manual', 'sis', 'nfc', 'qr', 'other')),
  recorded_at TIMESTAMPTZ,
  check_in_time TIMESTAMPTZ,
  scheduled_time TIMESTAMPTZ,
  source_tz TEXT,
  time TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_unique'
  ) THEN
    ALTER TABLE public.attendance ADD CONSTRAINT attendance_unique UNIQUE (student_id, course_id, date, session_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_course ON public.attendance(course_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance(status);

CREATE TABLE IF NOT EXISTS public.class_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL,
  period TEXT,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT,
  instructor_id TEXT,
  effective_from DATE NOT NULL,
  effective_to DATE NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_class_schedules_course_day ON public.class_schedules(course_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_class_schedules_effective ON public.class_schedules(effective_from, effective_to);

CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL DEFAULT 'full' CHECK (sync_type IN ('students', 'courses', 'attendance', 'schedule', 'full')),
  status TEXT NOT NULL CHECK (status IN ('started', 'success', 'error')),
  records_processed INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_sync_logs_university ON public.sync_logs(university_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON public.sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON public.sync_logs(created_at DESC);

-- --------------------------------------------------------------------------
-- Gamification Core (points, streaks, achievements, leaderboards)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'attendance', 'achievement', 'bonus', 'early_arrival', 'perfect_week',
    'perfect_month', 'streak', 'challenge', 'referral', 'redemption',
    'adjustment', 'feedback'
  )),
  reference_id TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_points_reference_id ON public.points(reference_id);
CREATE INDEX IF NOT EXISTS idx_points_student ON public.points(student_id);
CREATE INDEX IF NOT EXISTS idx_points_transaction_type ON public.points(transaction_type);

CREATE OR REPLACE VIEW public.student_points_balance AS
SELECT
  p.student_id,
  COALESCE(SUM(p.points), 0) AS total_points
FROM public.points p
GROUP BY p.student_id;
COMMENT ON VIEW public.student_points_balance IS 'Aggregated points balance per student.';

CREATE TABLE IF NOT EXISTS public.streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL UNIQUE REFERENCES public.students(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_attendance_date DATE,
  streak_freeze_count INTEGER NOT NULL DEFAULT 1,
  last_freeze_used_at TIMESTAMPTZ,
  freeze_reset_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  freeze_count INTEGER GENERATED ALWAYS AS (streak_freeze_count) STORED
);
CREATE INDEX IF NOT EXISTS idx_streaks_student ON public.streaks(student_id);
CREATE INDEX IF NOT EXISTS idx_streaks_current ON public.streaks(current_streak DESC);

CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  badge_image_url TEXT,
  category TEXT NOT NULL CHECK (category IN ('attendance', 'streak', 'time', 'social', 'reward')),
  criteria JSONB NOT NULL,
  points_reward INTEGER NOT NULL DEFAULT 0,
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_achievements_name ON public.achievements(name);

CREATE TABLE IF NOT EXISTS public.student_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  unlocked BOOLEAN NOT NULL DEFAULT FALSE,
  unlocked_at TIMESTAMPTZ,
  last_progress_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_achievements_unique'
  ) THEN
    ALTER TABLE public.student_achievements ADD CONSTRAINT student_achievements_unique UNIQUE (student_id, achievement_id) DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_student_achievements_student ON public.student_achievements(student_id);
CREATE INDEX IF NOT EXISTS idx_student_achievements_unlocked ON public.student_achievements(unlocked);

CREATE TABLE IF NOT EXISTS public.leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  student_name TEXT,
  student_avatar_url TEXT,
  leaderboard_type TEXT NOT NULL CHECK (leaderboard_type IN ('class', 'year', 'school', 'friend')),
  period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'all_time')),
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  primary_course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  rank INTEGER NOT NULL,
  points INTEGER NOT NULL,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  score INTEGER GENERATED ALWAYS AS ((current_streak * 100) + points) STORED,
  period_start DATE NOT NULL,
  period_end DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
-- Add unified constraint (applied after migration 20241027_20_57_unified_constraint_approach.sql)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leaderboards_student_id_leaderboard_type_period_course_id_p_key'
  ) THEN
    ALTER TABLE public.leaderboards ADD CONSTRAINT leaderboards_student_id_leaderboard_type_period_course_id_p_key 
      UNIQUE (student_id, leaderboard_type, period, course_id, period_start);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_leaderboards_type_period ON public.leaderboards(leaderboard_type, period);
CREATE INDEX IF NOT EXISTS idx_leaderboards_rank ON public.leaderboards(rank);
CREATE INDEX IF NOT EXISTS idx_leaderboards_student ON public.leaderboards(student_id);
CREATE INDEX IF NOT EXISTS idx_leaderboards_score ON public.leaderboards(leaderboard_type, period, score DESC, current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboards_streak ON public.leaderboards(current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboards_type_period_score ON public.leaderboards(leaderboard_type, period, score DESC);

CREATE OR REPLACE VIEW public.leaderboard_summary AS
SELECT
  l.id,
  l.student_id,
  l.university_id,
  l.leaderboard_type,
  l.period,
  l.course_id,
  l.primary_course_id,
  l.rank,
  l.current_streak,
  l.longest_streak,
  l.points,
  l.score,
  l.period_start,
  l.period_end,
  l.updated_at,
  s.name AS student_name,
  s.avatar_url AS student_avatar_url
FROM public.leaderboards l
JOIN public.students s ON s.id = l.student_id;
COMMENT ON VIEW public.leaderboard_summary IS 'Leaderboard entries joined with student profile details.';

-- --------------------------------------------------------------------------
-- Social, Challenges, Rewards
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'friends_unique'
  ) THEN
    ALTER TABLE public.friends ADD CONSTRAINT friends_unique UNIQUE (student_id, friend_id) DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'friends_self_check'
  ) THEN
    ALTER TABLE public.friends ADD CONSTRAINT friends_self_check CHECK (student_id <> friend_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_friends_student ON public.friends(student_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON public.friends(friend_id);

CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_type TEXT NOT NULL CHECK (challenge_type IN ('peer', 'class', 'school')),
  name TEXT NOT NULL,
  description TEXT,
  creator_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  goal JSONB NOT NULL DEFAULT '{}'::jsonb,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  reward_points INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON public.challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_course ON public.challenges(course_id);

CREATE TABLE IF NOT EXISTS public.challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'withdrawn')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'challenge_participants_unique'
  ) THEN
    ALTER TABLE public.challenge_participants ADD CONSTRAINT challenge_participants_unique UNIQUE (challenge_id, student_id) DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_challenge_participants_student ON public.challenge_participants(student_id);

CREATE TABLE IF NOT EXISTS public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  points_cost INTEGER NOT NULL,
  category TEXT,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  expiry_days INTEGER NOT NULL DEFAULT 30,
  terms TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_rewards_active ON public.rewards(active);

CREATE TABLE IF NOT EXISTS public.redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.rewards(id) ON DELETE RESTRICT,
  points_spent INTEGER NOT NULL,
  redemption_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'issued', 'used', 'expired', 'cancelled')),
  issued_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'redemptions_code_unique'
  ) THEN
    ALTER TABLE public.redemptions ADD CONSTRAINT redemptions_code_unique UNIQUE (redemption_code);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_redemptions_student ON public.redemptions(student_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_status ON public.redemptions(status);

-- --------------------------------------------------------------------------
-- Notifications & Feedback
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_notifications_student ON public.notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_unique'
  ) THEN
    ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_unique UNIQUE (student_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.class_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_schedule_id UUID NOT NULL REFERENCES public.class_schedules(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  content_quality INTEGER CHECK (content_quality BETWEEN 1 AND 5),
  clarity INTEGER CHECK (clarity BETWEEN 1 AND 5),
  pace INTEGER CHECK (pace BETWEEN 1 AND 5),
  comments TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'class_feedback_unique'
  ) THEN
    ALTER TABLE public.class_feedback ADD CONSTRAINT class_feedback_unique UNIQUE (student_id, class_schedule_id) DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_class_feedback_student ON public.class_feedback(student_id);
CREATE INDEX IF NOT EXISTS idx_class_feedback_course ON public.class_feedback(course_id);

CREATE TABLE IF NOT EXISTS public.feedback_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_schedule_id UUID NOT NULL REFERENCES public.class_schedules(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'skipped')),
  prompt_sent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  expires_at TIMESTAMPTZ,
  last_reminder_sent_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedback_prompts_unique'
  ) THEN
    ALTER TABLE public.feedback_prompts ADD CONSTRAINT feedback_prompts_unique UNIQUE (student_id, class_schedule_id) DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_feedback_prompts_student ON public.feedback_prompts(student_id);
CREATE INDEX IF NOT EXISTS idx_feedback_prompts_status ON public.feedback_prompts(status);

-- --------------------------------------------------------------------------
-- Cron Job Tracking (baseline)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cron_job_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error')),
  duration_ms INTEGER,
  error_message TEXT,
  records_processed INTEGER DEFAULT 0,
  records_succeeded INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_cron_job_executions_job_name ON public.cron_job_executions(job_name);
CREATE INDEX IF NOT EXISTS idx_cron_job_executions_started ON public.cron_job_executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_job_executions_status ON public.cron_job_executions(status);
CREATE INDEX IF NOT EXISTS idx_cron_job_executions_metadata ON public.cron_job_executions USING gin(metadata);

CREATE OR REPLACE VIEW public.cron_job_executions_recent AS
SELECT
  id,
  job_name,
  started_at,
  completed_at,
  status,
  duration_ms,
  error_message,
  metadata,
  CASE 
    WHEN completed_at IS NULL THEN 'Running'
    WHEN status = 'success' THEN 'Success'
    ELSE 'Failed'
  END AS status_display
FROM public.cron_job_executions
WHERE started_at > timezone('utc', now()) - INTERVAL '24 hours'
ORDER BY started_at DESC
LIMIT 100;

CREATE OR REPLACE VIEW public.cron_job_health AS
SELECT
  job_name,
  COUNT(*) AS total_executions,
  COUNT(*) FILTER (WHERE status = 'success') AS successful_executions,
  COUNT(*) FILTER (WHERE status = 'error') AS failed_executions,
  COUNT(*) FILTER (WHERE status = 'running') AS running_executions,
  ROUND((COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2) AS success_rate_percent,
  AVG(duration_ms) FILTER (WHERE status = 'success') AS avg_duration_ms,
  MAX(started_at) AS last_execution_at,
  MAX(started_at) FILTER (WHERE status = 'success') AS last_success_at,
  MAX(started_at) FILTER (WHERE status = 'error') AS last_error_at
FROM public.cron_job_executions
WHERE started_at > timezone('utc', now()) - INTERVAL '7 days'
GROUP BY job_name;

-- --------------------------------------------------------------------------
-- Triggers (updated_at maintenance)
-- --------------------------------------------------------------------------
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (
        'universities','students','courses','classes','enrollments','attendance',
        'class_schedules','sync_logs','points','streaks','achievements',
        'student_achievements','leaderboards','friends','challenges',
        'challenge_participants','rewards','redemptions','notifications',
        'push_subscriptions','class_feedback','feedback_prompts'
      )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at_on_%I ON public.%I;', rec.tablename, rec.tablename);
    EXECUTE format('CREATE TRIGGER set_updated_at_on_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();', rec.tablename, rec.tablename);
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- Row Level Security Baseline Policies
-- --------------------------------------------------------------------------
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (
        'universities','students','courses','classes','enrollments','attendance',
        'class_schedules','sync_logs','points','streaks','achievements',
        'student_achievements','leaderboards','friends','challenges',
        'challenge_participants','rewards','redemptions','notifications',
        'push_subscriptions','class_feedback','feedback_prompts','cron_job_executions'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "service_role_full_access" ON public.%I;', tbl.tablename);
    EXECUTE format('CREATE POLICY "service_role_full_access" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);', tbl.tablename);
  END LOOP;
END $$;

-- NOTE: Fine-grained policies for authenticated users (students) should be
-- re-applied after the schema rebuild by replaying the follow-up migrations or
-- dedicated policy files. This baseline ensures service-role driven edge
-- functions and admin tooling remain operational immediately after bootstrapping.

-- --------------------------------------------------------------------------
-- Completion Banner
-- --------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE '✓ Baseline schema installed (universities, students, gamification, cron monitoring).';
  RAISE NOTICE '→ Replay subsequent migrations (20241023+ series) to restore incremental changes.';
END $$;
