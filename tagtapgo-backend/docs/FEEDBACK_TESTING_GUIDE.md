# Feedback System Testing Guide

This document provides comprehensive testing instructions for the Class Feedback System feature.

## Prerequisites

1. **Database Setup**
   - Run migrations:
     ```bash
     cd tagtapgo-backend
     supabase db push
     ```
   - Verify tables exist:
     - `class_feedback`
     - `feedback_prompts`

2. **Edge Functions Deployment**
   - Deploy functions:
     ```bash
     supabase functions deploy feedback-prompt-job
     supabase functions deploy submit-feedback
     supabase functions deploy feedback-expiry-job
     ```

3. **Test Data**
   - Create test student account
   - Create test course and class schedule
   - Create test attendance record

## Test Cases

### 1. Time-Based Prompt Trigger (15 min after class)

**Objective:** Verify that feedback prompts are created 15 minutes after class ends.

**Steps:**
1. Create a class schedule with `end_time` = 15 minutes ago
2. Create an attendance record for a student (status: 'present')
3. Manually trigger the feedback-prompt-job:
   ```bash
   curl -X POST https://<project-ref>.supabase.co/functions/v1/feedback-prompt-job \
     -H "Authorization: Bearer <service-role-key>"
   ```
4. Verify in database:
   ```sql
   SELECT * FROM feedback_prompts 
   WHERE student_id = '<test-student-id>' 
   ORDER BY created_at DESC LIMIT 1;
   ```

**Expected Result:**
- New `feedback_prompts` record created
- `status` = 'pending'
- `expires_at` = 24 hours from now
- Push notification sent (check logs)

---

### 2. Feedback Submission (Ratings Only)

**Objective:** Verify that students can submit feedback with ratings only and earn 5 points.

**Steps:**
1. Get a pending feedback prompt ID from the database
2. Submit feedback via the feedback page:
   - Navigate to `/feedback/<prompt-id>`
   - Rate all three categories (1-5 stars)
   - Leave comment field empty
   - Click "Submit Feedback"
3. Verify in database:
   ```sql
   -- Check feedback record
   SELECT * FROM class_feedback 
   WHERE student_id = '<test-student-id>' 
   ORDER BY created_at DESC LIMIT 1;
   
   -- Check points awarded
   SELECT * FROM points 
   WHERE student_id = '<test-student-id>' 
   AND transaction_type = 'feedback'
   ORDER BY created_at DESC LIMIT 1;
   
   -- Check prompt status
   SELECT status, completed_at FROM feedback_prompts 
   WHERE id = '<prompt-id>';
   ```

**Expected Result:**
- `class_feedback` record created with ratings
- `comment` field is NULL
- `points` record created with 5 points
- `transaction_type` = 'feedback'
- `feedback_prompts.status` = 'completed'
- Success toast shown: "Thank you for your feedback! You earned 5 points."
- Redirected to dashboard with success message

---

### 3. Feedback Submission (Ratings + Comment)

**Objective:** Verify that students can submit feedback with ratings and comment, earning 10 points.

**Steps:**
1. Get a pending feedback prompt ID
2. Submit feedback via the feedback page:
   - Navigate to `/feedback/<prompt-id>`
   - Rate all three categories (1-5 stars)
   - Add a comment (e.g., "Great lecture! Learned a lot about algorithms.")
   - Click "Submit Feedback"
3. Verify in database (same queries as Test 2)

**Expected Result:**
- `class_feedback` record created with ratings and comment
- `comment` field contains the text
- `points` record created with 10 points
- Success toast shown: "Thank you for your detailed feedback! You earned 10 points."
- Redirected to dashboard

---

### 4. Points Awarding (5 pts and 10 pts)

**Objective:** Verify correct point amounts are awarded based on comment presence.

**Steps:**
1. Submit feedback without comment (Test 2)
2. Submit feedback with comment (Test 3)
3. Check total points:
   ```sql
   SELECT SUM(points) as total_feedback_points 
   FROM points 
   WHERE student_id = '<test-student-id>' 
   AND transaction_type = 'feedback';
   ```

**Expected Result:**
- First submission: 5 points
- Second submission: 10 points
- Total: 15 points
- Points appear in dashboard immediately (real-time update)

---

### 5. Prompt Expiry (24 hours)

**Objective:** Verify that pending prompts expire after 24 hours.

**Steps:**
1. Create a feedback prompt with `expires_at` = 1 hour ago:
   ```sql
   INSERT INTO feedback_prompts (student_id, class_schedule_id, expires_at, status)
   VALUES ('<test-student-id>', '<test-schedule-id>', NOW() - INTERVAL '1 hour', 'pending');
   ```
2. Manually trigger the feedback-expiry-job:
   ```bash
   curl -X POST https://<project-ref>.supabase.co/functions/v1/feedback-expiry-job \
     -H "Authorization: Bearer <service-role-key>"
   ```
3. Verify in database:
   ```sql
   SELECT status FROM feedback_prompts 
   WHERE id = '<prompt-id>';
   ```

**Expected Result:**
- `status` changed from 'pending' to 'expired'
- Expired prompts no longer appear in FeedbackPromptCard

---

### 6. Skip Functionality (No Penalty)

**Objective:** Verify that students can skip feedback without losing points or affecting gamification.

**Steps:**
1. Navigate to `/feedback/<prompt-id>`
2. Click "Skip" button
3. Verify:
   - Redirected to dashboard
   - No feedback record created
   - No points deducted
   - Prompt status remains 'pending'
   - Student can still submit feedback later (before expiry)

**Expected Result:**
- No database changes
- No points affected
- Prompt still available in FeedbackPromptCard

---

### 7. Real-Time Updates on Dashboard

**Objective:** Verify that FeedbackPromptCard updates in real-time when new prompts are created.

**Steps:**
1. Open dashboard in browser
2. Keep dashboard open
3. Manually create a new feedback prompt:
   ```sql
   INSERT INTO feedback_prompts (student_id, class_schedule_id, expires_at, status)
   VALUES ('<test-student-id>', '<test-schedule-id>', NOW() + INTERVAL '24 hours', 'pending');
   ```
4. Observe dashboard (should update without refresh)

**Expected Result:**
- New prompt appears in FeedbackPromptCard within 1-2 seconds
- No page refresh needed
- Prompt shows correct course info and expiry countdown

---

### 8. Anonymous vs Identified Feedback

**Objective:** Verify that anonymous toggle works correctly.

**Steps:**
1. Submit feedback with `is_anonymous` = true (default)
2. Submit feedback with `is_anonymous` = false (unchecked)
3. Verify in database:
   ```sql
   SELECT is_anonymous FROM class_feedback 
   WHERE student_id = '<test-student-id>' 
   ORDER BY created_at DESC LIMIT 2;
   ```

**Expected Result:**
- First record: `is_anonymous` = true
- Second record: `is_anonymous` = false
- Both submissions award points correctly

---

### 9. Duplicate Submission Prevention

**Objective:** Verify that students cannot submit feedback twice for the same class.

**Steps:**
1. Submit feedback for a class (complete Test 2 or 3)
2. Try to access the same feedback page again: `/feedback/<prompt-id>`
3. Try to submit feedback again via API

**Expected Result:**
- Redirected to dashboard with message: "?feedback=already-submitted"
- API returns 409 Conflict error
- No duplicate `class_feedback` record created
- No additional points awarded

---

### 10. Expired Prompt Access

**Objective:** Verify that students cannot submit feedback for expired prompts.

**Steps:**
1. Create an expired prompt (Test 5)
2. Try to access feedback page: `/feedback/<expired-prompt-id>`

**Expected Result:**
- Redirected to dashboard with message: "?feedback=expired"
- Cannot submit feedback
- Prompt removed from FeedbackPromptCard

---

## Automated Testing Script

```bash
#!/bin/bash
# feedback-test.sh - Automated testing script

# Set variables
PROJECT_REF="<your-project-ref>"
SERVICE_ROLE_KEY="<your-service-role-key>"
STUDENT_ID="<test-student-id>"
SCHEDULE_ID="<test-schedule-id>"

echo "=== Feedback System Testing ==="

# Test 1: Trigger prompt job
echo "Test 1: Triggering feedback-prompt-job..."
curl -X POST "https://${PROJECT_REF}.supabase.co/functions/v1/feedback-prompt-job" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}"
echo ""

# Test 2: Check prompts created
echo "Test 2: Checking prompts in database..."
# (Run SQL query manually)

# Test 3: Trigger expiry job
echo "Test 3: Triggering feedback-expiry-job..."
curl -X POST "https://${PROJECT_REF}.supabase.co/functions/v1/feedback-expiry-job" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}"
echo ""

echo "=== Testing Complete ==="
```

## Performance Testing

### Load Testing
- Test with 100+ simultaneous feedback submissions
- Verify database performance with indexes
- Check Edge Function response times (should be < 500ms)

### Real-Time Testing
- Test with 10+ students receiving prompts simultaneously
- Verify Supabase Realtime updates work correctly
- Check for race conditions in duplicate prevention

## Monitoring

### Key Metrics to Track
1. **Prompt Creation Rate**: How many prompts created per day
2. **Submission Rate**: % of prompts that result in submissions
3. **Expiry Rate**: % of prompts that expire without submission
4. **Average Response Time**: Time from prompt to submission
5. **Points Awarded**: Total feedback points awarded per day

### Database Queries for Monitoring

```sql
-- Prompt creation rate (last 7 days)
SELECT DATE(created_at) as date, COUNT(*) as prompts_created
FROM feedback_prompts
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Submission rate
SELECT 
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'expired') as expired,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 2) as completion_rate
FROM feedback_prompts;

-- Average feedback ratings
SELECT 
  ROUND(AVG(content_quality), 2) as avg_content_quality,
  ROUND(AVG(clarity), 2) as avg_clarity,
  ROUND(AVG(pace), 2) as avg_pace,
  COUNT(*) FILTER (WHERE comment IS NOT NULL) as with_comments,
  COUNT(*) as total_submissions
FROM class_feedback;

-- Points awarded from feedback
SELECT 
  SUM(points) as total_points,
  COUNT(*) as total_transactions,
  ROUND(AVG(points), 2) as avg_points_per_submission
FROM points
WHERE transaction_type = 'feedback';
```

## Troubleshooting

### Issue: Prompts not being created
- Check if attendance records exist
- Verify class schedule end_time is 15-20 minutes ago
- Check Edge Function logs for errors
- Verify pg_cron job is scheduled correctly

### Issue: Points not awarded
- Check if `points` table has 'feedback' in CHECK constraint
- Verify Edge Function has service role permissions
- Check for duplicate submission errors

### Issue: Real-time updates not working
- Verify Supabase Realtime is enabled
- Check browser console for WebSocket errors
- Verify RLS policies allow SELECT on feedback_prompts

### Issue: Expired prompts still showing
- Run feedback-expiry-job manually
- Check if expires_at is in the past
- Verify FeedbackPromptCard filters by status='pending'

## Deployment Checklist

- [ ] Database migrations applied
- [ ] Edge Functions deployed
- [ ] pg_cron jobs scheduled
- [ ] Environment variables set
- [ ] RLS policies enabled
- [ ] Indexes created
- [ ] Test data seeded
- [ ] All 10 test cases passed
- [ ] Performance testing completed
- [ ] Monitoring queries set up
- [ ] Documentation updated

## Next Steps

After successful testing:
1. Deploy to production
2. Monitor metrics for first week
3. Gather user feedback
4. Iterate on UI/UX based on feedback
5. Consider adding admin dashboard for viewing aggregated feedback
