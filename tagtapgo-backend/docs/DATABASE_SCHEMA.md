# Database Schema Documentation

## Overview

This reflects the live Supabase database as of November 21, 2025. The public schema currently contains 22 core tables, row-level security on all tables, and standard update triggers.

## Table Groups

### 1) Core Entities
- `universities` — University/institution information
- `students` — Student profiles (per university)
- `courses` — Course catalog (per university)
- `classes` — Instructional sections linked to a course (location/instructor metadata)
- `enrollments` — Student–course relationships

### 2) Attendance & Scheduling
- `attendance` — Attendance records synced from SIS/LMS
- `class_schedules` — Per-student schedule entries referencing a class with start/end times
- `sync_logs` — SIS/LMS synchronization logs (job runs, counts, errors)

### 3) Gamification
- `points` — Points transactions (idempotent ledger for awards/adjustments)
- `streaks` — Streak tracking (one row per student)
- `achievements` — Achievement definitions
- `student_achievements` — Unlocked achievements and progress
- `leaderboards` — Leaderboard rankings and periods
- `goal_achievement_history` — Tracks when students achieve their attendance goals

### 4) Social & Challenges
- `friends` — Friend relationships
- `challenges` — Challenge definitions
- `challenge_participants` — Participation + progress

### 5) Rewards & Redemptions
- `rewards` — Reward catalog
- `redemptions` — Reward issuance/usage
- `reward_views` — Tracks when students view rewards
- `redemption_analytics` — Enhanced analytics for brand partnership ROI

### 6) System & Notifications
- `notifications` — Push/UX notifications per student
- `push_subscriptions` — Web push subscriptions per student
- `cron_job_executions` — Logs for pg_cron job executions

### 7) Feedback & Quality Improvement
- `class_feedback` — Student feedback on class sessions (ratings + comments)
- `feedback_prompts` — Tracks feedback prompt status per student per session
- `feedback_conversations` — AI chat sessions for qualitative feedback
- `feedback_messages` — Individual messages within feedback conversations

## Key Relationships

```
universities
    ├─ students
    │   ├─ attendance
    │   ├─ points
    │   ├─ streaks
    │   ├─ student_achievements
    │   ├─ leaderboards
    │   ├─ redemptions
    │   ├─ notifications
    │   ├─ class_feedback
    │   ├─ feedback_prompts
    │   └─ feedback_conversations
    │       └─ feedback_messages
    └─ courses
            ├─ classes
            │   └─ class_schedules
            │       ├─ feedback_prompts
            │       └─ class_feedback
            ├─ attendance
            ├─ enrollments
            └─ leaderboards
```

## Tables Detail

### universities
- `id` (uuid, PK): `gen_random_uuid()`
- `name` (text)
- `domain` (text, UNIQUE)
- `sis_type` (text): CHECK `sis_type IN ('moodle', 'openSIS', 'generic')`
- `timezone` (text): DEFAULT `'UTC'`
- `api_config` (jsonb): Adapter configuration payload
- `metadata` (jsonb)
- `active` (boolean): DEFAULT `true`
- `last_sync_at` (timestamptz)
- `last_sync_status` (text): CHECK `last_sync_status IN ('success', 'error', 'never')`
- `last_sync_error` (text)
- `created_at`, `updated_at` (timestamptz)

### students
- `id` (uuid, PK): `gen_random_uuid()`
- `university_id` (uuid, FK)
- `external_id` (text)
- `email` (text, UNIQUE)
- `username` (text)
- `first_name`, `last_name` (text)
- `full_name` (text, GENERATED)
- `status` (text): DEFAULT `'active'`
- `grade_level`, `student_number`, `year`, `major` (text/int)
- `avatar_url` (text)
- `settings` (jsonb): Student preferences and goals
- `metadata` (jsonb)
- `created_at`, `updated_at` (timestamptz)

### courses
- `id` (uuid, PK): `gen_random_uuid()`
- `university_id` (uuid, FK)
- `external_id` (text)
- `code` (text)
- `name` (text)
- `short_name` (text)
- `description` (text)
- `start_at`, `end_at` (timestamptz)
- `schedule` (jsonb)
- `metadata` (jsonb)
- `active` (boolean): DEFAULT `true`
- `created_at`, `updated_at` (timestamptz)

### classes
- `id` (uuid, PK): `gen_random_uuid()`
- `course_id` (uuid, FK)
- `section` (text)
- `instructor_name`, `instructor_email` (text)
- `location` (text)
- `start_date`, `end_date` (date)
- `capacity` (integer)
- `metadata` (jsonb)
- `created_at`, `updated_at` (timestamptz)

### enrollments
- `id` (uuid, PK): `gen_random_uuid()`
- `student_id` (uuid, FK)
- `course_id` (uuid, FK)
- `role` (text): CHECK `role IN ('student', 'ta', 'instructor')`
- `status` (text): CHECK `status IN ('active', 'dropped', 'completed', 'pending')`
- `enrolled_at` (timestamptz)
- `metadata` (jsonb)
- `created_at`, `updated_at` (timestamptz)

### attendance
- `id` (uuid, PK): `gen_random_uuid()`
- `university_id` (uuid, FK)
- `student_id` (uuid, FK)
- `course_id` (uuid, FK)
- `class_id` (uuid, FK)
- `session_id` (text)
- `period` (text)
- `date` (date)
- `status` (text): CHECK `status IN ('present', 'late', 'excused', 'absent', 'unknown')`
- `status_code` (text)
- `source` (text): CHECK `source IN ('manual', 'sis', 'nfc', 'qr', 'other')`
- `recorded_at`, `check_in_time`, `scheduled_time` (timestamptz)
- `source_tz`, `time` (text)
- `metadata` (jsonb): Stores session topic/context
- `created_at`, `updated_at` (timestamptz)

### class_schedules
- `id` (uuid, PK): `gen_random_uuid()`
- `university_id` (uuid, FK)
- `course_id` (uuid, FK)
- `class_id` (uuid, FK)
- `day_of_week` (text)
- `period` (text)
- `start_time`, `end_time` (time)
- `location` (text)
- `instructor_id` (text)
- `effective_from`, `effective_to` (date)
- `metadata` (jsonb)
- `created_at`, `updated_at` (timestamptz)

### points
- `id` (uuid, PK): `gen_random_uuid()`
- `student_id` (uuid, FK)
- `points` (integer)
- `transaction_type` (text): CHECK `transaction_type IN ('attendance', 'achievement', 'bonus', 'early_arrival', 'perfect_week', 'perfect_month', 'streak', 'challenge', 'referral', 'redemption', 'adjustment', 'feedback', 'feedback_reward')`
- `reference_id` (text)
- `description` (text)
- `metadata` (jsonb)
- `created_at`, `updated_at` (timestamptz)

### streaks
- `id` (uuid, PK): `gen_random_uuid()`
- `student_id` (uuid, FK, UNIQUE)
- `current_streak`, `longest_streak` (integer)
- `last_attendance_date` (date)
- `streak_freeze_count` (integer)
- `last_freeze_used_at` (timestamptz)
- `freeze_reset_date` (date)
- `created_at`, `updated_at` (timestamptz)

### achievements
- `id` (uuid, PK): `gen_random_uuid()`
- `name` (text)
- `description` (text)
- `badge_image_url` (text)
- `category` (text): CHECK `category IN ('attendance', 'streak', 'time', 'social', 'reward')`
- `criteria` (jsonb)
- `points_reward` (integer)
- `rarity` (text): CHECK `rarity IN ('common', 'rare', 'epic', 'legendary')`
- `is_active` (boolean)
- `metadata` (jsonb)
- `created_at`, `updated_at` (timestamptz)

### student_achievements
- `id` (uuid, PK): `gen_random_uuid()`
- `student_id` (uuid, FK)
- `achievement_id` (uuid, FK)
- `progress` (jsonb)
- `unlocked` (boolean)
- `unlocked_at`, `last_progress_at` (timestamptz)
- `metadata` (jsonb)
- `created_at`, `updated_at` (timestamptz)

### leaderboards
- `id` (uuid, PK): `gen_random_uuid()`
- `student_id` (uuid, FK)
- `university_id` (uuid, FK)
- `leaderboard_type` (text): CHECK `leaderboard_type IN ('class', 'year', 'school', 'friend')`
- `period` (text): CHECK `period IN ('weekly', 'monthly', 'all_time')`
- `course_id` (uuid, FK)
- `primary_course_id` (uuid, FK)
- `rank`, `points`, `current_streak`, `longest_streak` (integer)
- `score` (integer, GENERATED)
- `period_start`, `period_end` (date)
- `metadata` (jsonb)
- `created_at`, `updated_at` (timestamptz)

### feedback_prompts
- `id` (uuid, PK): `gen_random_uuid()`
- `student_id` (uuid, FK)
- `class_schedule_id` (uuid, FK)
- `status` (text): CHECK `status IN ('pending', 'completed', 'expired', 'skipped')`
- `prompt_sent_at` (timestamptz)
- `expires_at` (timestamptz)
- `completed_at` (timestamptz)
- `metadata` (jsonb): Contextual data (e.g., session topic)
- `created_at`, `updated_at` (timestamptz)

### feedback_conversations
- `id` (uuid, PK): `gen_random_uuid()`
- `student_id` (uuid, FK)
- `class_schedule_id` (uuid, FK)
- `started_at` (timestamptz)
- `completed_at` (timestamptz)
- `sentiment_score` (float)
- `summary` (text)
- `points_awarded` (integer)
- `metadata` (jsonb)
- `created_at`, `updated_at` (timestamptz)

### feedback_messages
- `id` (uuid, PK): `gen_random_uuid()`
- `conversation_id` (uuid, FK)
- `sender_type` (text): CHECK `sender_type IN ('user', 'ai')`
- `content` (text)
- `metadata` (jsonb)
- `created_at` (timestamptz)

### class_feedback
- `id` (uuid, PK): `gen_random_uuid()`
- `student_id` (uuid, FK)
- `class_schedule_id` (uuid, FK)
- `class_id` (uuid, FK)
- `course_id` (uuid, FK)
- `content_quality`, `clarity`, `pace` (integer): 1-5
- `comments` (text)
- `metadata` (jsonb)
- `submitted_at` (timestamptz)
- `created_at`, `updated_at` (timestamptz)

### rewards
- `id` (uuid, PK): `gen_random_uuid()`
- `brand`, `name`, `description`, `image_url` (text)
- `points_cost` (integer)
- `category` (text)
- `stock` (integer)
- `active` (boolean)
- `metadata` (jsonb)
- `created_at`, `updated_at` (timestamptz)

### redemptions
- `id` (uuid, PK): `gen_random_uuid()`
- `student_id` (uuid, FK)
- `reward_id` (uuid, FK)
- `points_spent` (integer)
- `redemption_code` (text, UNIQUE)
- `status` (text): CHECK `status IN ('pending', 'issued', 'used', 'expired', 'cancelled')`
- `issued_at`, `used_at`, `expires_at` (timestamptz)
- `metadata` (jsonb)
- `created_at`, `updated_at` (timestamptz)

### notifications
- `id` (uuid, PK): `gen_random_uuid()`
- `student_id` (uuid, FK)
- `notification_type`, `title`, `message` (text)
- `data` (jsonb)
- `read` (boolean)
- `created_at`, `updated_at` (timestamptz)

### push_subscriptions
- `id` (uuid, PK): `gen_random_uuid()`
- `student_id` (uuid, FK, UNIQUE)
- `subscription` (jsonb)
- `created_at`, `updated_at` (timestamptz)

### sync_logs
- `id` (uuid, PK): `gen_random_uuid()`
- `university_id` (uuid, FK)
- `sync_type` (text)
- `status` (text)
- `records_processed`, `duration_ms` (integer)
- `error_message` (text)
- `metadata` (jsonb)
- `created_at` (timestamptz)

### cron_job_executions
- `id` (uuid, PK): `gen_random_uuid()`
- `job_name` (text)
- `status` (text)
- `started_at`, `completed_at` (timestamptz)
- `duration_ms` (integer)
- `error_message` (text)
- `records_processed`, `records_succeeded`, `records_failed` (integer)
- `metadata` (jsonb)
- `created_at` (timestamptz)

## Indexes (selected)

Performance and integrity indexes (abbreviated):
- Common PK/UNIQUE btree indexes on all primary/unique keys above
- attendance: (student_id, course_id, date) UNIQUE; btree on student_id, course_id, date, status
- enrollments: (student_id, course_id) UNIQUE; btree on student_id, course_id
- courses: (university_id, external_id) UNIQUE; btree on university_id, external_id
- students: UNIQUE(email), UNIQUE(university_id, external_id); btree on email, external_id, university_id
- streaks: UNIQUE(student_id); btree on student_id, current_streak DESC
- leaderboards: UNIQUE(student_id, leaderboard_type, period, course_id, period_start); btree on student_id, type/period, course, rank
- notifications: btree on student_id, created_at DESC, read
- points: btree on student_id, transaction_type, created_at DESC
- redemptions: UNIQUE(redemption_code); btree on student_id, reward_id, status, redemption_code
- class_schedules: btree on (class_id, start_time), (student_id, start_time)
- friends: UNIQUE(student_id, friend_id); btree on student_id, friend_id, status
- rewards: btree on active, brand, points_cost
- universities: UNIQUE(domain); btree on domain
- class_feedback: UNIQUE(student_id, class_schedule_id); btree on student_id, course_id, class_schedule_id, submitted_at DESC
- feedback_prompts: UNIQUE(student_id, class_schedule_id); btree on student_id, status, expires_at

## Functions & Triggers

### Functions (project scope)
- `public.update_updated_at_column()` — standard trigger helper to set updated_at = now() on UPDATE
    - Also a storage-scoped variant: `storage.update_updated_at_column()` used by Supabase storage
- Many extension-provided functions are available (uuid-ossp, pgcrypto, graphql, vault, storage, realtime, etc.).

### Triggers (notable)
- BEFORE UPDATE triggers calling `update_updated_at_column()` on:
    - `universities`, `students`, `streaks`, `rewards`, `courses`, `classes`, `challenges`
- Supabase Storage triggers on `storage.*` tables (prefix management, updated_at maintenance)

## Data Types & Conventions

- Primary keys: UUID (`uuid_generate_v4()`)
- Timestamps: `timestamptz` (timezone-aware)
- Flexible metadata: `jsonb`
- Enum-like fields: TEXT with CHECK constraints

## Extensions (installed/used)

- Installed highlights: `uuid-ossp`, `pgcrypto`, `pg_stat_statements`, `pg_graphql`, `supabase_vault`, `pg_cron` (and others provided by Supabase)
- Actively used by schema: `uuid-ossp` (PK generation), `pgcrypto` (crypto helpers as needed)

## Performance & Ops Notes

- Indexes in place on foreign keys and common filters across major tables
- No materialized views currently; consider adding for heavy leaderboard aggregations later
- RLS enabled everywhere; service role for internal jobs (sync/awards)
- Consider periodic vacuum/analyze and monitoring via `pg_stat_statements`

## Gaps vs. Proposed Features

- Geolocation-related tables proposed in docs (`campus_zones`, `location_checks`, `student_locations`) are NOT present in the live schema yet.
- Any changes to points calculation tied to location should continue to use the `points` ledger and not add columns to `attendance` unless/ until migrations are applied.

## Backup & Recovery

- Supabase automatic daily backups, PITR available
- Manual logical backups via `pg_dump` as needed

## Scaling Strategy

- Scale reads via replicas (analytics), partition large tables if growth warrants (future)
- Potential caching (e.g., Redis) for hot leaderboard reads (future)
