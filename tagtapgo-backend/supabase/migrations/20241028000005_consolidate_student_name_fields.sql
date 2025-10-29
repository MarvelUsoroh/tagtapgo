-- ============================================================================
-- Migration: Consolidate Student Name Fields
-- Date: 2024-10-28
-- Description: Remove redundant name fields and use generated columns
-- ============================================================================

-- ============================================================================
-- Step 1: Migrate data from 'name' and 'full_name' to first_name/last_name
-- ============================================================================

-- For any students that have 'name' or 'full_name' but missing first_name/last_name,
-- try to split the name
DO $$
DECLARE
  student_record RECORD;
  name_parts TEXT[];
BEGIN
  FOR student_record IN 
    SELECT id, name, full_name, first_name, last_name
    FROM students
    WHERE (first_name IS NULL OR last_name IS NULL)
      AND (name IS NOT NULL OR full_name IS NOT NULL)
  LOOP
    -- Use full_name if available, otherwise use name
    name_parts := string_to_array(
      COALESCE(student_record.full_name, student_record.name), 
      ' '
    );
    
    -- Update first_name and last_name
    UPDATE students
    SET 
      first_name = COALESCE(student_record.first_name, name_parts[1]),
      last_name = COALESCE(
        student_record.last_name, 
        CASE 
          WHEN array_length(name_parts, 1) > 1 
          THEN array_to_string(name_parts[2:array_length(name_parts, 1)], ' ')
          ELSE name_parts[1]
        END
      )
    WHERE id = student_record.id;
  END LOOP;
  
  RAISE NOTICE 'Migrated name data to first_name/last_name';
END $$;

-- ============================================================================
-- Step 2: Drop dependent views first
-- ============================================================================

-- Drop views that depend on students.name
DROP VIEW IF EXISTS leaderboard_summary CASCADE;

-- ============================================================================
-- Step 3: Drop the redundant 'name' and 'full_name' columns
-- ============================================================================

ALTER TABLE students DROP COLUMN IF EXISTS name;
ALTER TABLE students DROP COLUMN IF EXISTS full_name;

-- ============================================================================
-- Step 4: Add generated column for full_name
-- ============================================================================

-- Add full_name as a generated column (computed from first_name + last_name)
ALTER TABLE students 
ADD COLUMN full_name TEXT 
GENERATED ALWAYS AS (
  TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
) STORED;

-- Add index on full_name for searching
CREATE INDEX IF NOT EXISTS idx_students_full_name ON students(full_name);

-- ============================================================================
-- Step 5: Recreate leaderboard_summary view (if it existed)
-- ============================================================================

-- Note: This view will need to be recreated by the leaderboard migration
-- or manually if it was created outside of migrations

-- ============================================================================
-- Step 6: Add helpful view for display names
-- ============================================================================

-- Create a view that provides different name formats
CREATE OR REPLACE VIEW students_display AS
SELECT 
  id,
  university_id,
  external_id,
  email,
  username,
  first_name,
  last_name,
  full_name,
  -- Display name: prefer full_name, fallback to username or email
  COALESCE(
    NULLIF(full_name, ''),
    username,
    split_part(email, '@', 1)
  ) AS display_name,
  -- Formal name: Last, First
  CASE 
    WHEN first_name IS NOT NULL AND last_name IS NOT NULL 
    THEN last_name || ', ' || first_name
    ELSE full_name
  END AS formal_name,
  -- Short name: First name or username
  COALESCE(
    first_name,
    username,
    split_part(email, '@', 1)
  ) AS short_name,
  status,
  grade_level,
  student_number,
  year,
  major,
  avatar_url,
  settings,
  metadata,
  created_at,
  updated_at
FROM students;

-- Grant permissions on the view
GRANT SELECT ON students_display TO authenticated;
GRANT SELECT ON students_display TO service_role;

-- ============================================================================
-- Step 7: Update comments
-- ============================================================================

COMMENT ON COLUMN students.first_name IS 'Student first name';
COMMENT ON COLUMN students.last_name IS 'Student last name';
COMMENT ON COLUMN students.full_name IS 'Generated: first_name + last_name';
COMMENT ON COLUMN students.username IS 'Optional username for login (if different from email)';
COMMENT ON VIEW students_display IS 'Provides various name formats for display purposes';

-- ============================================================================
-- Summary
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Student Name Fields Consolidated';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Removed columns:';
  RAISE NOTICE '  - name (redundant)';
  RAISE NOTICE '  - full_name (now generated)';
  RAISE NOTICE '';
  RAISE NOTICE 'Kept columns:';
  RAISE NOTICE '  - first_name (source)';
  RAISE NOTICE '  - last_name (source)';
  RAISE NOTICE '  - username (optional)';
  RAISE NOTICE '  - full_name (generated from first + last)';
  RAISE NOTICE '';
  RAISE NOTICE 'New view: students_display';
  RAISE NOTICE '  - display_name (for UI)';
  RAISE NOTICE '  - formal_name (Last, First)';
  RAISE NOTICE '  - short_name (First name only)';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
END $$;
