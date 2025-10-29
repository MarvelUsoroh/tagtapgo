# Deployment Status - Gamification Engine

## Migration Status

### ✅ Deployed Migrations

1. **20241026000001_add_unlocked_column.sql**
   - Added `unlocked` boolean column to `student_achievements`
   - Created trigger to auto-set `unlocked` from `unlocked_at`
   - Status: ✅ Deployed successfully

2. **20241026000002_seed_achievements.sql**
   - Seeded 18 achievements across 5 categories
   - Added indexes for performance
   - Status: ✅ Deployed successfully

3. **20241026000003_setup_gamification_cron.sql**
   - Created `gamification-job` cron schedule
   - Runs every 5 minutes at :02, :07, :12, :17, :22, :27, :32, :37, :42, :47, :52, :57
   - Status: ✅ Deployed successfully
   - Notice: "Gamification cron job created successfully"

## Cron Job Configuration

### Gamification Job

**Name:** `gamification-job`

**Schedule:** `2,7,12,17,22,27,32,37,42,47,52,57 * * * *`

- Runs every 5 minutes
- Offset by 2 minutes after attendance sync
- Example: If attendance sync runs at 10:00, gamification runs at 10:02

**Endpoint:** `{SUPABASE_URL}/functions/v1/gamification-job`

**Authentication:** Service role key (from vault)

**Status:** ✅ Active and scheduled

## Edge Functions Status

### Functions to Deploy

1. **gamification-job**
   - Location: `supabase/functions/gamification-job/index.ts`
   - Status: ⏳ Ready to deploy
   - Command: `supabase functions deploy gamification-job`

## Verification Steps

### 1. Verify Cron Job Exists

```sql
SELECT
  jobname,
  schedule,
  active,
  jobid
FROM cron.job
WHERE jobname = 'gamification-job';
```

**Expected Result:**

- jobname: `gamification-job`
- schedule: `2,7,12,17,22,27,32,37,42,47,52,57 * * * *`
- active: `true`

### 2. Check Recent Executions

```sql
SELECT
  job_name,
  status,
  started_at,
  completed_at,
  duration_ms,
  records_processed,
  metadata
FROM cron_job_executions
WHERE job_name = 'gamification-job'
ORDER BY completed_at DESC
LIMIT 5;
```

**Expected Result:**

- Executions every 5 minutes
- Status: `success` or `partial`
- Duration: < 5000ms

### 3. Verify Achievements Seeded

```sql
SELECT
  category,
  COUNT(*) as count
FROM achievements
GROUP BY category
ORDER BY category;
```

**Expected Result:**

- attendance: 4
- streak: 4
- time: 4
- social: 4
- reward: 3
- **Total: 18 achievements**

### 4. Check Student Achievements Table

```sql
SELECT
  COUNT(*) as total_records,
  COUNT(CASE WHEN unlocked = true THEN 1 END) as unlocked_count,
  COUNT(CASE WHEN unlocked = false THEN 1 END) as in_progress_count
FROM student_achievements;
```

## Next Steps

### 1. Deploy Edge Function

```bash
cd tagtapgo-backend
supabase functions deploy gamification-job
```

**Expected Output:**

```
Deploying function gamification-job...
Function gamification-job deployed successfully
```

### 2. Test Manual Trigger

```bash
# Trigger the function manually
supabase functions invoke gamification-job
```

**Expected Response:**

```json
{
  "success": true,
  "attendance_processed": 0,
  "students_affected": 0,
  "points_awarded": 0,
  "streaks_updated": 0,
  "achievements_unlocked": 0,
  "leaderboards_updated": 0,
  "errors": [],
  "duration": 1234
}
```

### 3. Monitor First Automatic Run

Wait for the next scheduled run (at :02, :07, :12, etc.) and check:

```sql
SELECT * FROM cron_job_executions
WHERE job_name = 'gamification-job'
ORDER BY completed_at DESC
LIMIT 1;
```

### 4. Verify Data Updates

After attendance sync + gamification run:

**Check Points:**

```sql
SELECT student_id, SUM(points) as total_points
FROM points
GROUP BY student_id
ORDER BY total_points DESC
LIMIT 10;
```

**Check Streaks:**

```sql
SELECT student_id, current_streak, longest_streak
FROM streaks
WHERE current_streak > 0
ORDER BY current_streak DESC
LIMIT 10;
```

**Check Achievements:**

```sql
SELECT
  sa.student_id,
  a.name,
  sa.unlocked,
  sa.progress
FROM student_achievements sa
JOIN achievements a ON a.id = sa.achievement_id
WHERE sa.unlocked = true
ORDER BY sa.unlocked_at DESC
LIMIT 10;
```

**Check Leaderboards:**

```sql
SELECT
  leaderboard_type,
  period,
  COUNT(*) as entries
FROM leaderboards
GROUP BY leaderboard_type, period
ORDER BY leaderboard_type, period;
```

## Troubleshooting

### Cron Job Not Running

**Check if job exists:**

```sql
SELECT * FROM cron.job WHERE jobname = 'gamification-job';
```

**If missing, re-run migration:**

```bash
supabase db push
```

### Edge Function Not Deployed

**Deploy manually:**

```bash
supabase functions deploy gamification-job
```

**Check function exists:**

```bash
supabase functions list
```

### Job Failing

**Check error logs:**

```sql
SELECT
  error_message,
  metadata
FROM cron_job_executions
WHERE job_name = 'gamification-job'
  AND status = 'error'
ORDER BY completed_at DESC
LIMIT 5;
```

**Common issues:**

- Edge function not deployed
- Service role key not configured
- Database permissions issue

## Success Criteria

✅ All migrations deployed
✅ Cron job created and active
✅ 18 achievements seeded
✅ `unlocked` column added to student_achievements
⏳ Edge function deployed (next step)
⏳ First successful run verified (after deployment)

## Current Status

**Migrations:** ✅ 3/3 deployed
**Cron Jobs:** ✅ 1/1 scheduled
**Edge Functions:** ⏳ 0/1 deployed (ready to deploy)
**Overall:** 🟡 Ready for edge function deployment

## Deployment Date

**Migrations Deployed:** 2024-10-26
**Cron Job Created:** 2024-10-26
**Next Step:** Deploy gamification-job edge function
