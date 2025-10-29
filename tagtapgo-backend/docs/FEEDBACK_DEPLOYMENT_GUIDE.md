# Feedback System Deployment Guide

This guide provides step-by-step instructions for deploying the Class Feedback System to production.

## Overview

The feedback system consists of:
- **Frontend**: Feedback page, FeedbackPromptCard component
- **Backend**: 3 Edge Functions, 3 database migrations
- **Scheduled Jobs**: 2 pg_cron jobs

## Prerequisites

- Supabase CLI installed (`npm install -g supabase`)
- Supabase project created
- Database access (service role key)
- Vercel account (for frontend deployment)

## Step 1: Database Migrations

### 1.1 Apply Migrations

```bash
cd tagtapgo-backend

# Link to your Supabase project (if not already linked)
supabase link --project-ref <your-project-ref>

# Apply migrations
supabase db push
```

### 1.2 Verify Tables Created

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('class_feedback', 'feedback_prompts');

-- Check if indexes exist
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('class_feedback', 'feedback_prompts');

-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('class_feedback', 'feedback_prompts');
```

### 1.3 Verify Achievements Added

```sql
-- Check feedback achievements
SELECT name, description, category, points_reward, rarity 
FROM achievements 
WHERE name IN ('Voice Heard', 'Course Critic', 'Feedback Champion', 'Thoughtful Contributor');
```

### 1.4 Verify Points Transaction Type Updated

```sql
-- Check if 'feedback' is in the constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'points_transaction_type_check';
```

## Step 2: Deploy Edge Functions

### 2.1 Deploy Functions

```bash
cd tagtapgo-backend

# Deploy feedback-prompt-job
supabase functions deploy feedback-prompt-job

# Deploy submit-feedback
supabase functions deploy submit-feedback

# Deploy feedback-expiry-job
supabase functions deploy feedback-expiry-job
```

### 2.2 Set Environment Variables

In Supabase Dashboard → Edge Functions → Settings:

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
VAPID_PUBLIC_KEY=<your-vapid-public-key>
VAPID_PRIVATE_KEY=<your-vapid-private-key>
VAPID_SUBJECT=mailto:support@tagtapgo.com
```

### 2.3 Test Functions

```bash
# Test feedback-prompt-job
curl -X POST https://<project-ref>.supabase.co/functions/v1/feedback-prompt-job \
  -H "Authorization: Bearer <service-role-key>"

# Test submit-feedback (requires user token)
curl -X POST https://<project-ref>.supabase.co/functions/v1/submit-feedback \
  -H "Authorization: Bearer <user-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "<student-id>",
    "course_id": "<course-id>",
    "class_schedule_id": "<schedule-id>",
    "prompt_id": "<prompt-id>",
    "content_quality": 5,
    "clarity": 4,
    "pace": 5,
    "comment": "Great lecture!",
    "is_anonymous": true
  }'

# Test feedback-expiry-job
curl -X POST https://<project-ref>.supabase.co/functions/v1/feedback-expiry-job \
  -H "Authorization: Bearer <service-role-key>"
```

## Step 3: Schedule Cron Jobs

### 3.1 Enable pg_cron Extension

```sql
-- Enable pg_cron (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### 3.2 Schedule feedback-prompt-job (Every 5 minutes)

```sql
-- Schedule feedback-prompt-job to run every 5 minutes
SELECT cron.schedule(
  'feedback-prompt-job',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/feedback-prompt-job',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <service-role-key>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### 3.3 Schedule feedback-expiry-job (Every hour)

```sql
-- Schedule feedback-expiry-job to run every hour
SELECT cron.schedule(
  'feedback-expiry-job',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/feedback-expiry-job',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <service-role-key>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### 3.4 Verify Cron Jobs

```sql
-- List all cron jobs
SELECT * FROM cron.job;

-- Check job execution history
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

## Step 4: Deploy Frontend

### 4.1 Build and Test Locally

```bash
cd tagtapgo-app

# Install dependencies
npm install

# Build
npm run build

# Test locally
npm run dev
```

### 4.2 Deploy to Vercel

```bash
# Deploy to Vercel
vercel --prod

# Or push to main branch (if auto-deploy is enabled)
git add .
git commit -m "feat: add class feedback system"
git push origin main
```

### 4.3 Set Environment Variables in Vercel

In Vercel Dashboard → Project → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

## Step 5: Verify Deployment

### 5.1 Frontend Verification

1. Navigate to production URL
2. Log in as a test student
3. Check dashboard for FeedbackPromptCard
4. Navigate to `/feedback/<prompt-id>` (if prompt exists)
5. Submit feedback and verify points awarded

### 5.2 Backend Verification

```sql
-- Check if prompts are being created
SELECT COUNT(*) as total_prompts, 
       COUNT(*) FILTER (WHERE status = 'pending') as pending,
       COUNT(*) FILTER (WHERE status = 'completed') as completed,
       COUNT(*) FILTER (WHERE status = 'expired') as expired
FROM feedback_prompts;

-- Check if feedback is being submitted
SELECT COUNT(*) as total_feedback,
       COUNT(*) FILTER (WHERE comment IS NOT NULL) as with_comments,
       ROUND(AVG(content_quality), 2) as avg_content_quality,
       ROUND(AVG(clarity), 2) as avg_clarity,
       ROUND(AVG(pace), 2) as avg_pace
FROM class_feedback;

-- Check if points are being awarded
SELECT COUNT(*) as total_transactions,
       SUM(points) as total_points,
       ROUND(AVG(points), 2) as avg_points
FROM points
WHERE transaction_type = 'feedback';
```

### 5.3 Cron Job Verification

```sql
-- Check if cron jobs are running
SELECT jobname, last_run, next_run, status
FROM cron.job
WHERE jobname IN ('feedback-prompt-job', 'feedback-expiry-job');

-- Check recent job runs
SELECT jobname, status, start_time, end_time, 
       EXTRACT(EPOCH FROM (end_time - start_time)) as duration_seconds
FROM cron.job_run_details
WHERE jobname IN ('feedback-prompt-job', 'feedback-expiry-job')
ORDER BY start_time DESC
LIMIT 20;
```

## Step 6: Monitoring Setup

### 6.1 Set Up Alerts

In Supabase Dashboard → Database → Webhooks:

1. Create webhook for failed cron jobs
2. Create webhook for high error rates in Edge Functions
3. Set up email/Slack notifications

### 6.2 Create Monitoring Dashboard

```sql
-- Create view for feedback metrics
CREATE OR REPLACE VIEW feedback_metrics AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as prompts_created,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'expired') as expired,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 2) as completion_rate
FROM feedback_prompts
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Query metrics
SELECT * FROM feedback_metrics LIMIT 30;
```

### 6.3 Set Up Logging

```sql
-- Create log table for feedback system events
CREATE TABLE IF NOT EXISTS feedback_system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index
CREATE INDEX idx_feedback_system_logs_event_type ON feedback_system_logs(event_type);
CREATE INDEX idx_feedback_system_logs_created_at ON feedback_system_logs(created_at DESC);
```

## Step 7: Post-Deployment Testing

Run through all test cases in `FEEDBACK_TESTING_GUIDE.md`:

- [ ] Test 1: Time-based prompt trigger
- [ ] Test 2: Feedback submission (ratings only)
- [ ] Test 3: Feedback submission (ratings + comment)
- [ ] Test 4: Points awarding
- [ ] Test 5: Prompt expiry
- [ ] Test 6: Skip functionality
- [ ] Test 7: Real-time updates
- [ ] Test 8: Anonymous vs identified
- [ ] Test 9: Duplicate prevention
- [ ] Test 10: Expired prompt access

## Rollback Plan

If issues are encountered:

### Rollback Database Migrations

```bash
# Revert migrations
supabase db reset

# Or manually drop tables
DROP TABLE IF EXISTS public.class_feedback CASCADE;
DROP TABLE IF EXISTS public.feedback_prompts CASCADE;
```

### Disable Cron Jobs

```sql
-- Unschedule cron jobs
SELECT cron.unschedule('feedback-prompt-job');
SELECT cron.unschedule('feedback-expiry-job');
```

### Rollback Frontend

```bash
# Revert to previous deployment in Vercel
vercel rollback
```

## Troubleshooting

### Issue: Cron jobs not running

**Solution:**
```sql
-- Check if pg_cron is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Check job status
SELECT * FROM cron.job WHERE jobname LIKE 'feedback%';

-- Check for errors
SELECT * FROM cron.job_run_details 
WHERE jobname LIKE 'feedback%' 
AND status = 'failed'
ORDER BY start_time DESC;
```

### Issue: Edge Functions timing out

**Solution:**
- Check function logs in Supabase Dashboard
- Verify database indexes are created
- Optimize queries if needed
- Increase function timeout (if available)

### Issue: Real-time updates not working

**Solution:**
- Verify Supabase Realtime is enabled
- Check RLS policies on feedback_prompts table
- Verify WebSocket connection in browser console
- Check for CORS issues

## Maintenance

### Weekly Tasks
- Review feedback metrics
- Check cron job execution logs
- Monitor Edge Function error rates
- Review student feedback submissions

### Monthly Tasks
- Analyze feedback data for insights
- Optimize database queries if needed
- Review and update achievements
- Clean up old expired prompts (optional)

```sql
-- Clean up expired prompts older than 30 days
DELETE FROM feedback_prompts 
WHERE status = 'expired' 
AND created_at < NOW() - INTERVAL '30 days';
```

## Support

For issues or questions:
- Check logs in Supabase Dashboard
- Review `FEEDBACK_TESTING_GUIDE.md`
- Contact development team
- Create GitHub issue

## Changelog

- **2024-10-23**: Initial deployment
  - Added class_feedback and feedback_prompts tables
  - Deployed 3 Edge Functions
  - Scheduled 2 cron jobs
  - Added 4 feedback achievements
  - Updated points transaction type
