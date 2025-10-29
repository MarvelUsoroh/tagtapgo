-- ============================================================================
-- Secure Vault Helper in Public Schema
-- ============================================================================
-- 
-- This migration creates the vault helper function in the public schema
-- instead of the vault schema to avoid permission issues.
-- 
-- The function still provides secure access to vault secrets with proper
-- access control.
-- 
-- ============================================================================

-- ============================================================================
-- Secure Helper Function to Retrieve Vault Secrets (Public Schema)
-- ============================================================================

-- Helper function to safely return decrypted secret by name
-- This function provides access control and proper error handling
CREATE OR REPLACE FUNCTION public.get_vault_secret(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_decrypted TEXT;
BEGIN
  -- Access control: Only allow invocation by postgres superuser or service_role
  -- The SQL Editor uses the postgres role, so this will work
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin', 'authenticator') THEN
    RAISE EXCEPTION 'Unauthorized: Only authorized roles can access vault secrets';
  END IF;
  
  -- Retrieve secret from vault using the decrypted_secrets view
  -- This view automatically decrypts secrets when accessed
  SELECT decrypted_secret INTO v_decrypted
  FROM vault.decrypted_secrets 
  WHERE name = p_name 
  LIMIT 1;
  
  IF v_decrypted IS NULL THEN
    RAISE EXCEPTION 'Secret "%" not found in vault', p_name;
  END IF;
  
  RETURN v_decrypted;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'Insufficient privileges to access vault. Please ensure vault extension is enabled.';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error retrieving secret "%": %', p_name, SQLERRM;
END;
$$;

-- Grant execute permission to postgres and service_role
GRANT EXECUTE ON FUNCTION public.get_vault_secret(TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_vault_secret(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_vault_secret(TEXT) TO authenticator;

-- ============================================================================
-- Update Job Function to Use Public Schema Helper
-- ============================================================================

-- Function to execute the attendance sync job with tracking (using public schema helper)
CREATE OR REPLACE FUNCTION public.execute_attendance_sync_job()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_execution_id UUID;
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_duration_ms INTEGER;
  v_response JSONB;
  v_error_message TEXT;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Check if job is already running
  IF is_job_running('attendance-sync-job') THEN
    RAISE NOTICE 'Attendance sync job is already running, skipping...';
    RETURN;
  END IF;
  
  -- Record job start
  v_start_time := NOW();
  INSERT INTO cron_job_executions (job_name, started_at, status)
  VALUES ('attendance-sync-job', v_start_time, 'running')
  RETURNING id INTO v_execution_id;
  
  BEGIN
    -- Retrieve secrets from vault using secure helper (public schema)
    v_supabase_url := public.get_vault_secret('supabase_url');
    v_service_key := public.get_vault_secret('service_role_key');
    
    IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
      RAISE EXCEPTION 'Missing required configuration. Please set supabase_url and service_role_key in vault.';
    END IF;
    
    -- Call the Edge Function using http extension
    SELECT content::jsonb
    INTO v_response
    FROM http((
      'POST',
      v_supabase_url || '/functions/v1/attendance-sync-job',
      ARRAY[
        http_header('Authorization', 'Bearer ' || v_service_key),
        http_header('Content-Type', 'application/json')
      ],
      'application/json',
      '{}'
    )::http_request);
    
    -- Record success
    v_end_time := NOW();
    v_duration_ms := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;
    
    UPDATE cron_job_executions
    SET status = 'success',
        completed_at = v_end_time,
        duration_ms = v_duration_ms
    WHERE id = v_execution_id;
    
    RAISE NOTICE 'Attendance sync job completed successfully in % ms', v_duration_ms;
    
  EXCEPTION WHEN OTHERS THEN
    -- Record error
    v_end_time := NOW();
    v_duration_ms := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;
    v_error_message := SQLERRM;
    
    UPDATE cron_job_executions
    SET status = 'error',
        completed_at = v_end_time,
        duration_ms = v_duration_ms,
        error_message = v_error_message
    WHERE id = v_execution_id;
    
    RAISE WARNING 'Attendance sync job failed: %', v_error_message;
  END;
END;
$$;

-- ============================================================================
-- Update Cron Job to Use Updated Function
-- ============================================================================

-- Remove existing job
SELECT cron.unschedule('attendance-sync-job') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'attendance-sync-job'
);

-- Schedule job with updated function
SELECT cron.schedule(
  'attendance-sync-job',
  '*/5 * * * *',
  'SELECT public.execute_attendance_sync_job();'
);

-- ============================================================================
-- Helper Function to Add Secrets (Public Schema)
-- ============================================================================

-- Function to add secret to Vault (for setup)
CREATE OR REPLACE FUNCTION public.add_vault_secret(
  p_name TEXT,
  p_secret TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_secret_id UUID;
BEGIN
  -- Insert secret into Vault
  INSERT INTO vault.secrets (name, secret, description)
  VALUES (p_name, p_secret, p_description)
  ON CONFLICT (name) DO UPDATE
  SET secret = EXCLUDED.secret,
      description = EXCLUDED.description,
      updated_at = NOW()
  RETURNING id INTO v_secret_id;
  
  RAISE NOTICE 'Secret "%" stored in Vault with ID %', p_name, v_secret_id;
  
  RETURN v_secret_id;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'Insufficient privileges to write to vault. Please ensure vault extension is enabled and you have proper permissions.';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error storing secret "%": %', p_name, SQLERRM;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.add_vault_secret(TEXT, TEXT, TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.add_vault_secret(TEXT, TEXT, TEXT) TO service_role;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION public.get_vault_secret(TEXT) IS 'Securely retrieve decrypted secret from vault with access control (public schema)';
COMMENT ON FUNCTION public.execute_attendance_sync_job() IS 'Execute attendance sync job using secrets from Supabase Vault (SECURE)';
COMMENT ON FUNCTION public.add_vault_secret(TEXT, TEXT, TEXT) IS 'Add or update a secret in Supabase Vault (public schema helper)';

-- ============================================================================
-- Setup Instructions
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✓ Secure vault helper functions created in public schema';
  RAISE NOTICE '✓ Attendance sync job updated to use vault secrets';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: Add secrets to vault using the SQL Editor:';
  RAISE NOTICE '';
  RAISE NOTICE '1. Add Supabase URL:';
  RAISE NOTICE '   SELECT public.add_vault_secret(';
  RAISE NOTICE '     ''supabase_url'',';
  RAISE NOTICE '     ''https://your-project-ref.supabase.co'',';
  RAISE NOTICE '     ''Supabase project URL''';
  RAISE NOTICE '   );';
  RAISE NOTICE '';
  RAISE NOTICE '2. Add service role key:';
  RAISE NOTICE '   SELECT public.add_vault_secret(';
  RAISE NOTICE '     ''service_role_key'',';
  RAISE NOTICE '     ''your-service-role-key'',';
  RAISE NOTICE '     ''Supabase service role key (SENSITIVE)''';
  RAISE NOTICE '   );';
  RAISE NOTICE '';
  RAISE NOTICE '3. Verify secrets (does not show values):';
  RAISE NOTICE '   SELECT id, name, description, created_at FROM vault.secrets;';
  RAISE NOTICE '';
  RAISE NOTICE '4. Test retrieval (only works for authorized roles):';
  RAISE NOTICE '   SELECT public.get_vault_secret(''supabase_url'');';
  RAISE NOTICE '';
  RAISE NOTICE '📖 For more information, see docs/CRON_SETUP.md';
END $$;
