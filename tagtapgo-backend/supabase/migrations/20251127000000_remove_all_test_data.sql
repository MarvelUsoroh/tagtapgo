-- Migration: Remove all hardcoded test data
-- Only Moodle-synced data should remain
-- Test data is identified by hardcoded UUIDs (pattern: 11111111-*, 22222222-*, etc.)

-- Step 1: Delete leaderboards referencing test courses
DELETE FROM leaderboards 
WHERE primary_course_id IN (
  'c1111111-1111-1111-1111-111111111111',
  'c2222222-2222-2222-2222-222222222222',
  'c3333333-3333-3333-3333-333333333333'
);

-- Step 2: Delete attendance records for test courses
DELETE FROM attendance 
WHERE course_id IN (
  'c1111111-1111-1111-1111-111111111111',
  'c2222222-2222-2222-2222-222222222222',
  'c3333333-3333-3333-3333-333333333333'
);

-- Step 3: Delete enrollments for test courses
DELETE FROM enrollments 
WHERE course_id IN (
  'c1111111-1111-1111-1111-111111111111',
  'c2222222-2222-2222-2222-222222222222',
  'c3333333-3333-3333-3333-333333333333'
);

-- Step 4: Delete test classes
DELETE FROM classes 
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

-- Step 5: Delete test courses
DELETE FROM courses 
WHERE id IN (
  'c1111111-1111-1111-1111-111111111111',
  'c2222222-2222-2222-2222-222222222222',
  'c3333333-3333-3333-3333-333333333333'
);

-- Verify: Only Moodle-synced data should remain
-- Classes with moodle_attendance_id in metadata are from Moodle sync
