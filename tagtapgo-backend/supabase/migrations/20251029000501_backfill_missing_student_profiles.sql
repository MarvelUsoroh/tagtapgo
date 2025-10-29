-- ============================================================================
-- Backfill Missing Student Profiles
-- ============================================================================
-- 
-- This migration manually backfills any users that were created before the
-- auto-create trigger was deployed, or where the backfill script failed.
--
-- Related: User → Student Profile Creation Flow
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
  RAISE NOTICE 'Starting backfill of missing student profiles...';
  
  -- Loop through users without student profiles
  FOR v_user IN 
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.students s ON au.id = s.id
    WHERE s.id IS NULL
  LOOP
    RAISE NOTICE 'Processing user: % (%)', v_user.email, v_user.id;
    
    -- Extract university_id from user metadata
    v_university_id := (v_user.raw_user_meta_data->>'university_id')::UUID;

    -- If university_id is missing or invalid, try to infer from email domain
    IF v_university_id IS NULL AND v_user.email IS NOT NULL THEN
      v_email_domain := split_part(v_user.email, '@', 2);
      
      SELECT id INTO v_university_id
      FROM public.universities
      WHERE domain = v_email_domain
      LIMIT 1;
      
      IF v_university_id IS NOT NULL THEN
        RAISE NOTICE '  Found university by email domain: %', v_email_domain;
      END IF;
    END IF;

    -- If we still don't have a university_id, skip this user
    IF v_university_id IS NULL THEN
      RAISE NOTICE '  Skipping user % - no university_id found', v_user.id;
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

    -- Use external_id from metadata or fallback to email local part or user id
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
          'created_by', 'backfill_migration_20251029000501',
          'created_at', NOW()
        )
      );

      v_created_count := v_created_count + 1;
      RAISE NOTICE '  ✓ Created student profile for user % (%)', v_user.email, v_user.id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '  ✗ Failed to create student profile for user % (%): %', v_user.email, v_user.id, SQLERRM;
        v_skipped_count := v_skipped_count + 1;
    END;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Backfill Complete';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Profiles created: %', v_created_count;
  RAISE NOTICE 'Users skipped: %', v_skipped_count;
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
END $$;

-- Verify no missing profiles remain
DO $$
DECLARE
  v_missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_missing_count
  FROM auth.users au
  LEFT JOIN public.students s ON au.id = s.id
  WHERE s.id IS NULL;
  
  IF v_missing_count > 0 THEN
    RAISE WARNING 'Still have % users without student profiles!', v_missing_count;
  ELSE
    RAISE NOTICE '✓ All users now have student profiles';
  END IF;
END $$;
