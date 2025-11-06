-- Normalize all achievement bonus points to 10 for MVP consistency
-- Migration: 20251106173500_normalize_achievement_points.sql
-- Purpose: Set achievements.points_reward = 10 across all rows to simplify reward tuning.
-- Idempotent: Only updates rows where points_reward <> 10.
-- Audit: Raises NOTICE with count of rows updated.

DO $$
DECLARE
  v_tag text := '20251106173500_normalize_achievement_points';
  v_updated int := 0;
BEGIN
  UPDATE public.achievements
  SET points_reward = 10,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('normalized_by_migration', v_tag)
  WHERE points_reward IS DISTINCT FROM 10;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Achievement points normalization complete. Rows updated: %', v_updated;
END $$;
