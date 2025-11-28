-- Migration: Remove hardcoded class schedules for demo university
-- Schedules will now be synced from Moodle via attendance-sync-job
-- This aligns with the MOODLE_MINIMAL_API.md data minimization approach

-- Delete all hardcoded class_schedules for the demo university
DELETE FROM class_schedules 
WHERE university_id = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';

-- Note: The attendance-sync-job will recreate schedules from Moodle sessions
-- See: tagtapgo-backend/docs/MOODLE_MINIMAL_API.md for the data flow
