-- Remove duplicate foreign key constraint on leaderboards.primary_course_id
-- There are two constraints: fk_leaderboards_primary_course and leaderboards_primary_course_id_fkey
-- We'll keep the more descriptive one (fk_leaderboards_primary_course) and remove the auto-generated one

-- Drop the auto-generated foreign key constraint
ALTER TABLE public.leaderboards 
DROP CONSTRAINT IF EXISTS leaderboards_primary_course_id_fkey;

-- Verify the remaining constraint exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_leaderboards_primary_course'
      AND table_name = 'leaderboards'
  ) THEN
    RAISE NOTICE 'Foreign key constraint fk_leaderboards_primary_course exists';
  ELSE
    RAISE WARNING 'Foreign key constraint fk_leaderboards_primary_course does not exist!';
  END IF;
END $$;

COMMENT ON TABLE public.leaderboards IS 'Leaderboard rankings with hybrid scoring. Cleaned up duplicate foreign key constraints on 2025-10-28.';
