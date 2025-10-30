# Feedback & Push Notification Test Guide

## Overview

This test verifies the end-to-end feedback prompt and push notification system for the Demo User.

## Test Scenario

**Setup:**
- Demo User: `demo@demo.edu` (ID: `ab191d6e-e016-418b-80a1-0b2b25e007c7`)
- Test Class: CS101 (Introduction to Computer Science)
- Class ended: 5 minutes ago
- Attendance: Present

**Expected Flow:**
1. ✅ Class schedule created for today
2. ✅ Attendance record created (Demo User attended)
3. ⏳ Feedback-prompt-job cron runs (every 5 minutes)
4. ⏳ Feedback prompt created in `feedback_prompts` table
5. ⏳ Push notification sent to Demo User
6. ⏳ Notification appears in `notifications` table

---

## Deployment

```bash
cd tagtapgo-backend
supabase db push
```

This will create:
- Test class schedule (ended 5 minutes ago)
- Test attendance record for Demo User

---

## Verification Steps

### 1. Check Test Data Created

```sql
-- Check test class schedule
SELECT 
  cs.id,
  cs.day_of_week,
  cs.start_time,
  cs.end_time,
  cs.location,
  c.name as course_name
FROM public.class_schedules cs
JOIN public.courses c ON cs.course_id = c.id
WHERE cs.metadata->>'test_data' = 'true';
```

Expected: 1 row with today's day and times 5 minutes ago

```sql
-- Check test attendance
SELECT 
  a.id,
  a.date,
  a.status,
  a.check_in_time,
  c.name as course_name,
  s.email as student_email
FROM public.attendance a
JOIN public.courses c ON a.course_id = c.id
JOIN public.students s ON a.student_id = s.id
WHERE a.metadata->>'test_data' = 'true';
```

Expected: 1 row with Demo User's attendance

### 2. Wait for Cron Job

The `feedback-prompt-job` runs every 5 minutes. Wait up to 5 minutes for it to process.

### 3. Check Feedback Prompt Created

```sql
SELECT 
  fp.id,
  fp.student_id,
  fp.status,
  fp.expires_at,
  fp.prompt_sent_at,
  fp.created_at,
  c.name as course_name
FROM public.feedback_prompts fp
JOIN public.class_schedules cs ON fp.class_schedule_id = cs.id
JOIN public.courses c ON cs.course_id = c.id
WHERE fp.student_id = 'ab191d6e-e016-418b-80a1-0b2b25e007c7'
ORDER BY fp.created_at DESC
LIMIT 1;
```

**Expected:**
- `status`: 'pending'
- `expires_at`: 24 hours from now
- `prompt_sent_at`: Current timestamp
- `course_name`: 'Introduction to Computer Science'

### 4. Check Push Notification Sent

```sql
SELECT 
  n.id,
  n.notification_type,
  n.title,
  n.message,
  n.read,
  n.created_at,
  n.data
FROM public.notifications n
WHERE n.student_id = 'ab191d6e-e016-418b-80a1-0b2b25e007c7'
ORDER BY n.created_at DESC
LIMIT 1;
```

**Expected:**
- `notification_type`: 'feedback_prompt'
- `title`: 'How was your class?'
- `message`: Contains course name
- `read`: false
- `data`: Contains class_schedule_id and other metadata

### 5. Check Cron Job Logs

```sql
-- Check recent cron job executions
SELECT 
  job_name,
  status,
  started_at,
  completed_at,
  result
FROM cron_job_executions
WHERE job_name = 'feedback-prompt-job'
ORDER BY started_at DESC
LIMIT 5;
```

---

## Expected Timeline

| Time | Event |
|------|-------|
| T+0 | Migration runs, creates test data |
| T+0 to T+5 | Wait for cron job |
| T+5 | Cron job runs, creates feedback prompt |
| T+5 | Push notification sent |
| T+5 | Notification appears in table |

---

## Troubleshooting

### No Feedback Prompt Created

**Check cron job is running:**
```sql
SELECT * FROM cron.job WHERE jobname = 'feedback-prompt-job';
```

**Check cron job logs:**
```sql
SELECT * FROM cron_job_executions 
WHERE job_name = 'feedback-prompt-job'
ORDER BY started_at DESC LIMIT 1;
```

**Manually trigger the job:**
```sql
-- This requires superuser access
SELECT cron.schedule('feedback-prompt-job-manual', '* * * * *', 
  'SELECT net.http_post(...)'
);
```

### No Notification Created

**Check if feedback prompt exists:**
```sql
SELECT COUNT(*) FROM feedback_prompts 
WHERE student_id = 'ab191d6e-e016-418b-80a1-0b2b25e007c7'
  AND status = 'pending';
```

**Check notification settings:**
```sql
SELECT settings FROM students 
WHERE id = 'ab191d6e-e016-418b-80a1-0b2b25e007c7';
```

**Check push subscriptions:**
```sql
SELECT * FROM push_subscriptions 
WHERE student_id = 'ab191d6e-e016-418b-80a1-0b2b25e007c7';
```

### Class Time Issues

**Check if class ended recently enough:**
```sql
SELECT 
  cs.end_time,
  NOW()::TIME as current_time,
  EXTRACT(EPOCH FROM (NOW()::TIME - cs.end_time)) / 60 as minutes_since_end
FROM class_schedules cs
WHERE cs.metadata->>'test_data' = 'true';
```

Should show ~5 minutes since end.

---

## Cleanup

After testing, remove test data:

```sql
-- Remove feedback prompts
DELETE FROM public.feedback_prompts 
WHERE class_schedule_id IN (
  SELECT id FROM public.class_schedules 
  WHERE metadata->>'test_data' = 'true'
);

-- Remove test notifications (optional - they're useful to keep)
-- DELETE FROM public.notifications 
-- WHERE data->>'test_data' = 'true';

-- Remove test attendance
DELETE FROM public.attendance 
WHERE metadata->>'test_data' = 'true';

-- Remove test class schedule
DELETE FROM public.class_schedules 
WHERE metadata->>'test_data' = 'true';
```

---

## Success Criteria

✅ Test class schedule created  
✅ Test attendance record created  
✅ Feedback prompt created within 5 minutes  
✅ Push notification sent  
✅ Notification appears in notifications table  
✅ Demo User can see prompt in dashboard (frontend test)  

---

## Related Documentation

- `FEEDBACK_SYSTEM_README.md` - Feedback system overview
- `FEEDBACK_TESTING_GUIDE.md` - Comprehensive testing guide
- `FEEDBACK_DEPLOYMENT_GUIDE.md` - Deployment instructions

---

## Notes

- The feedback-prompt-job runs every 5 minutes
- Prompts expire after 24 hours
- Notifications are sent via push notification system
- Demo User must have push subscription for browser notifications
- In-app notifications always work regardless of push subscription
