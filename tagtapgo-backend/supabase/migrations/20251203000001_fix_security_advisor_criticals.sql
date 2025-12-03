-- Migration: Fix Security Advisor Critical Errors
-- Description: Adds search_path to SECURITY DEFINER functions and ensures RLS is enabled on all tables.

-- ============================================================================
-- 1. Fix Function Search Paths (SECURITY DEFINER vulnerability)
-- ============================================================================

-- Fix Vault Helper Functions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_vault_secret') THEN
    ALTER FUNCTION public.get_vault_secret(TEXT) SET search_path = public, pg_temp;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'add_vault_secret') THEN
    ALTER FUNCTION public.add_vault_secret(TEXT, TEXT, TEXT) SET search_path = public, pg_temp;
  END IF;
END $$;

-- Fix Sync Job Functions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'execute_attendance_sync_job') THEN
    ALTER FUNCTION public.execute_attendance_sync_job() SET search_path = public, pg_temp;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'invoke_goal_notification_job') THEN
    ALTER FUNCTION public.invoke_goal_notification_job() SET search_path = public, pg_temp;
  END IF;
END $$;

-- Fix Alerting Functions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'alert_exists') THEN
    ALTER FUNCTION public.alert_exists(UUID, TEXT, INTEGER) SET search_path = public, pg_temp;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'create_sync_alert') THEN
    ALTER FUNCTION public.create_sync_alert(UUID, TEXT, TEXT, TEXT, JSONB) SET search_path = public, pg_temp;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'resolve_sync_alert') THEN
    ALTER FUNCTION public.resolve_sync_alert(UUID) SET search_path = public, pg_temp;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'resolve_university_alerts') THEN
    ALTER FUNCTION public.resolve_university_alerts(UUID) SET search_path = public, pg_temp;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'check_consecutive_failures') THEN
    ALTER FUNCTION public.check_consecutive_failures() SET search_path = public, pg_temp;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'check_stale_syncs') THEN
    ALTER FUNCTION public.check_stale_syncs() SET search_path = public, pg_temp;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'check_low_success_rate') THEN
    ALTER FUNCTION public.check_low_success_rate() SET search_path = public, pg_temp;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'trigger_alert_checks') THEN
    ALTER FUNCTION public.trigger_alert_checks() SET search_path = public, pg_temp;
  END IF;
END $$;

-- ============================================================================
-- 2. Ensure RLS is Enabled on All Public Tables
-- ============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
  LOOP
    -- Enable RLS if not already enabled (idempotent)
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- ============================================================================
-- 3. Comments
-- ============================================================================

COMMENT ON FUNCTION public.get_vault_secret(TEXT) IS 'Securely retrieve decrypted secret from vault (Fixed search_path)';
