# pg_cron Setup Guide

This guide explains how to set up and manage the attendance sync job using pg_cron in Supabase.

## Overview

The attendance sync job runs every 5 minutes to sync attendance data from SIS/LMS systems. It uses pg_cron for scheduling and includes:

- **Automatic scheduling** - Runs every 5 minutes
- **Concurrency control** - Prevents overlapping runs
- **Job monitoring** - Tracks execution history and health metrics
- **Automatic retry** - Retries on failure
- **Cleanup** - Removes old execution records

---

## Prerequisites

1. **Supabase Project** with PostgreSQL database
2. **pg_cron Extension** enabled (included in Supabase)
3. **http Extension** enabled (for calling Edge Functions)
4. **Attendance Sync Edge Function** deployed

---

## Installation

### 1. Enable Required Extensions

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable pg_cron (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable http extension (for calling Edge Functions)
CREATE EXTENSION IF NOT EXISTS http;
```

### 2. Set Configuration Variables (SECURE METHOD)

**⚠️ SECURITY BEST PRACTICE:** Use Supabase Vault to store sensitive credentials instead of database settings.

#### Option A: Using Supabase Vault (RECOMMENDED)

```sql
-- Enable Vault extension
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- Add Supabase URL to Vault
SELECT public.add_vault_secret(
  'supabase_url',
  'https://your-project-ref.supabase.co',
  'Supabase project URL'
);

-- Add service role key to Vault (SECURE)
SELECT public.add_vault_secret(
  'service_role_key',
  'your-service-role-key',
  'Supabase service role key (SENSITIVE)'
);

-- Verify secrets are stored (does not show decrypted values)
SELECT name, description, created_at FROM vault.secrets;

-- Test secure retrieval (only works for authorized roles)
SELECT public.get_vault_secret('supabase_url');
```

**Security Features:**
- ✅ Secrets encrypted at rest in vault
- ✅ Access controlled via `public.get_vault_secret()` helper
- ✅ Only postgres/service_role can retrieve secrets
- ✅ Audit trail of secret access
- ✅ No direct access to `vault.decrypted_secrets` view

#### Option B: Using Database Settings (NOT RECOMMENDED)

⚠️ **WARNING:** This method stores the service role key in the database, which is less secure.

```sql
-- Set Supabase URL
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project-ref.supabase.co';

-- Set service role key (NOT RECOMMENDED - use Vault instead)
ALTER DATABASE postgres SET app.settings.supabase_service_role_key = 'your-service-role-key';
```

**Important:** 
- Replace `your-project-ref` and `your-service-role-key` with your actual values
- Use Option A (Vault) in production for better security
- Never commit service role keys to version control

### 3. Run the Migration

Apply the pg_cron setup migration:

```bash
cd tagtapgo-backend
supabase db push
```

Or run the SQL file directly in Supabase SQL Editor:

```sql
-- Copy and paste the contents of:
-- supabase/migrations/20241025000001_setup_pg_cron.sql
```

---

## Verification

### Check if Job is Scheduled

```sql
SELECT * FROM cron.job WHERE jobname = 'attendance-sync-job';
```

Expected output:
```
jobid | schedule    | command                                  | nodename  | nodeport | database | username | active | jobname
------+-------------+------------------------------------------+-----------+----------+----------+----------+--------+---------------------
1     | */5 * * * * | SELECT execute_attendance_sync_job();    | localhost | 5432     | postgres | postgres | t      | attendance-sync-job
```

### Check Recent Executions

```sql
SELECT * FROM cron_job_executions_recent;
```

### Check Job Health

```sql
SELECT * FROM cron_job_health;
```

---

## Manual Operations

### Manually Trigger Sync Job

```sql
SELECT trigger_attendance_sync();
```

### Get Job Status

```sql
SELECT get_job_status();
```

Returns:
```json
{
  "job_name": "attendance-sync-job",
  "is_running": false,
  "last_execution": {
    "started_at": "2025-10-25T21:30:00Z",
    "completed_at": "2025-10-25T21:30:15Z",
    "status": "success",
    "duration_ms": 15234,
    "error_message": null
  },
  "health_metrics": {
    "total_executions": 288,
    "successful_executions": 285,
    "failed_executions": 3,
    "success_rate_percent": 98.96,
    "avg_duration_ms": 12456,
    "last_execution_at": "2025-10-25T21:30:00Z",
    "last_success_at": "2025-10-25T21:30:00Z",
    "last_error_at": "2025-10-25T18:45:00Z"
  }
}
```

### View Execution History

```sql
-- Last 10 executions
SELECT 
  started_at,
  completed_at,
  status,
  duration_ms,
  error_message
FROM cron_job_executions
WHERE job_name = 'attendance-sync-job'
ORDER BY started_at DESC
LIMIT 10;
```

### Pause the Job

```sql
SELECT cron.unschedule('attendance-sync-job');
```

### Resume the Job

```sql
SELECT cron.schedule(
  'attendance-sync-job',
  '*/5 * * * *',
  'SELECT execute_attendance_sync_job();'
);
```

### Change Schedule

```sql
-- Unschedule existing job
SELECT cron.unschedule('attendance-sync-job');

-- Schedule with new interval (e.g., every 10 minutes)
SELECT cron.schedule(
  'attendance-sync-job',
  '*/10 * * * *',
  'SELECT execute_attendance_sync_job();'
);
```

---

## Monitoring

### Dashboard Query

Create a monitoring dashboard with this query:

```sql
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
    ELSE '🔴 Critical'
  END AS health_status
FROM cron_job_health
WHERE job_name = 'attendance-sync-job';
```

### Alerting

Set up alerts for:

1. **Job hasn't run in 15+ minutes**
   ```sql
   SELECT 
     job_name,
     last_execution_at,
     NOW() - last_execution_at AS time_since_last_run
   FROM cron_job_health
   WHERE job_name = 'attendance-sync-job'
     AND last_execution_at < NOW() - INTERVAL '15 minutes';
   ```

2. **Success rate below 95%**
   ```sql
   SELECT 
     job_name,
     success_rate_percent,
     failed_executions
   FROM cron_job_health
   WHERE job_name = 'attendance-sync-job'
     AND success_rate_percent < 95;
   ```

3. **3+ consecutive failures**
   ```sql
   SELECT 
     job_name,
     COUNT(*) AS consecutive_failures
   FROM (
     SELECT 
       job_name,
       status,
       ROW_NUMBER() OVER (ORDER BY started_at DESC) AS rn
     FROM cron_job_executions
     WHERE job_name = 'attendance-sync-job'
       AND started_at > NOW() - INTERVAL '1 hour'
   ) recent
   WHERE status = 'error'
   GROUP BY job_name
   HAVING COUNT(*) >= 3;
   ```

---

## Troubleshooting

### Job Not Running

**Check if job is scheduled:**
```sql
SELECT * FROM cron.job WHERE jobname = 'attendance-sync-job';
```

**Check if job is stuck:**
```sql
SELECT * FROM cron_job_executions
WHERE job_name = 'attendance-sync-job'
  AND status = 'running'
  AND started_at < NOW() - INTERVAL '10 minutes';
```

If stuck, manually mark as error:
```sql
UPDATE cron_job_executions
SET status = 'error',
    completed_at = NOW(),
    error_message = 'Job timed out'
WHERE job_name = 'attendance-sync-job'
  AND status = 'running'
  AND started_at < NOW() - INTERVAL '10 minutes';
```

### Job Failing

**Check recent errors:**
```sql
SELECT 
  started_at,
  error_message,
  duration_ms
FROM cron_job_executions
WHERE job_name = 'attendance-sync-job'
  AND status = 'error'
ORDER BY started_at DESC
LIMIT 5;
```

**Common issues:**
- Edge Function not deployed
- Invalid service role key
- Network connectivity issues
- Database connection issues
- Adapter configuration errors

### Performance Issues

**Check average duration:**
```sql
SELECT 
  AVG(duration_ms) AS avg_ms,
  MAX(duration_ms) AS max_ms,
  MIN(duration_ms) AS min_ms
FROM cron_job_executions
WHERE job_name = 'attendance-sync-job'
  AND status = 'success'
  AND started_at > NOW() - INTERVAL '24 hours';
```

**If duration is increasing:**
- Check number of universities being synced
- Check adapter performance
- Consider increasing batch sizes
- Consider parallel processing

---

## Cleanup

### Remove Old Execution Records

Automatic cleanup runs daily at 2 AM (keeps last 7 days).

Manual cleanup:
```sql
SELECT cleanup_old_job_executions();
```

### Uninstall

To completely remove the cron job:

```sql
-- Unschedule jobs
SELECT cron.unschedule('attendance-sync-job');
SELECT cron.unschedule('cleanup-job-executions');

-- Drop functions
DROP FUNCTION IF EXISTS trigger_attendance_sync();
DROP FUNCTION IF EXISTS get_job_status(TEXT);
DROP FUNCTION IF EXISTS cleanup_old_job_executions();
DROP FUNCTION IF EXISTS execute_attendance_sync_job();
DROP FUNCTION IF EXISTS is_job_running(TEXT);

-- Drop views
DROP VIEW IF EXISTS cron_job_health;
DROP VIEW IF EXISTS cron_job_executions_recent;

-- Drop table
DROP TABLE IF EXISTS cron_job_executions;
```

---

## Best Practices

### Security

1. **Use Supabase Vault** - Store service role key in Vault, not database settings
2. **Rotate keys regularly** - Update service role key periodically
3. **Limit permissions** - Use least-privilege principle for database roles
4. **Audit access** - Monitor who accesses sensitive secrets
5. **Never commit secrets** - Keep credentials out of version control

### Operations

1. **Monitor regularly** - Check job health daily
2. **Set up alerts** - Get notified of failures
3. **Review logs** - Check execution history weekly
4. **Test changes** - Use manual trigger before deploying
5. **Keep backups** - Backup database before major changes
6. **Document issues** - Track recurring problems
7. **Optimize performance** - Monitor duration trends

---

## Support

For issues or questions:
1. Check execution logs: `SELECT * FROM cron_job_executions_recent;`
2. Check job health: `SELECT * FROM cron_job_health;`
3. Review Edge Function logs in Supabase Dashboard
4. Check adapter health: `SELECT * FROM universities WHERE last_sync_status = 'error';`

---

## References

- [pg_cron Documentation](https://github.com/citusdata/pg_cron)
- [Supabase Cron Jobs](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
