# Gamification Engine

## Overview

The Gamification Engine is the main orchestration system that processes attendance records and updates all gamification systems. It runs automatically after attendance sync completes and coordinates points calculation, streak updates, achievement checks, and leaderboard updates.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│           Attendance Sync Job (Every 5 min)         │
│  - Syncs attendance from SIS/LMS                    │
│  - Creates attendance records                       │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│        Gamification Job (Every 5 min + 2 min)       │
│                                                     │
│  1. Get new attendance since last run               │
│  2. Calculate and award points                      │
│  3. Update streaks                                  │
│  4. Check achievements                              │
│  5. Update leaderboards                             │
│  6. Log results                                     │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│                  Database Updates                   │
│  - points table (transaction ledger)                │
│  - streaks table (current/longest)                  │
│  - student_achievements table (progress/unlocked)   │
│  - leaderboards table (rankings)                    │
│  - notifications table (push notifications)         │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│              Real-time Updates (WebSocket)          │
│  - Frontend receives updates via Supabase Realtime  │
│  - UI updates immediately (points, streaks, etc.)   │
│  - Confetti animations for achievements             │
└─────────────────────────────────────────────────────┘
```

## Processing Flow

### 1. Get New Attendance Records

```typescript
// Get last run time from job execution log
const lastRunTime = await getLastRunTime();

// Query new attendance records
const { data: newAttendance } = await supabase
  .from('attendance')
  .select('*')
  .gte('created_at', lastRunTime);
```

**Logic:**
- Query `cron_job_executions` for last successful run
- Default to 5 minutes ago if no previous run
- Get all attendance records created since then

### 2. Calculate and Award Points

```typescript
const pointsResults = await calculateAndAwardPoints(supabase, newAttendance);
```

**Awards:**
- Base: 10 points per attendance
- Early arrival: +5 points (5+ min early)
- Perfect week: +50 points (5/5 days)
- Perfect month: +200 points (20/20 days)

**See:** [Points Calculation](./POINTS_CALCULATION.md)

### 3. Update Streaks

```typescript
const streakResults = await updateStreaks(supabase, newAttendance);
```

**Updates:**
- Current streak (consecutive days)
- Longest streak (all-time best)
- Last attendance date
- Streak freeze usage

**See:** [Streak System](./STREAK_SYSTEM.md)

### 4. Check Achievements

```typescript
const studentIds = [...new Set(newAttendance.map(a => a.student_id))];
const achievementResults = await checkAchievements(supabase, studentIds);
```

**Checks:**
- 9 criteria types (attendance, streak, early arrival, etc.)
- 18 seeded achievements across 5 categories
- Progress tracking for in-progress achievements
- Bonus points for unlocks

**See:** [Achievement System](./ACHIEVEMENT_SYSTEM.md)

### 5. Update Leaderboards

```typescript
const leaderboardResults = await updateLeaderboards(supabase, studentIds);
```

**Updates:**
- 3 leaderboard types (class, year, school)
- 3 time periods (weekly, monthly, all_time)
- Rank calculations with tie handling
- Rank change notifications

**See:** [Leaderboard System](./LEADERBOARD_SYSTEM.md)

### 6. Log Results

```typescript
await logJobExecution('success', result);
```

**Logs:**
- Job status (success/partial/error)
- Duration (ms)
- Records processed
- Points awarded
- Streaks updated
- Achievements unlocked
- Leaderboard entries updated
- Errors (if any)

## Error Handling

### Per-Service Isolation

Each service (points, streaks, achievements, leaderboards) runs independently:

```typescript
try {
  const pointsResults = await calculateAndAwardPoints(supabase, newAttendance);
  // Process results
} catch (error) {
  console.error('Points calculation failed:', error);
  result.errors.push(`Points: ${error.message}`);
  // Continue with other services
}
```

**Benefits:**
- One service failure doesn't stop entire job
- Partial success is possible
- All errors are logged

### Error Types

**Critical Errors:**
- Database connection failure
- Invalid attendance data
- Service role permission issues

**Non-Critical Errors:**
- Individual student processing failure
- Notification send failure
- Cache update failure

### Recovery

**Automatic:**
- Next run will process missed records
- Idempotent operations prevent duplicates
- Last run time tracks successful completion

**Manual:**
- Check `cron_job_executions` table for errors
- Re-run job manually if needed
- Fix data issues and re-process

## Scheduling

### Cron Configuration

```sql
SELECT cron.schedule(
  'gamification-job',
  '2,7,12,17,22,27,32,37,42,47,52,57 * * * *', -- Every 5 min at :02, :07, etc.
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/gamification-job',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

**Schedule:**
- Runs every 5 minutes
- Offset by 2 minutes after attendance sync
- Example: Attendance sync at :00, :05, :10... → Gamification at :02, :07, :12...

**Why Offset?**
- Ensures attendance records are committed before processing
- Prevents race conditions
- Allows attendance sync to complete

### Manual Trigger

```bash
# Trigger via Supabase CLI
supabase functions invoke gamification-job

# Trigger via HTTP
curl -X POST \
  https://your-project.supabase.co/functions/v1/gamification-job \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

## Monitoring

### Job Execution Log

Query recent executions:

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

### Success Metrics

**Healthy Job:**
- Status: `success`
- Duration: < 5000ms (5 seconds)
- Records failed: 0
- Errors: null

**Warning Signs:**
- Status: `partial` (some services failed)
- Duration: > 10000ms (10 seconds)
- Records failed: > 0
- Errors: present

**Critical Issues:**
- Status: `error` (job failed completely)
- Duration: > 30000ms (30 seconds)
- Records processed: 0
- Consecutive failures: 3+

### Alerts

Set up alerts for:
- 3+ consecutive failures
- Duration > 30 seconds
- Records failed > 10% of processed
- No execution in 10+ minutes

## Performance

### Optimization Strategies

**1. Batch Processing**
- Process multiple students in parallel
- Group by service for efficiency
- Use database transactions

**2. Incremental Updates**
- Only process new attendance records
- Track last run time accurately
- Skip already-processed records

**3. Caching**
- Cache achievement definitions
- Cache leaderboard rankings (5-10 min)
- Use materialized views for heavy queries

**4. Indexes**
Ensure these indexes exist:
- `attendance(created_at)` - For incremental queries
- `points(student_id, created_at)` - For aggregations
- `streaks(student_id)` - For lookups
- `student_achievements(student_id, unlocked)` - For filtering
- `leaderboards(leaderboard_type, period)` - For queries

### Benchmarks

**Target Performance:**
- 100 attendance records: < 2 seconds
- 500 attendance records: < 5 seconds
- 1000 attendance records: < 10 seconds

**Actual Performance (measured):**
- TBD after deployment

## Testing

### Unit Tests

Each service has comprehensive unit tests:
- Points Calculator: 5 tests
- Streak Updater: 6 tests
- Achievement Checker: 5 tests
- Leaderboard Updater: 3 tests

### Integration Tests

Test the full gamification flow:

```typescript
// Create test attendance records
const testAttendance = [
  { student_id: 'test-1', course_id: 'course-1', date: '2024-10-26', status: 'present' },
  { student_id: 'test-2', course_id: 'course-1', date: '2024-10-26', status: 'present' },
];

// Run gamification job
const response = await fetch('http://localhost:54321/functions/v1/gamification-job', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${serviceRoleKey}` },
});

const result = await response.json();

// Verify results
assert(result.success === true);
assert(result.points_awarded > 0);
assert(result.streaks_updated > 0);
```

### Load Testing

Test with high volume:
- 1000 concurrent students
- 5000 attendance records
- Measure duration and success rate

## Deployment

### Deploy Edge Function

```bash
# Deploy gamification job
supabase functions deploy gamification-job

# Verify deployment
supabase functions list
```

### Deploy Cron Job

```bash
# Push migration
supabase db push

# Verify cron job
supabase db execute "SELECT * FROM cron.job WHERE jobname = 'gamification-job';"
```

### Environment Variables

Required in Supabase:
- `SUPABASE_URL` - Project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for cron)

Set in Supabase dashboard:
- Settings → API → Project URL
- Settings → API → service_role key

## Troubleshooting

### Job Not Running

**Check:**
1. Cron job exists: `SELECT * FROM cron.job WHERE jobname = 'gamification-job';`
2. Cron extension enabled: `SELECT * FROM pg_extension WHERE extname = 'pg_cron';`
3. Edge function deployed: `supabase functions list`
4. Environment variables set

**Fix:**
- Re-run migration: `supabase db push`
- Re-deploy function: `supabase functions deploy gamification-job`

### Job Failing

**Check:**
1. Recent executions: `SELECT * FROM cron_job_executions WHERE job_name = 'gamification-job' ORDER BY completed_at DESC LIMIT 5;`
2. Error messages in logs
3. Service role permissions

**Fix:**
- Check error message in `cron_job_executions.error_message`
- Verify service role has access to all tables
- Check for data integrity issues

### Slow Performance

**Check:**
1. Duration in `cron_job_executions.duration_ms`
2. Number of records processed
3. Database query performance

**Fix:**
- Add missing indexes
- Optimize queries
- Increase function timeout
- Consider batch size reduction

## Future Enhancements

1. **Parallel Processing**: Process services in parallel for speed
2. **Priority Queue**: Process high-value students first
3. **Smart Scheduling**: Adjust frequency based on activity
4. **Predictive Caching**: Pre-calculate likely queries
5. **Real-time Mode**: Process attendance immediately (no batch)
6. **A/B Testing**: Test different point values
7. **Analytics Dashboard**: Visualize job performance
8. **Auto-scaling**: Adjust resources based on load

## Requirements Mapping

- **Requirement 1**: Dashboard displays points (calculated by engine)
- **Requirement 2**: Streaks tracked and displayed (updated by engine)
- **Requirement 4**: Achievements unlocked (checked by engine)
- **Requirement 6**: Leaderboard preview (updated by engine)
- **Requirement 7**: Achievements page (data from engine)
- **Requirement 8**: Leaderboard page (data from engine)

## Related Documentation

- [Points Calculation](./POINTS_CALCULATION.md)
- [Streak System](./STREAK_SYSTEM.md)
- [Achievement System](./ACHIEVEMENT_SYSTEM.md)
- [Leaderboard System](./LEADERBOARD_SYSTEM.md)
- [Task 14 Progress](./TASK_14_PROGRESS.md)
- [Cron Setup](./CRON_SETUP.md)
