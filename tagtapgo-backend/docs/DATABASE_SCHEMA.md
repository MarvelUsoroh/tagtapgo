# Database Schema Documentation

## Overview

This reflects the live Supabase database as of the latest check. The public schema currently contains 22 core tables, 1 view, row-level security on all tables, and standard update triggers on several tables.

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

### 4) Social & Challenges
- `friends` — Friend relationships
- `challenges` — Challenge definitions
- `challenge_participants` — Participation + progress

### 5) Rewards & Redemptions
- `rewards` — Reward catalog
- `redemptions` — Reward issuance/usage

### 6) System & Notifications
- `notifications` — Push/UX notifications per student
- `push_subscriptions` — Web push subscriptions per student

### 7) Feedback & Quality Improvement
- `class_feedback` — Student feedback on class sessions (ratings + comments)
- `feedback_prompts` — Tracks feedback prompt status per student per session (includes `prompt_sent_at` timestamp, default now())
- `feedback_analytics` — Materialized view for aggregated feedback metrics (future)

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
    │   └─ feedback_prompts
    └─ courses
            ├─ classes
            │   └─ class_schedules
            │       ├─ feedback_prompts
            │       └─ class_feedback
            ├─ attendance
            ├─ enrollments
            └─ leaderboards
```

Foreign keys (CASCADE/RESTRICT as configured) enforce the above; see Constraints below for details.

## Views

- `student_points_balance` — Aggregated points balance per student

## Materialized Views (Planned)

- `feedback_analytics` — Aggregated feedback metrics per course/session (to be created for admin dashboard)

## Row-Level Security (RLS)

- RLS is enabled on ALL public tables: achievements, attendance, challenge_participants, challenges, class_schedules, classes, courses, enrollments, friends, leaderboards, notifications, points, push_subscriptions, redemptions, rewards, streaks, student_achievements, students, sync_logs, universities.
- Representative policies (non-exhaustive):
    - achievements: students can read all definitions.
    - students: a student can read their own row.
    - attendance: a student can read their own attendance rows.
    - courses/classes: students can read rows when enrolled or scheduled for them.
    - notifications: students can read/update their own notifications.
    - points, streaks, student_achievements, redemptions, push_subscriptions: students can read (and where appropriate insert/update/delete) their own rows.

Note: Admin/service role bypasses RLS as usual in Supabase when needed for system jobs.

## Constraints (primary, unique, foreign, checks)

Highlights by table (abbreviated):
- universities
    - PK: id; UNIQUE: domain; CHECK: sis_type ∈ ['moodle','openSIS','generic']
- students
    - PK: id; UNIQUE: email; UNIQUE: (university_id, external_id)
    - FK: university_id → universities.id (ON DELETE CASCADE)
- courses
    - PK: id; UNIQUE: (university_id, external_id)
    - FK: university_id → universities.id (ON DELETE CASCADE)
- classes
    - PK: id; FK: course_id → courses.id (ON DELETE CASCADE)
- enrollments
    - PK: id; UNIQUE: (student_id, course_id)
    - FK: student_id → students.id; course_id → courses.id (both ON DELETE CASCADE)
- attendance
    - PK: id; UNIQUE: (student_id, course_id, date)
    - CHECK: status ∈ ['present','absent','late','excused']; source ∈ ['manual','sis','nfc','qr','other']
    - FK: student_id → students.id; course_id → courses.id (ON DELETE CASCADE)
- points
    - PK: id; CHECK: transaction_type ∈ ['attendance','achievement','bonus','early_arrival','perfect_week','perfect_month','streak','challenge','referral','redemption','adjustment','feedback']
    - FK: student_id → students.id (ON DELETE CASCADE)
    - Note: 'feedback' transaction type added for class feedback submissions
- streaks
    - PK: id; UNIQUE: (student_id); FK: student_id → students.id (ON DELETE CASCADE)
- achievements
    - PK: id; UNIQUE: name; CHECK: category ∈ ['attendance','streak','time','social','reward']; CHECK: rarity ∈ ['common','rare','epic','legendary']
- student_achievements
    - PK: id; UNIQUE: (student_id, achievement_id)
    - FK: student_id → students.id; achievement_id → achievements.id (both ON DELETE CASCADE)
- leaderboards
    - PK: id; UNIQUE: (student_id, leaderboard_type, period, course_id, period_start)
    - CHECK: leaderboard_type ∈ ['class','year','school','friend']; CHECK: period ∈ ['weekly','monthly','all_time']
    - FK: student_id → students.id; course_id → courses.id (ON DELETE CASCADE)
- friends
    - PK: id; UNIQUE: (student_id, friend_id); CHECK: status ∈ ['pending','accepted','declined','blocked']; CHECK: student_id <> friend_id
    - FK: student_id → students.id; friend_id → students.id (ON DELETE CASCADE)
- rewards
    - PK: id; CHECK: category ∈ ['food','shopping','entertainment','education','other']
- redemptions
    - PK: id; UNIQUE: redemption_code
    - CHECK: status ∈ ['pending','issued','used','expired','cancelled']
    - FK: student_id → students.id (ON DELETE CASCADE); reward_id → rewards.id (ON DELETE RESTRICT)
- notifications
    - PK: id; FK: student_id → students.id (ON DELETE CASCADE)
    - CHECK: notification_type ∈ ['streak_risk','achievement_unlocked','challenge_invitation','rank_change','reward_redemption','friend_request','other']
- push_subscriptions
    - PK: id; UNIQUE: (student_id); FK: student_id → students.id (ON DELETE CASCADE)
- class_schedules
    - PK: id; CHECK: status ∈ ['scheduled','cancelled','completed']
    - FK: class_id → classes.id; student_id → students.id (both ON DELETE CASCADE)
- sync_logs
    - PK: id; CHECK: status ∈ ['started','completed','failed']; CHECK: sync_type ∈ ['students','courses','attendance','full']
    - FK: university_id → universities.id (ON DELETE CASCADE)
- class_feedback
    - PK: id; UNIQUE: (student_id, class_schedule_id)
    - CHECK: content_quality BETWEEN 1 AND 5; CHECK: clarity BETWEEN 1 AND 5; CHECK: pace BETWEEN 1 AND 5
    - FK: student_id → students.id (ON DELETE CASCADE); class_schedule_id → class_schedules.id (ON DELETE CASCADE); class_id → classes.id (ON DELETE CASCADE)
- feedback_prompts
    - PK: id; UNIQUE: (student_id, class_schedule_id)
    - CHECK: status ∈ ['pending','completed','expired','skipped']
    - FK: student_id → students.id (ON DELETE CASCADE); class_schedule_id → class_schedules.id (ON DELETE CASCADE)

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
 - class_feedback: UNIQUE(student_id, class_schedule_id); btree on student_id, class_id, class_schedule_id, submitted_at DESC
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
