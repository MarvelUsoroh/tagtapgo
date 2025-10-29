-- ============================================================================
-- Cron Jobs Verification Script
-- ============================================================================
-- 
-- This script verifies that all cron jobs are properly configured and using
-- the correct vault function (public.get_vault_secret).
-- 
-- Run this in your Supabase SQL Editor to check the status of all cron jobs.
-- 
-- ============================================================================

-- ============================================================================
-- 1. Check All Scheduled Cron Jobs
-- ============================================================================

SELECT 
  '=== SCHEDULED CRON JOBS ===' AS section;

SELECT 
  jobid,
  jobname,
  schedule,
  active,
  LEFT(command, 100) AS command_preview
FROM cron.job
ORDER BY jobname;

-- ============================================================================
-- 2. Check Vault Secrets (Names Only)
-- ============================================================================

SELECT 
  '=== VAULT SECRETS ===' AS section;

SELECT 
  name,
  description,
  created_at,
  updated_at
FROM vault.secrets
ORDER BY name;

-- ============================================================================
-- 3. Test Vault Function
-- ============================================================================

SELECT 
  '=== VAULT FUNCTION TEST ===' AS section;

-- Test if the function exists
SELECT 
  'public.get_vault_secret' AS function_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' 
        AND p.proname = 'get_vault_secret'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status;

-- Test if the old incorrect function exists (should not exist)
SELECT 
  'vault.get_decrypted_secret' AS function_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'vault' 
        AND p.proname = 'get_decrypted_secret'
    ) THEN '⚠️ EXISTS (should be removed)'
    ELSE '✅ DOES NOT EXIST (correct)'
  END AS status;

-- ============================================================================
-- 4. Check Recent Job Executions
-- ============================================================================

SELECT 
  '=== RECENT JOB EXECUTIONS ===' AS section;

SELECT 
  job_name,
  status,
  started_at,
  completed_at,
  duration_ms,
  CASE 
    WHEN error_message IS NOT NULL THEN LEFT(error_message, 100)
    ELSE NULL
  END AS error_preview
FROM cron_job_executions
ORDER BY started_at DESC
LIMIT 20;

-- ============================================================================
-- 5. Check Job Health Metrics
-- ============================================================================

SELECT 
  '=== JOB HEALTH METRICS ===' AS section;

SELECT 
  job_name,
  total_executions,
  successful_executions,
  failed_executions,
  success_rate_percent,
  ROUND(avg_duration_ms / 1000, 2) AS avg_duration_seconds,
  last_execution_at,
  last_success_at,
  last_error_at,
  CASE 
    WHEN last_execution_at > NOW() - INTERVAL '10 minutes' THEN '🟢 Healthy'
    WHEN last_execution_at > NOW() - INTERVAL '30 minutes' THEN '🟡 Warning'
    WHEN last_execution_at IS NULL THEN '⚪ No executions yet'
    ELSE '🔴 Critical'
  END AS health_status
FROM cron_job_health
ORDER BY job_name;

-- ============================================================================
-- 6. Check for Common Issues
-- ============================================================================

SELECT 
  '=== COMMON ISSUES CHECK ===' AS section;

-- Check for stuck jobs
SELECT 
  'Stuck Jobs' AS issue_type,
  COUNT(*) AS count,
  CASE 
    WHEN COUNT(*) > 0 THEN '⚠️ FOUND - Jobs stuck in running state'
    ELSE '✅ NONE'
  END AS status
FROM cron_job_executions
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '10 minutes';

-- Check for recent failures
SELECT 
  'Recent Failures' AS issue_type,
  COUNT(*) AS count,
  CASE 
    WHEN COUNT(*) > 0 THEN '⚠️ FOUND - Recent job failures'
    ELSE '✅ NONE'
  END AS status
FROM cron_job_executions
WHERE status = 'error'
  AND started_at > NOW() - INTERVAL '1 hour';

-- Check for missing vault secrets
SELECT 
  'Missing Vault Secrets' AS issue_type,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'supabase_url') THEN '❌ supabase_url missing'
    WHEN NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'service_role_key') THEN '❌ service_role_key missing'
    ELSE '✅ All required secrets present'
  END AS status;

-- ============================================================================
-- 7. Verify Cron Job Commands Use Correct Function
-- ============================================================================

SELECT 
  '=== CRON JOB COMMAND VERIFICATION ===' AS section;

SELECT 
  jobname,
  CASE 
    WHEN command LIKE '%public.get_vault_secret%' THEN '✅ Uses correct function'
    WHEN command LIKE '%vault.get_decrypted_secret%' THEN '❌ Uses incorrect function - NEEDS FIX'
    WHEN command LIKE '%get_vault_secret%' OR command LIKE '%get_decrypted_secret%' THEN '⚠️ Uses vault function (check schema)'
    ELSE '✅ No vault function (direct DB call)'
  END AS vault_function_status,
  LEFT(command, 150) AS command_preview
FROM cron.job
ORDER BY jobname;

-- ============================================================================
-- Summary
-- ============================================================================

SELECT 
  '=== SUMMARY ===' AS section;

SELECT 
  'Total Cron Jobs' AS metric,
  COUNT(*)::TEXT AS value
FROM cron.job
UNION ALL
SELECT 
  'Active Cron Jobs' AS metric,
  COUNT(*)::TEXT AS value
FROM cron.job
WHERE active = true
UNION ALL
SELECT 
  'Jobs Using Vault' AS metric,
  COUNT(*)::TEXT AS value
FROM cron.job
WHERE command LIKE '%get_vault_secret%' OR command LIKE '%get_decrypted_secret%'
UNION ALL
SELECT 
  'Vault Secrets Configured' AS metric,
  COUNT(*)::TEXT AS value
FROM vault.secrets
UNION ALL
SELECT 
  'Recent Executions (24h)' AS metric,
  COUNT(*)::TEXT AS value
FROM cron_job_executions
WHERE started_at > NOW() - INTERVAL '24 hours';

-- ============================================================================
-- Instructions
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICATION COMPLETE ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Review the results above to ensure:';
  RAISE NOTICE '1. All expected cron jobs are scheduled and active';
  RAISE NOTICE '2. Vault secrets (supabase_url, service_role_key) are configured';
  RAISE NOTICE '3. public.get_vault_secret function exists';
  RAISE NOTICE '4. vault.get_decrypted_secret function does NOT exist';
  RAISE NOTICE '5. All jobs using vault use public.get_vault_secret';
  RAISE NOTICE '6. No jobs are stuck or failing repeatedly';
  RAISE NOTICE '';
  RAISE NOTICE 'If any issues are found, refer to:';
  RAISE NOTICE '- docs/CRON_JOBS_SUMMARY.md';
  RAISE NOTICE '- docs/VAULT_FUNCTION_FIX.md';
  RAISE NOTICE '- docs/CRON_SETUP.md';
END $$;
