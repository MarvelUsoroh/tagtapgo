-- ============================================================================
-- Secure pg_cron Setup with Supabase Vault
-- ============================================================================
-- 
-- This migration provides a more secure approach to storing the service role key
-- using Supabase Vault instead of database settings.
-- 
-- IMPORTANT: This requires Supabase Vault to be enabled and configured.
-- See: https://supabase.com/docs/guides/database/vault
-- 
-- ============================================================================

-- Enable Vault extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- ============================================================================
-- Secure Helper Function to Retrieve Vault Secrets
-- ============================================================================

-- Helper function to safely return decrypted secret by name
-- This function provides access control and proper error handling
CREATE OR REPLACE FUNCTION vault.get_decrypted_secret(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_secret_row vault.secrets%ROWTYPE;
  v_decrypted TEXT;
BEGIN
  -- Access control: Only allow invocation by postgres superuser or service_role
  -- Adjust role check as needed for your security requirements
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only postgres or service_role can access vault secrets';
  END IF;
  
  -- Retrieve secret from vault
  SELECT * INTO v_secret_row 
  FROM vault.secrets 
  WHERE name = p_name 
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Secret "%" not found in vault', p_name;
  END IF;
  
  -- Use the vault package's decryption helper if available
  -- For Supabase Vault, the secret column is already decrypted when accessed
  v_decrypted := v_secret_row.secret;
  
  RETURN v_decrypted;
END;
$$;

-- Grant execute permission to postgres and service_role
GRANT EXECUTE ON FUNCTION vault.get_decrypted_secret(TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION vault.get_decrypted_secret(TEXT) TO service_role;

-- ============================================================================
-- Secure Job Execution Function (Using Vault Helper)
-- ============================================================================

-- Function to execute the attendance sync job with tracking (Vault version)
CREATE OR REPLACE FUNCTION execute_attendance_sync_job_secure()
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
    -- Retrieve secrets from vault using secure helper
    v_supabase_url := vault.get_decrypted_secret('supabase_url');
    v_service_key := vault.get_decrypted_secret('service_role_key');
    
    IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
      RAISE EXCEPTION 'Missing required configuration. Please set supabase_url and service_role_key in vault.secrets.';
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
-- Update Cron Job to Use Secure Function
-- ============================================================================

-- Remove existing job
SELECT cron.unschedule('attendance-sync-job') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'attendance-sync-job'
);

-- Schedule job with secure function
SELECT cron.schedule(
  'attendance-sync-job',
  '*/5 * * * *',
  'SELECT execute_attendance_sync_job_secure();'
);

-- ============================================================================
-- Helper Function to Store Secrets in Vault
-- ============================================================================

-- Function to add secret to Vault (for setup)
CREATE OR REPLACE FUNCTION add_vault_secret(
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
  
  RAISE NOTICE 'Secret % stored in Vault with ID %', p_name, v_secret_id;
  
  RETURN v_secret_id;
END;
$$;

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION execute_attendance_sync_job_secure() TO service_role;
GRANT EXECUTE ON FUNCTION add_vault_secret(TEXT, TEXT, TEXT) TO service_role;

-- Grant access to Vault for the function
GRANT SELECT ON vault.decrypted_secrets TO postgres;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION vault.get_decrypted_secret(TEXT) IS 'Securely retrieve decrypted secret from vault with access control';
COMMENT ON FUNCTION execute_attendance_sync_job_secure() IS 'Execute attendance sync job using secrets from Supabase Vault (SECURE)';
COMMENT ON FUNCTION add_vault_secret(TEXT, TEXT, TEXT) IS 'Add or update a secret in Supabase Vault';

-- ============================================================================
-- Setup Instructions
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✓ Secure pg_cron setup complete (using Supabase Vault)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: You must add secrets to Vault before the job will work:';
  RAISE NOTICE '';
  RAISE NOTICE '1. Add Supabase URL to Vault:';
  RAISE NOTICE '   SELECT add_vault_secret(';
  RAISE NOTICE '     ''supabase_url'',';
  RAISE NOTICE '     ''https://your-project-ref.supabase.co'',';
  RAISE NOTICE '     ''Supabase project URL''';
  RAISE NOTICE '   );';
  RAISE NOTICE '';
  RAISE NOTICE '2. Add service role key to Vault:';
  RAISE NOTICE '   SELECT add_vault_secret(';
  RAISE NOTICE '     ''service_role_key'',';
  RAISE NOTICE '     ''your-service-role-key'',';
  RAISE NOTICE '     ''Supabase service role key (SENSITIVE)''';
  RAISE NOTICE '   );';
  RAISE NOTICE '';
  RAISE NOTICE '3. Verify secrets are stored:';
  RAISE NOTICE '   SELECT name, description, created_at FROM vault.secrets;';
  RAISE NOTICE '';
  RAISE NOTICE '4. Test the job:';
  RAISE NOTICE '   SELECT execute_attendance_sync_job_secure();';
  RAISE NOTICE '';
  RAISE NOTICE '📖 For more information, see docs/CRON_SETUP.md';
END $$;
