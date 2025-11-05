-- ============================================================================
-- Add Attendance Goal Defaults to Student Settings
-- ============================================================================
-- Purpose:
--   Document the attendance_goal structure in students.settings JSONB field
--   and set default goals for new students (90% monthly target).
--
-- Schema Structure:
--   students.settings = {
--     attendance_goal: {
--       type: 'weekly' | 'monthly',
--       target_percentage: number (50-100),
--       created_at: string (ISO 8601),
--       updated_at: string (ISO 8601)
--     },
--     ... other settings
--   }
--
-- Notes:
--   * No schema migration needed (JSONB is flexible)
--   * Default goal: 90% monthly attendance
--   * Students can customize via frontend UI
-- ============================================================================

-- Add comment documenting the attendance_goal structure
COMMENT ON COLUMN public.students.settings IS 
'Student preferences and goals stored as JSONB. Structure:
{
  "attendance_goal": {
    "type": "weekly" | "monthly",
    "target_percentage": 50-100,
    "created_at": "ISO 8601 timestamp",
    "updated_at": "ISO 8601 timestamp"
  },
  "notification_preferences": { ... },
  ... other settings
}';

-- Create function to initialize default attendance goal for new students
CREATE OR REPLACE FUNCTION public.initialize_default_attendance_goal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only set default if attendance_goal doesn't exist
  IF NEW.settings IS NULL OR NOT (NEW.settings ? 'attendance_goal') THEN
    NEW.settings := COALESCE(NEW.settings, '{}'::jsonb) || jsonb_build_object(
      'attendance_goal', jsonb_build_object(
        'type', 'monthly',
        'target_percentage', 90,
        'created_at', timezone('utc', now())::text,
        'updated_at', timezone('utc', now())::text
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.initialize_default_attendance_goal() IS 
'Automatically sets default attendance goal (90% monthly) for new students if not already set.';

-- Create trigger to initialize default goal on student creation
DROP TRIGGER IF EXISTS trigger_initialize_attendance_goal ON public.students;
CREATE TRIGGER trigger_initialize_attendance_goal
  BEFORE INSERT ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_default_attendance_goal();

COMMENT ON TRIGGER trigger_initialize_attendance_goal ON public.students IS 
'Ensures new students get a default attendance goal (90% monthly) on profile creation.';

-- Backfill existing students with default goal (only if they don't have one)
UPDATE public.students
SET settings = settings || jsonb_build_object(
  'attendance_goal', jsonb_build_object(
    'type', 'monthly',
    'target_percentage', 90,
    'created_at', timezone('utc', now())::text,
    'updated_at', timezone('utc', now())::text
  )
)
WHERE settings IS NULL 
   OR NOT (settings ? 'attendance_goal');

-- Log the backfill results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM public.students
  WHERE settings ? 'attendance_goal';
  
  RAISE NOTICE 'Attendance goal backfill complete. % students now have default goals.', updated_count;
END $$;
