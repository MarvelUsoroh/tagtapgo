-- DISABLED: This migration was superseded by 20251106101500_upsert_demo_attendance_thursday_and_future.sql
-- It referenced columns and constraints that don't exist in the current schema (session_id, period, recorded_at, etc.)
-- Keeping this file as a no-op preserves migration ordering without side effects.

DO $$
BEGIN
  RAISE NOTICE '20251106093000_upsert_demo_attendance_today_and_cron.sql is disabled (no-op).';
END $$;