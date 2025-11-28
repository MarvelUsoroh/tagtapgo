-- Migration: Fix leaderboard duplicates and add unique constraint
-- This ensures only one leaderboard entry per student per type per period

-- Step 1: Delete duplicate leaderboard entries, keeping only the most recent
DELETE FROM leaderboards l1
WHERE l1.id NOT IN (
  SELECT DISTINCT ON (student_id, leaderboard_type, period, period_start) id
  FROM leaderboards
  ORDER BY student_id, leaderboard_type, period, period_start, updated_at DESC
);

-- Step 2: Add unique constraint to prevent future duplicates
ALTER TABLE leaderboards
ADD CONSTRAINT leaderboards_unique_entry 
UNIQUE (student_id, leaderboard_type, period, period_start);

-- Step 3: Delete duplicate notifications (same student, type, title within 1 minute)
DELETE FROM notifications n1
WHERE n1.id NOT IN (
  SELECT DISTINCT ON (student_id, notification_type, title, DATE_TRUNC('minute', created_at)) id
  FROM notifications
  ORDER BY student_id, notification_type, title, DATE_TRUNC('minute', created_at), created_at ASC
);
