-- Migration: Cleanup Duplicate Leaderboard Entries
-- Date: 2024-10-28
-- Description: Remove duplicate leaderboard entries and keep only the most recent ones

-- ============================================
-- PART 1: Identify and Remove Duplicates
-- ============================================

-- Create a temporary table to identify duplicates
CREATE TEMP TABLE duplicate_leaderboard_entries AS
SELECT 
    student_id,
    leaderboard_type,
    period,
    course_id,
    period_start,
    COUNT(*) as duplicate_count,
    array_agg(id ORDER BY updated_at DESC) as ids_by_recency,
    array_agg(updated_at ORDER BY updated_at DESC) as update_times
FROM public.leaderboards
GROUP BY student_id, leaderboard_type, period, course_id, period_start
HAVING COUNT(*) > 1;

-- Log the duplicates we found
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count FROM duplicate_leaderboard_entries;
    RAISE NOTICE 'Found % groups of duplicate leaderboard entries', duplicate_count;
END $$;

-- Delete older duplicate entries (keep only the most recent one)
DELETE FROM public.leaderboards
WHERE id IN (
    SELECT unnest(ids_by_recency[2:]) -- Keep first (most recent), delete rest
    FROM duplicate_leaderboard_entries
);

-- ============================================
-- PART 2: Verify Cleanup
-- ============================================

-- Check if any duplicates remain
DO $$
DECLARE
    remaining_duplicates INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_duplicates
    FROM (
        SELECT student_id, leaderboard_type, period, course_id, period_start
        FROM public.leaderboards
        GROUP BY student_id, leaderboard_type, period, course_id, period_start
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF remaining_duplicates > 0 THEN
        RAISE WARNING 'Still have % duplicate groups after cleanup', remaining_duplicates;
    ELSE
        RAISE NOTICE 'Successfully cleaned up all duplicate leaderboard entries';
    END IF;
END $$;

-- ============================================
-- PART 3: Show Current State for Test Student
-- ============================================

-- Show current leaderboard entries for the test student
SELECT 
    'After cleanup:' as status,
    leaderboard_type,
    period,
    period_start,
    points,
    current_streak,
    score,
    updated_at
FROM public.leaderboards
WHERE student_id = 'cf597a08-7203-45e9-b1c9-fe8b33a25ad6'
    AND period = 'weekly'
    AND period_start >= '2025-10-27'
ORDER BY leaderboard_type, period_start DESC;

-- ============================================
-- PART 4: Add Comment for Documentation
-- ============================================

COMMENT ON TABLE public.leaderboards IS 'Leaderboard rankings with hybrid scoring. Cleaned up duplicates on 2024-10-28.';