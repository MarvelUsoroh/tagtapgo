-- ============================================================================
-- Job Status Check Script
-- ============================================================================
-- Run this script to verify all cron jobs are scheduled and running correctly
-- ============================================================================

\echo ''
\echo '============================================'
\echo 'SCHEDULED JOBS STATUS'
\echo '============================================'
\echo ''

-- List all scheduled jobs
\echo '📋 Scheduled Jobs:'
\echo ''
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job 
ORDER BY jobname;

\echo ''
\echo '============================================'
\echo 'RECENT JOB EXECUTIONS (Last 20)'
\echo '============================================'
\echo ''

-- Show recent job runs
SELECT 
  j.jobname,
  jrd.status,
  jrd.start_time,
  jrd.end_time,
  EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time)) as duration_seconds,
  LEFT(jrd.return_message, 100) as message_preview
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
ORDER BY jrd.start_time DESC 
LIMIT 20;

\echo ''
\echo '============================================'
\echo 'FAILED JOB RUNS (Last 10)'
\echo '============================================'
\echo ''

-- Show failed jobs
SELECT 
  j.jobname,
  jrd.start_time,
  jrd.return_message
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE jrd.status = 'failed'
ORDER BY jrd.start_time DESC 
LIMIT 10;

\echo ''
\echo '============================================'
\echo 'JOB EXECUTION SUMMARY (Last 24 Hours)'
\echo '============================================'
\echo ''

-- Summary of job executions
SELECT 
  j.jobname,
  COUNT(*) as total_runs,
  COUNT(*) FILTER (WHERE jrd.status = 'succeeded') as successful,
  COUNT(*) FILTER (WHERE jrd.status = 'failed') as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE jrd.status = 'succeeded') / COUNT(*), 2) as success_rate,
  MAX(jrd.start_time) as last_run
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE jrd.start_time >= NOW() - INTERVAL '24 hours'
GROUP BY j.jobname
ORDER BY j.jobname;

\echo ''
\echo '============================================'
\echo 'NOTIFICATION STATISTICS (Last 24 Hours)'
\echo '============================================'
\echo ''

-- Notification counts by type
SELECT 
  notification_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE read = true) as read_count,
  COUNT(*) FILTER (WHERE read = false) as unread_count
FROM notifications
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY notification_type
ORDER BY total DESC;

\echo ''
\echo '============================================'
\echo 'PUSH SUBSCRIPTION STATUS'
\echo '============================================'
\echo ''

-- Push subscription counts
SELECT 
  COUNT(*) as total_subscriptions,
  COUNT(DISTINCT student_id) as unique_students,
  MAX(created_at) as most_recent_subscription
FROM push_subscriptions;

\echo ''
\echo '============================================'
\echo 'FEEDBACK PROMPT STATUS'
\echo '============================================'
\echo ''

-- Feedback prompt statistics
SELECT 
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM feedback_prompts
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY status
ORDER BY count DESC;

\echo ''
\echo '============================================'
\echo 'GAMIFICATION METRICS (Last 24 Hours)'
\echo '============================================'
\echo ''

-- Points awarded
SELECT 
  transaction_type,
  COUNT(*) as transactions,
  SUM(points) as total_points,
  ROUND(AVG(points), 2) as avg_points
FROM points
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY transaction_type
ORDER BY total_points DESC;

\echo ''
\echo '============================================'
\echo 'ACHIEVEMENTS UNLOCKED (Last 24 Hours)'
\echo '============================================'
\echo ''

-- Recent achievements
SELECT 
  a.name,
  a.rarity,
  COUNT(*) as unlocked_count
FROM student_achievements sa
JOIN achievements a ON sa.achievement_id = a.id
WHERE sa.unlocked_at >= NOW() - INTERVAL '24 hours'
  AND sa.unlocked = true
GROUP BY a.name, a.rarity
ORDER BY unlocked_count DESC;

\echo ''
\echo '============================================'
\echo 'LEADERBOARD UPDATE STATUS'
\echo '============================================'
\echo ''

-- Leaderboard freshness
SELECT 
  leaderboard_type,
  period,
  COUNT(DISTINCT student_id) as student_count,
  MAX(updated_at) as last_updated,
  EXTRACT(EPOCH FROM (NOW() - MAX(updated_at))) / 60 as minutes_since_update
FROM leaderboard_entries
GROUP BY leaderboard_type, period
ORDER BY leaderboard_type, period;

\echo ''
\echo '============================================'
\echo 'HEALTH CHECK SUMMARY'
\echo '============================================'
\echo ''

-- Overall health indicators
SELECT 
  'Jobs Scheduled' as metric,
  COUNT(*)::text as value
FROM cron.job
WHERE active = true

UNION ALL

SELECT 
  'Jobs Running Successfully',
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'succeeded') / COUNT(*), 2)::text || '%'
FROM cron.job_run_details
WHERE start_time >= NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
  'Active Push Subscriptions',
  COUNT(*)::text
FROM push_subscriptions

UNION ALL

SELECT 
  'Pending Feedback Prompts',
  COUNT(*)::text
FROM feedback_prompts
WHERE status = 'pending'
  AND expires_at > NOW()

UNION ALL

SELECT 
  'Notifications Sent (24h)',
  COUNT(*)::text
FROM notifications
WHERE created_at >= NOW() - INTERVAL '24 hours';

\echo ''
\echo '✅ Job status check complete!'
\echo ''
