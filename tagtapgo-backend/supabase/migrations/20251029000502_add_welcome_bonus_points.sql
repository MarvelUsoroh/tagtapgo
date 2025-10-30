-- ============================================================================
-- Welcome Bonus Points System
-- ============================================================================
-- 
-- This migration adds a welcome bonus of 100 points for new students.
-- Awards points automatically when a student profile is created.
--
-- Features:
-- - Modular: Can be easily disabled by dropping the trigger
-- - Idempotent: Won't award points twice to the same student
-- - Backfills: Awards points to existing students without welcome bonus
--
-- Related: User → Student Profile Creation Flow, Gamification
-- ============================================================================

-- ============================================================================
-- 1. Create function to award welcome bonus
-- ============================================================================

CREATE OR REPLACE FUNCTION public.award_welcome_bonus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points_awarded BOOLEAN := FALSE;
BEGIN
  -- Check if welcome bonus already awarded
  -- Using transaction_type = 'bonus' with metadata.bonus_type = 'welcome'
  IF EXISTS (
    SELECT 1 FROM public.points 
    WHERE student_id = NEW.id 
      AND transaction_type = 'bonus'
      AND metadata->>'bonus_type' = 'welcome'
  ) THEN
    RAISE NOTICE 'Welcome bonus already awarded to student %', NEW.id;
    RETURN NEW;
  END IF;

  -- Award welcome bonus points
  BEGIN
    INSERT INTO public.points (
      student_id,
      points,
      transaction_type,
      reference_id,
      description,
      metadata
    ) VALUES (
      NEW.id,
      100,
      'bonus',  -- Using 'bonus' type (allowed by CHECK constraint)
      NEW.id::TEXT,  -- Use student ID as reference for idempotency
      'Welcome to TagTapGo! 🎉',
      jsonb_build_object(
        'bonus_type', 'welcome',  -- Distinguish from other bonuses
        'awarded_at', NOW(),
        'awarded_by', 'auto_trigger'
      )
    );

    v_points_awarded := TRUE;
    RAISE NOTICE 'Awarded 100 welcome bonus points to student %', NEW.id;
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error but don't fail profile creation
      RAISE WARNING 'Failed to award welcome bonus to student %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. Create trigger on students table
-- ============================================================================

DROP TRIGGER IF EXISTS on_student_created_award_bonus ON public.students;

CREATE TRIGGER on_student_created_award_bonus
  AFTER INSERT ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.award_welcome_bonus();

-- ============================================================================
-- 3. Backfill welcome bonus for existing students
-- ============================================================================

DO $$
DECLARE
  v_student RECORD;
  v_awarded_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
  v_error_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting backfill of welcome bonus points...';
  
  -- Loop through students without welcome bonus
  FOR v_student IN 
    SELECT s.id, s.email, s.first_name, s.last_name
    FROM public.students s
    WHERE NOT EXISTS (
      SELECT 1 FROM public.points p
      WHERE p.student_id = s.id
        AND p.transaction_type = 'bonus'
        AND p.metadata->>'bonus_type' = 'welcome'
    )
    ORDER BY s.created_at
  LOOP
    BEGIN
      -- Award welcome bonus
      INSERT INTO public.points (
        student_id,
        points,
        transaction_type,
        reference_id,
        description,
        metadata
      ) VALUES (
        v_student.id,
        100,
        'bonus',  -- Using 'bonus' type (allowed by CHECK constraint)
        v_student.id::TEXT,
        'Welcome to TagTapGo! 🎉',
        jsonb_build_object(
          'bonus_type', 'welcome',  -- Distinguish from other bonuses
          'awarded_at', NOW(),
          'awarded_by', 'backfill_migration'
        )
      );

      v_awarded_count := v_awarded_count + 1;
      RAISE NOTICE '  ✓ Awarded welcome bonus to % (%) - Total: %', 
        COALESCE(v_student.first_name || ' ' || v_student.last_name, v_student.email), 
        v_student.id,
        v_awarded_count;
    EXCEPTION
      WHEN unique_violation THEN
        -- Already has welcome bonus (shouldn't happen due to WHERE clause, but just in case)
        v_skipped_count := v_skipped_count + 1;
        RAISE NOTICE '  ⊘ Skipped % - already has welcome bonus', v_student.id;
      WHEN check_violation THEN
        -- Check constraint violation (shouldn't happen with 'bonus' type)
        v_error_count := v_error_count + 1;
        RAISE WARNING '  ✗ Check constraint violation for %: %', v_student.id, SQLERRM;
      WHEN OTHERS THEN
        v_error_count := v_error_count + 1;
        RAISE WARNING '  ✗ Failed to award welcome bonus to %: %', v_student.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Welcome Bonus Backfill Complete';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Bonuses awarded: %', v_awarded_count;
  RAISE NOTICE 'Students skipped: %', v_skipped_count;
  RAISE NOTICE 'Errors: %', v_error_count;
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- 4. Create index for performance
-- ============================================================================

-- Index to quickly check if student has welcome bonus
-- Partial index on bonus transactions with welcome type
CREATE INDEX IF NOT EXISTS idx_points_welcome_bonus 
  ON public.points (student_id, transaction_type, (metadata->>'bonus_type')) 
  WHERE transaction_type = 'bonus' AND metadata->>'bonus_type' = 'welcome';

-- ============================================================================
-- 5. Verify welcome bonus distribution
-- ============================================================================

DO $$
DECLARE
  v_total_students INTEGER;
  v_students_with_bonus INTEGER;
  v_students_without_bonus INTEGER;
  v_total_points_awarded INTEGER;
BEGIN
  -- Count students
  SELECT COUNT(*) INTO v_total_students FROM public.students;
  
  -- Count students with welcome bonus
  SELECT COUNT(DISTINCT student_id) INTO v_students_with_bonus
  FROM public.points
  WHERE transaction_type = 'bonus'
    AND metadata->>'bonus_type' = 'welcome';
  
  -- Calculate students without bonus
  v_students_without_bonus := v_total_students - v_students_with_bonus;
  
  -- Calculate total points awarded
  SELECT COALESCE(SUM(points), 0) INTO v_total_points_awarded
  FROM public.points
  WHERE transaction_type = 'bonus'
    AND metadata->>'bonus_type' = 'welcome';
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Welcome Bonus Statistics';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Total students: %', v_total_students;
  RAISE NOTICE 'Students with welcome bonus: %', v_students_with_bonus;
  RAISE NOTICE 'Students without bonus: %', v_students_without_bonus;
  RAISE NOTICE 'Total points awarded: %', v_total_points_awarded;
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  
  IF v_students_without_bonus > 0 THEN
    RAISE WARNING '⚠ Still have % students without welcome bonus!', v_students_without_bonus;
  ELSE
    RAISE NOTICE '✓ All students have received their welcome bonus';
  END IF;
END $$;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON FUNCTION public.award_welcome_bonus() IS 
  'Awards 100 welcome bonus points to new students. Triggered automatically on student profile creation.';

COMMENT ON TRIGGER on_student_created_award_bonus ON public.students IS 
  'Automatically awards welcome bonus when a new student profile is created.';

-- ============================================================================
-- How to disable this feature (if needed in the future)
-- ============================================================================

-- To disable welcome bonus for new students:
-- DROP TRIGGER IF EXISTS on_student_created_award_bonus ON public.students;

-- To completely remove the feature:
-- DROP TRIGGER IF EXISTS on_student_created_award_bonus ON public.students;
-- DROP FUNCTION IF EXISTS public.award_welcome_bonus();
-- DROP INDEX IF EXISTS idx_points_welcome_bonus;
-- 
-- Note: This will NOT remove already awarded points.
-- To remove awarded points (use with caution):
-- DELETE FROM public.points 
-- WHERE transaction_type = 'bonus' 
--   AND metadata->>'bonus_type' = 'welcome';
