-- ============================================================================
-- Auto-Create Student Profile Trigger
-- ============================================================================
-- 
-- This migration creates a database trigger that automatically creates a
-- student profile when a new user is created in auth.users.
-- 
-- This solves the issue where users exist in auth.users but not in 
-- public.students, which causes dashboard errors.
--
-- Related: User → Student Profile Creation Flow
-- ============================================================================

-- ============================================================================
-- 1. Create trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_university_id UUID;
  v_email_domain TEXT;
  v_full_name TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_external_id TEXT;
BEGIN
  -- Check if student profile already exists
  IF EXISTS (SELECT 1 FROM public.students WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Extract university_id from user metadata
  v_university_id := (NEW.raw_user_meta_data->>'university_id')::UUID;

  -- If university_id is missing or invalid, try to infer from email domain
  IF v_university_id IS NULL AND NEW.email IS NOT NULL THEN
    v_email_domain := split_part(NEW.email, '@', 2);
    
    SELECT id INTO v_university_id
    FROM public.universities
    WHERE domain = v_email_domain
    LIMIT 1;
  END IF;

  -- If we still don't have a university_id, skip profile creation
  -- This prevents FK constraint violations
  IF v_university_id IS NULL THEN
    RAISE NOTICE 'Skipping student profile creation for user % - no university_id found', NEW.id;
    RETURN NEW;
  END IF;

  -- Extract name from metadata or email
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'Student'
  );

  -- Split full name into first and last name (simple split on first space)
  v_first_name := split_part(v_full_name, ' ', 1);
  v_last_name := CASE 
    WHEN position(' ' IN v_full_name) > 0 
    THEN substring(v_full_name FROM position(' ' IN v_full_name) + 1)
    ELSE NULL
  END;

  -- Use external_id from metadata or fallback to user id
  v_external_id := COALESCE(
    NEW.raw_user_meta_data->>'external_id',
    split_part(NEW.email, '@', 1),
    NEW.id::TEXT
  );

  -- Create student profile
  -- Note: full_name is a GENERATED ALWAYS column, so we don't insert it
  INSERT INTO public.students (
    id,
    university_id,
    external_id,
    email,
    first_name,
    last_name,
    status,
    settings,
    metadata
  ) VALUES (
    NEW.id,
    v_university_id,
    v_external_id,
    NEW.email,
    v_first_name,
    v_last_name,
    'active',
    '{}'::jsonb,
    jsonb_build_object(
      'created_by', 'auto_trigger',
      'created_at', NOW()
    )
  )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Created student profile for user %', NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Failed to create student profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. Create trigger on auth.users
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 3. Backfill existing users without student profiles
-- ============================================================================

DO $$
DECLARE
  v_user RECORD;
  v_university_id UUID;
  v_email_domain TEXT;
  v_full_name TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_external_id TEXT;
  v_created_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
BEGIN
  -- Loop through users without student profiles
  FOR v_user IN 
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.students s ON au.id = s.id
    WHERE s.id IS NULL
  LOOP
    -- Extract university_id from user metadata
    v_university_id := (v_user.raw_user_meta_data->>'university_id')::UUID;

    -- If university_id is missing or invalid, try to infer from email domain
    IF v_university_id IS NULL AND v_user.email IS NOT NULL THEN
      v_email_domain := split_part(v_user.email, '@', 2);
      
      SELECT id INTO v_university_id
      FROM public.universities
      WHERE domain = v_email_domain
      LIMIT 1;
    END IF;

    -- If we still don't have a university_id, skip this user
    IF v_university_id IS NULL THEN
      RAISE NOTICE 'Skipping user % - no university_id found', v_user.id;
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Extract name from metadata or email
    v_full_name := COALESCE(
      v_user.raw_user_meta_data->>'name',
      split_part(v_user.email, '@', 1),
      'Student'
    );

    -- Split full name into first and last name
    v_first_name := split_part(v_full_name, ' ', 1);
    v_last_name := CASE 
      WHEN position(' ' IN v_full_name) > 0 
      THEN substring(v_full_name FROM position(' ' IN v_full_name) + 1)
      ELSE NULL
    END;

    -- Use external_id from metadata or fallback to user id
    v_external_id := COALESCE(
      v_user.raw_user_meta_data->>'external_id',
      split_part(v_user.email, '@', 1),
      v_user.id::TEXT
    );

    -- Create student profile
    -- Note: full_name is a GENERATED ALWAYS column, so we don't insert it
    BEGIN
      INSERT INTO public.students (
        id,
        university_id,
        external_id,
        email,
        first_name,
        last_name,
        status,
        settings,
        metadata
      ) VALUES (
        v_user.id,
        v_university_id,
        v_external_id,
        v_user.email,
        v_first_name,
        v_last_name,
        'active',
        '{}'::jsonb,
        jsonb_build_object(
          'created_by', 'backfill_migration',
          'created_at', NOW()
        )
      );

      v_created_count := v_created_count + 1;
      RAISE NOTICE 'Created student profile for user %', v_user.id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to create student profile for user %: %', v_user.id, SQLERRM;
        v_skipped_count := v_skipped_count + 1;
    END;
  END LOOP;

  RAISE NOTICE 'Backfill complete: % profiles created, % users skipped', v_created_count, v_skipped_count;
END $$;

-- ============================================================================
-- 4. Add RLS policy for service role to insert students
-- ============================================================================

-- This policy already exists from previous migrations, but we ensure it's there
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'students' 
      AND policyname = 'service_role_full_access'
  ) THEN
    CREATE POLICY "service_role_full_access"
      ON public.students
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- Summary
-- ============================================================================

DO $$
DECLARE
  v_total_users INTEGER;
  v_total_students INTEGER;
  v_missing_profiles INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_users FROM auth.users;
  SELECT COUNT(*) INTO v_total_students FROM public.students;
  v_missing_profiles := v_total_users - v_total_students;

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Auto-Create Student Profile Migration';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Total users: %', v_total_users;
  RAISE NOTICE 'Total students: %', v_total_students;
  RAISE NOTICE 'Missing profiles: %', v_missing_profiles;
  RAISE NOTICE '';
  RAISE NOTICE 'Trigger created: on_auth_user_created';
  RAISE NOTICE 'Function created: handle_new_user()';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
END $$;
