# Gamification Job Monitoring Guide

## ⚠️ Important: Vault Function Usage

The gamification cron job uses **`public.get_vault_secret()`** to securely retrieve credentials from Supabase Vault. This function is defined in the `public` schema, not the `vault` schema.

**Correct usage:**
```sql
SELECT public.get_vault_secret('supabase_url');
SELECT public.get_vault_secret('service_role_key');
```

**Incorrect usage (will fail):**
```sql
SELECT vault.get_decrypted_secret('supabase_url');  -- ❌ Function doesn't exist
```

**Common Errors:**
- `function vault.get_decrypted_secret(text) does not exist` → Run migration `20241026000006_fix_gamification_vault_function.sql`
- `schema "net" does not exist` → Run migration `20241026000007_fix_gamification_http_extension.sql`

See [GAMIFICATION_CRON_FIX.md](./GAMIFICATION_CRON_FIX.md) for detailed troubleshooting.

---

## Quick Status Check

### Verify Job is Scheduled

```sql
SELECT * FROM cron.job WHERE jobname = 'gamification-job';
```

**Expected Output:**
- `jobname`: gamification-job
- `schedule`: 2,7,12,17,22,27,32,37,42,47,52,57 * * * *
- `active`: true

### Check Recent Executions

```sql
SELECT 
  job_name,
  status,
  started_at,
  completed_at,
  duration_ms,
  records_processed,
  records_succeeded,
  records_failed,
  error_message,
  metadata
FROM cron_job_executions
WHERE job_name = 'gamification-job'
ORDER BY completed_at DESC
LIMIT 10;
```

### Check Latest Execution

```sql
SELECT 
  job_name,
  status,
  started_at,
  completed_at,
  duration_ms,
  records_processed,
  metadata->>'students_affected' as students_affected,
  metadata->>'points_awarded' as points_awarded,
  metadata->>'streaks_updated' as streaks_updated,
  metadata->>'achievements_unlocked' as achievements_unlocked,
  metadata->>'leaderboards_updated' as leaderboards_updated,
  error_message
FROM cron_job_executions
WHERE job_name = 'gamification-job'
ORDER BY completed_at DESC
LIMIT 1;
```

## Health Metrics

### Success Rate

```sql
SELECT 
  job_name,
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE status = 'success') as successful,
  COUNT(*) FILTER (WHERE status = 'error') as failed,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'success')::numeric / COUNT(*) * 100, 
    2
  ) as success_rate_percent
FROM cron_job_executions
WHERE job_name = 'gamification-job'
  AND started_at > NOW() - INTERVAL '24 hours'
GROUP BY job_name;
```

### Average Duration

```sql
SELECT 
  job_name,
  ROUND(AVG(duration_ms)) as avg_duration_ms,
  ROUND(AVG(duration_ms) / 1000, 2) as avg_duration_seconds,
  MIN(duration_ms) as min_duration_ms,
  MAX(duration_ms) as max_duration_ms
FROM cron_job_executions
WHERE job_name = 'gamification-job'
  AND status = 'success'
  AND started_at > NOW() - INTERVAL '24 hours'
GROUP BY job_name;
```

### Processing Stats

```sql
SELECT 
  job_name,
  SUM(records_processed) as total_records,
  SUM(records_succeeded) as total_succeeded,
  SUM(records_failed) as total_failed,
  SUM((metadata->>'students_affected')::int) as total_students,
  SUM((metadata->>'points_awarded')::int) as total_points,
  SUM((metadata->>'achievements_unlocked')::int) as total_achievements
FROM cron_job_executions
WHERE job_name = 'gamification-job'
  AND status = 'success'
  AND started_at > NOW() - INTERVAL '24 hours'
GROUP BY job_name;
```

## Alerts

### Job Not Running

```sql
-- Alert if no execution in last 10 minutes
SELECT 
  'Job not running' as alert_type,
  NOW() - MAX(started_at) as time_since_last_run,
  MAX(started_at) as last_run_at
FROM cron_job_executions
WHERE job_name = 'gamification-job'
HAVING NOW() - MAX(started_at) > INTERVAL '10 minutes';
```

### Consecutive Failures

```sql
-- Alert if 3+ consecutive failures
WITH recent_runs AS (
  SELECT 
    status,
    started_at,
    ROW_NUMBER() OVER (ORDER BY started_at DESC) as rn
  FROM cron_job_executions
  WHERE job_name = 'gamification-job'
  ORDER BY started_at DESC
  LIMIT 5
)
SELECT 
  'Consecutive failures' as alert_type,
  COUNT(*) as consecutive_failures,
  MIN(started_at) as first_failure_at
FROM recent_runs
WHERE status = 'error'
  AND rn <= 3
HAVING COUNT(*) >= 3;
```

### Low Success Rate

```sql
-- Alert if success rate < 95% in last hour
SELECT 
  'Low success rate' as alert_type,
  COUNT(*) as total_runs,
  COUNT(*) FILTER (WHERE status = 'success') as successful_runs,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'success')::numeric / COUNT(*) * 100, 
    2
  ) as success_rate_percent
FROM cron_job_executions
WHERE job_name = 'gamification-job'
  AND started_at > NOW() - INTERVAL '1 hour'
HAVING ROUND(
  COUNT(*) FILTER (WHERE status = 'success')::numeric / COUNT(*) * 100, 
  2
) < 95;
```

### Slow Performance

```sql
-- Alert if average duration > 10 seconds
SELECT 
  'Slow performance' as alert_type,
  ROUND(AVG(duration_ms)) as avg_duration_ms,
  ROUND(AVG(duration_ms) / 1000, 2) as avg_duration_seconds,
  COUNT(*) as sample_size
FROM cron_job_executions
WHERE job_name = 'gamification-job'
  AND status = 'success'
  AND started_at > NOW() - INTERVAL '1 hour'
HAVING AVG(duration_ms) > 10000;
```

## Troubleshooting

### Check Vault Secrets

```sql
-- Verify secrets are configured
SELECT name, description, created_at 
FROM vault.secrets 
WHERE name IN ('supabase_url', 'service_role_key');
```

### Check Recent Errors

```sql
SELECT 
  started_at,
  completed_at,
  duration_ms,
  error_message,
  records_processed,
  records_failed
FROM cron_job_executions
WHERE job_name = 'gamification-job'
  AND status = 'error'
ORDER BY started_at DESC
LIMIT 5;
```

### Check Edge Function Logs

Go to Supabase Dashboard → Edge Functions → gamification-job → Logs

### Manual Trigger

```bash
# Via Supabase CLI
supabase functions invoke gamification-job

# Via HTTP
curl -X POST \
  https://your-project.supabase.co/functions/v1/gamification-job \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## Dashboard Query

Create a monitoring dashboard with this comprehensive query:

```sql
WITH latest_execution AS (
  SELECT *
  FROM cron_job_executions
  WHERE job_name = 'gamification-job'
  ORDER BY started_at DESC
  LIMIT 1
),
last_24h_stats AS (
  SELECT 
    COUNT(*) as total_executions,
    COUNT(*) FILTER (WHERE status = 'success') as successful_executions,
    COUNT(*) FILTER (WHERE status = 'error') as failed_executions,
    ROUND(AVG(duration_ms)) as avg_duration_ms,
    SUM(records_processed) as total_records_processed,
    SUM((metadata->>'points_awarded')::int) as total_points_awarded,
    SUM((metadata->>'achievements_unlocked')::int) as total_achievements_unlocked
  FROM cron_job_executions
  WHERE job_name = 'gamification-job'
    AND started_at > NOW() - INTERVAL '24 hours'
)
SELECT 
  -- Latest Execution
  le.status as current_status,
  le.started_at as last_run_at,
  le.completed_at as last_completed_at,
  le.duration_ms as last_duration_ms,
  le.records_processed as last_records_processed,
  le.metadata->>'students_affected' as last_students_affected,
  le.metadata->>'points_awarded' as last_points_awarded,
  le.error_message as last_error,
  
  -- 24h Stats
  s.total_executions,
  s.successful_executions,
  s.failed_executions,
  ROUND(s.successful_executions::numeric / NULLIF(s.total_executions, 0) * 100, 2) as success_rate_percent,
  s.avg_duration_ms,
  s.total_records_processed,
  s.total_points_awarded,
  s.total_achievements_unlocked,
  
  -- Health Status
  CASE 
    WHEN le.started_at > NOW() - INTERVAL '10 minutes' AND le.status = 'success' THEN '🟢 Healthy'
    WHEN le.started_at > NOW() - INTERVAL '10 minutes' AND le.status = 'error' THEN '🟡 Warning'
    WHEN le.started_at > NOW() - INTERVAL '30 minutes' THEN '🟠 Degraded'
    ELSE '🔴 Critical'
  END as health_status
FROM latest_execution le
CROSS JOIN last_24h_stats s;
```

## Expected Healthy Metrics

- **Status:** success
- **Duration:** < 5000ms (5 seconds)
- **Success Rate:** > 95%
- **Last Run:** < 10 minutes ago
- **Records Processed:** Varies by attendance volume
- **Errors:** null or empty

## Common Issues

### Issue: Job not running
**Check:** Cron job scheduled, vault secrets configured
**Fix:** Re-run migration, verify secrets

### Issue: Job failing
**Check:** Error messages in cron_job_executions
**Fix:** Check edge function logs, verify database permissions

### Issue: Slow performance
**Check:** Average duration, records processed
**Fix:** Optimize queries, increase batch sizes, check database load

### Issue: No records processed
**Check:** Attendance sync job status
**Fix:** Ensure attendance-sync-job is running and creating records

## Monitoring Best Practices

1. **Check dashboard daily** - Review health status and metrics
2. **Set up alerts** - Configure alerts for failures and performance issues
3. **Review logs weekly** - Look for patterns in errors or performance
4. **Monitor trends** - Track duration and success rate over time
5. **Test manually** - Periodically trigger job manually to verify functionality
