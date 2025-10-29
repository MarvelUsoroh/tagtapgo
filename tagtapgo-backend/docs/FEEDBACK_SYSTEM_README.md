# Class Feedback System

## Overview

The Class Feedback System allows students to provide quick, structured feedback after attending classes. This feature helps improve course quality while rewarding students with bonus points for their input.

## Features

### For Students
- **Automatic Prompts**: Receive feedback prompts 15 minutes after class ends
- **Quick Ratings**: Rate three aspects (Content Quality, Clarity, Pace) on a 1-5 star scale
- **Optional Comments**: Add detailed feedback for extra points
- **Points Rewards**: Earn 5 points for ratings, +5 bonus for comments (10 total)
- **Anonymous Option**: Submit feedback anonymously (default)
- **24-Hour Window**: Prompts expire after 24 hours
- **No Penalty**: Skip feedback without losing points or affecting gamification
- **Real-Time Updates**: Dashboard shows pending feedback prompts instantly

### For Administrators (Future)
- View aggregated feedback data
- Identify courses needing improvement
- Track feedback submission rates
- Export feedback reports

## Architecture

### Frontend Components

1. **Feedback Page** (`/feedback/[sessionId]`)
   - Server Component: Fetches prompt and class details
   - Client Component: Handles form submission and interactivity
   - Features: Star ratings, comment textarea, anonymous toggle, skip button

2. **FeedbackPromptCard** (`/components/FeedbackPromptCard.tsx`)
   - Displays up to 3 pending feedback prompts on dashboard
   - Shows course info, expiry countdown, points incentive
   - Real-time updates via Supabase Realtime
   - Click to navigate to feedback page

### Backend Components

1. **Database Tables**
   - `class_feedback`: Stores submitted feedback
   - `feedback_prompts`: Tracks feedback prompts and their status

2. **Edge Functions**
   - `feedback-prompt-job`: Creates prompts 15 min after class (runs every 5 min)
   - `submit-feedback`: Handles feedback submission and points awarding
   - `feedback-expiry-job`: Expires pending prompts after 24 hours (runs hourly)

3. **Scheduled Jobs**
   - pg_cron job for feedback-prompt-job (*/5 * * * *)
   - pg_cron job for feedback-expiry-job (0 * * * *)

4. **Achievements**
   - Voice Heard: 5 feedback submissions (50 pts, common)
   - Course Critic: 10 different courses (100 pts, rare)
   - Feedback Champion: 25 submissions (250 pts, epic)
   - Thoughtful Contributor: 10 with comments (150 pts, rare)

## User Flow

```
1. Student attends class
   ↓
2. Class ends
   ↓
3. [15 minutes later] feedback-prompt-job runs
   ↓
4. Feedback prompt created (expires in 24h)
   ↓
5. Push notification sent to student
   ↓
6. Student sees prompt in dashboard
   ↓
7. Student clicks prompt → navigates to feedback page
   ↓
8. Student rates 3 categories (1-5 stars)
   ↓
9. [Optional] Student adds comment
   ↓
10. Student submits feedback
    ↓
11. Feedback saved to database
    ↓
12. Points awarded (5 or 10)
    ↓
13. Prompt marked as completed
    ↓
14. Success message shown
    ↓
15. Redirected to dashboard
```

## Database Schema

### class_feedback

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| student_id | UUID | Foreign key to students |
| course_id | UUID | Foreign key to courses |
| class_schedule_id | UUID | Foreign key to class_schedules |
| content_quality | INTEGER | Rating 1-5 |
| clarity | INTEGER | Rating 1-5 |
| pace | INTEGER | Rating 1-5 |
| comment | TEXT | Optional comment |
| is_anonymous | BOOLEAN | Anonymous flag (default: true) |
| submitted_at | TIMESTAMPTZ | Submission timestamp |
| helpful_count | INTEGER | Helpful votes (future) |
| flagged | BOOLEAN | Flagged for review (future) |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Update timestamp |

**Constraints:**
- UNIQUE(student_id, class_schedule_id) - One feedback per class
- CHECK(content_quality >= 1 AND content_quality <= 5)
- CHECK(clarity >= 1 AND clarity <= 5)
- CHECK(pace >= 1 AND pace <= 5)

### feedback_prompts

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| student_id | UUID | Foreign key to students |
| class_schedule_id | UUID | Foreign key to class_schedules |
| prompt_sent_at | TIMESTAMPTZ | When prompt was created |
| expires_at | TIMESTAMPTZ | Expiry timestamp (24h) |
| status | TEXT | pending/completed/expired/skipped |
| completed_at | TIMESTAMPTZ | Completion timestamp |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Update timestamp |

**Constraints:**
- UNIQUE(student_id, class_schedule_id) - One prompt per class
- CHECK(status IN ('pending', 'completed', 'expired', 'skipped'))

## API Endpoints

### POST /functions/v1/submit-feedback

Submit class feedback and earn points.

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "student_id": "uuid",
  "course_id": "uuid",
  "class_schedule_id": "uuid",
  "prompt_id": "uuid",
  "content_quality": 5,
  "clarity": 4,
  "pace": 5,
  "comment": "Great lecture! Learned a lot.",
  "is_anonymous": true
}
```

**Response:**
```json
{
  "success": true,
  "feedback_id": "uuid",
  "points_earned": 10,
  "message": "Thank you for your detailed feedback! You earned 10 points."
}
```

**Error Responses:**
- 400: Invalid ratings or missing fields
- 401: Invalid or expired token
- 403: Not authorized
- 409: Feedback already submitted
- 500: Internal server error

### POST /functions/v1/feedback-prompt-job

Create feedback prompts for classes that ended 15 minutes ago.

**Authentication:** Service role key

**Response:**
```json
{
  "success": true,
  "timestamp": "2024-10-23T12:00:00Z",
  "classesProcessed": 5,
  "promptsCreated": 12,
  "notificationsSent": 12,
  "errors": []
}
```

### POST /functions/v1/feedback-expiry-job

Expire pending prompts that are past their 24-hour window.

**Authentication:** Service role key

**Response:**
```json
{
  "success": true,
  "message": "Expired 3 feedback prompts",
  "expired": 3,
  "timestamp": "2024-10-23T12:00:00Z",
  "promptIds": ["uuid1", "uuid2", "uuid3"]
}
```

## Points System

| Action | Points | Notes |
|--------|--------|-------|
| Submit ratings only | 5 | Three 1-5 star ratings |
| Submit ratings + comment | 10 | 5 base + 5 bonus |
| Skip feedback | 0 | No penalty |

**Transaction Type:** `feedback`

**Idempotency:** Duplicate submissions are prevented by UNIQUE constraint

## Achievements

| Achievement | Criteria | Points | Rarity |
|-------------|----------|--------|--------|
| Voice Heard | 5 submissions | 50 | Common |
| Course Critic | 10 different courses | 100 | Rare |
| Feedback Champion | 25 submissions | 250 | Epic |
| Thoughtful Contributor | 10 with comments | 150 | Rare |

## Configuration

### Environment Variables

```bash
# Supabase
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# VAPID (for push notifications)
VAPID_PUBLIC_KEY=<public-key>
VAPID_PRIVATE_KEY=<private-key>
VAPID_SUBJECT=mailto:support@tagtapgo.com
```

### Cron Schedule

```sql
-- Feedback prompt job (every 5 minutes)
*/5 * * * *

-- Feedback expiry job (every hour)
0 * * * *
```

## Monitoring

### Key Metrics

1. **Prompt Creation Rate**: Prompts created per day
2. **Submission Rate**: % of prompts that result in submissions
3. **Expiry Rate**: % of prompts that expire without submission
4. **Average Response Time**: Time from prompt to submission
5. **Points Awarded**: Total feedback points per day
6. **Average Ratings**: Mean ratings for each category

### Monitoring Queries

```sql
-- Daily metrics
SELECT 
  DATE(created_at) as date,
  COUNT(*) as prompts_created,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'expired') as expired,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 2) as completion_rate
FROM feedback_prompts
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Average ratings
SELECT 
  ROUND(AVG(content_quality), 2) as avg_content,
  ROUND(AVG(clarity), 2) as avg_clarity,
  ROUND(AVG(pace), 2) as avg_pace,
  COUNT(*) FILTER (WHERE comment IS NOT NULL) as with_comments,
  COUNT(*) as total
FROM class_feedback
WHERE created_at >= NOW() - INTERVAL '7 days';

-- Points awarded
SELECT 
  SUM(points) as total_points,
  COUNT(*) as transactions,
  ROUND(AVG(points), 2) as avg_points
FROM points
WHERE transaction_type = 'feedback'
AND created_at >= NOW() - INTERVAL '7 days';
```

## Security

### Row Level Security (RLS)

**class_feedback:**
- Students can read their own feedback
- Students can insert their own feedback
- Service role has full access

**feedback_prompts:**
- Students can read their own prompts
- Students can update their own prompts (status changes)
- Service role has full access

### Data Privacy

- Feedback is anonymous by default
- Students can opt-in to identified feedback
- Admin dashboard (future) will show aggregated data only
- Individual feedback is never shared with other students

## Future Enhancements

1. **Admin Dashboard**
   - View aggregated feedback by course
   - Identify trends and patterns
   - Export reports

2. **Feedback Analytics**
   - Sentiment analysis on comments
   - Correlation with attendance rates
   - Course improvement tracking

3. **Enhanced Notifications**
   - Reminder notifications (2 hours before expiry)
   - Weekly feedback summary for students
   - Instructor notifications for low ratings

4. **Gamification**
   - Leaderboard for most helpful feedback
   - Badges for consistent feedback providers
   - Bonus points for detailed comments

5. **Social Features**
   - Mark feedback as helpful
   - Reply to feedback (instructors only)
   - Share feedback insights with peers

## Troubleshooting

See `FEEDBACK_TESTING_GUIDE.md` for detailed troubleshooting steps.

## Documentation

- [Testing Guide](./FEEDBACK_TESTING_GUIDE.md)
- [Deployment Guide](./FEEDBACK_DEPLOYMENT_GUIDE.md)
- [API Documentation](./API_DOCUMENTATION.md) (future)

## Support

For issues or questions:
- Check Edge Function logs in Supabase Dashboard
- Review database query logs
- Check cron job execution history
- Contact development team

## Changelog

### Version 1.0.0 (2024-10-23)
- Initial release
- Basic feedback submission
- Automatic prompt creation
- Points rewards
- Anonymous option
- Real-time updates
- 4 feedback achievements
