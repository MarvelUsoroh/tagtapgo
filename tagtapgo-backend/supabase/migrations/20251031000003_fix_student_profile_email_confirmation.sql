-- ============================================================================
-- Fix Student Profile Creation - Require Email Confirmation
-- ============================================================================
-- 
-- This migration updates the auto-create student profile trigger to only
-- create profiles for users with confirmed emails.
--
-- Issue: The original trigger created profiles immediately on user creation,
-- even if the email wasn't confirmed yet. This could lead to:
-- - Unconfirmed users accessing the system
-- - Spam/fake accounts getting profiles
-- - Security concerns
--
-- Solution: Check email_confirmed_at before creating profile
--
-- Related: User → Student Profile Creation Flow, Email Verification
-- ============================================================================

-- ============================================================================
-- 1. Update trigger function to check email confirmation
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

  -- ⚠️ IMPORTANT: Only create profile if email is confirmed
  -- This prevents unconfirmed/spam accounts from getting profiles
  IF NEW.email_confirmed_at IS NULL THEN
    RAISE NOTICE 'Skipping student profile creation for user % - email not confirmed', NEW.id;
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
      'created_at', NOW(),
      'email_confirmed_at', NEW.email_confirmed_at
    )
  )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Created student profile for confirmed user %', NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Failed to create student profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. Create trigger for email confirmation updates
-- ============================================================================
-- 
-- This trigger handles the case where a user confirms their email AFTER
-- initial signup. When email_confirmed_at changes from NULL to a timestamp,
-- we create the student profile.

CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
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
  -- Only proceed if email was just confirmed (NULL -> timestamp)
  IF OLD.email_confirmed_at IS NOT NULL OR NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

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

  -- Split full name into first and last name
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
      'created_by', 'email_confirmation_trigger',
      'created_at', NOW(),
      'email_confirmed_at', NEW.email_confirmed_at
    )
  )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Created student profile after email confirmation for user %', NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create student profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;

-- Create trigger for email confirmation
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_email_confirmed();

-- ============================================================================
-- 3. Clean up unconfirmed users without profiles (optional)
-- ============================================================================

DO $$
DECLARE
  v_unconfirmed_count INTEGER;
BEGIN
  -- Count users with unconfirmed emails who don't have profiles
  SELECT COUNT(*) INTO v_unconfirmed_count
  FROM auth.users au
  LEFT JOIN public.students s ON au.id = s.id
  WHERE au.email_confirmed_at IS NULL
    AND s.id IS NULL;

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Email Confirmation Check';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Unconfirmed users without profiles: %', v_unconfirmed_count;
  RAISE NOTICE '';
  
  IF v_unconfirmed_count > 0 THEN
    RAISE NOTICE 'These users will get profiles when they confirm their email.';
  ELSE
    RAISE NOTICE 'All users either have confirmed emails or already have profiles.';
  END IF;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- 4. Verification Query
-- ============================================================================

-- Check for any users with profiles but unconfirmed emails
-- (These would have been created by the old trigger)
SELECT 
  au.id,
  au.email,
  au.email_confirmed_at,
  s.created_at as profile_created_at,
  s.metadata->>'created_by' as created_by
FROM auth.users au
JOIN public.students s ON au.id = s.id
WHERE au.email_confirmed_at IS NULL
ORDER BY s.created_at DESC;

