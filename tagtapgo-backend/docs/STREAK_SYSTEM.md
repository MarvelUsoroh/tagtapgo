# Streak System

## Overview

The Streak System tracks consecutive days of class attendance for students. It implements streak mechanics including streak freezes, at-risk notifications, and longest streak tracking to motivate consistent attendance.

## Streak Rules

### Basic Rules

1. **Streak Increment**: Streak increases by 1 for each consecutive day of attendance
2. **Attendance Types**: Present, Late, and Excused all count toward streaks
3. **Absent**: Does not count toward streak and may break it
4. **Multiple Classes**: Multiple classes on the same day = 1 day for streak purposes
5. **Consecutive Days**: Must attend every day to maintain streak (weekends excluded in calculation)

### Streak Break

A streak breaks when:
- Student misses a day of classes (no attendance records)
- Gap between attendance dates > 1 day (without using freeze)
- When broken, streak resets to 1 on next attendance

### Streak Freeze

**Rules:**
- Each student gets **1 freeze per month**
- Freeze prevents streak break for **1 missed day only**
- Freezes reset on the 1st of each month
- Freeze is automatically used when:
  - Student has an active streak (> 0)
  - Student misses exactly 1 day
  - Freeze is available (not used this month)

**Example:**
```
Day 1: Attend (streak = 1)
Day 2: Attend (streak = 2)
Day 3: Miss (freeze used, streak = 3)
Day 4: Attend (streak = 4)
Day 5: Miss (no freeze, streak breaks → 0)
Day 6: Attend (streak = 1)
```

## Database Schema

### Streaks Table

```sql
CREATE TABLE streaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_attendance_date DATE,
  streak_freeze_count INTEGER NOT NULL DEFAULT 1,
  last_freeze_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_streaks_student_id ON streaks(student_id);
CREATE INDEX idx_streaks_current_streak ON streaks(current_streak DESC);
```

### Fields

- `current_streak`: Current consecutive days of attendance
- `longest_streak`: Highest streak ever achieved
- `last_attendance_date`: Date of most recent attendance (for gap detection)
- `streak_freeze_count`: Number of freezes available (0 or 1)
- `last_freeze_used_at`: Timestamp of last freeze usage (for monthly reset)

## Usage

### Update Streaks

```typescript
import { updateStreaks } from '../_shared/services/streak-updater.ts';

const attendanceRecords = [
  {
    id: 'att-123',
    student_id: 'student-456',
    course_id: 'course-789',
    date: '2024-10-26',
    status: 'present',
    created_at: '2024-10-26T10:00:00Z',
  },
];

const results = await updateStreaks(supabase, attendanceRecords);

// Results:
// [
//   {
//     student_id: 'student-456',
//     previous_streak: 5,
//     current_streak: 6,
//     longest_streak: 6,
//     streak_broken: false,
//     freeze_used: false,
//     notifications_sent: [],
//     errors: []
//   }
// ]
```

### Reset Monthly Freezes

```typescript
import { resetMonthlyStreakFreezes } from '../_shared/services/streak-updater.ts';

// Run on 1st of each month via cron
const result = await resetMonthlyStreakFreezes(supabase);

console.log(`Reset freezes for ${result.updated} students`);
```

### Send At-Risk Notifications

```typescript
import { sendStreakAtRiskNotifications } from '../_shared/services/streak-updater.ts';

// Run every hour via cron
const result = await sendStreakAtRiskNotifications(supabase);

console.log(`Sent ${result.sent} at-risk notifications`);
```

## Notifications

### Streak At-Risk Notification

**Trigger:** 2 hours before next class if student hasn't attended today

**Conditions:**
- Student has active streak (current_streak > 0)
- Student has not attended any class today
- Student has a class starting within 2 hours

**Notification:**
```json
{
  "notification_type": "streak_risk",
  "title": "🔥 Your streak is at risk!",
  "message": "You have a 12-day streak. Don't forget to attend your class in 2 hours!",
  "data": {
    "streak": 12,
    "class_schedule_id": "schedule-123",
    "class_id": "class-456"
  }
}
```

### Streak Milestone Notifications

Future enhancement - notify on milestones:
- 7-day streak (1 week)
- 30-day streak (1 month)
- 100-day streak (legendary)

## Integration

### Gamification Engine

The streak updater is called by the gamification engine after attendance sync:

```typescript
// In gamification-job/index.ts
import { updateStreaks } from '../_shared/services/streak-updater.ts';

// Get new attendance records since last run
const { data: newAttendance } = await supabase
  .from('attendance')
  .select('*')
  .gte('created_at', lastRunTime);

// Update streaks
const results = await updateStreaks(supabase, newAttendance);
```

### Cron Jobs

**Streak Freeze Reset** (Monthly - 1st at 00:00):
```sql
SELECT cron.schedule(
  'reset-streak-freezes',
  '0 0 1 * *', -- 1st of month at midnight
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/reset-streak-freezes',
    headers := '{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb
  );
  $$
);
```

**At-Risk Notifications** (Hourly):
```sql
SELECT cron.schedule(
  'streak-at-risk-notifications',
  '0 * * * *', -- Every hour
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/streak-notifications',
    headers := '{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb
  );
  $$
);
```

## Testing

Run tests with:

```bash
deno test tagtapgo-backend/supabase/functions/_shared/services/__tests__/streak-updater.test.ts
```

Tests cover:
- First attendance starts streak
- Consecutive days increment streak
- Gap breaks streak
- Streak freeze usage
- Multiple classes same day
- Absent does not count
- Late and excused count

## Performance Considerations

### Batch Processing

- Process multiple students in parallel
- Group attendance by student for efficiency
- Update streaks in single database transaction per student

### Indexes

Ensure these indexes exist:
- `streaks(student_id)` - For lookups
- `streaks(current_streak DESC)` - For leaderboards
- `attendance(student_id, date)` - For gap detection

### Caching

Consider caching:
- Current streak for dashboard display
- Longest streak for profile display

## Edge Cases

### Same Day Multiple Attendance

If student attends multiple classes on the same day:
- Count as 1 day for streak purposes
- Use earliest attendance time for calculations

### Retroactive Attendance

If attendance is added retroactively:
- Recalculate streak from that date forward
- May restore broken streaks
- Update longest_streak if applicable

### Timezone Handling

- All dates stored in UTC
- Convert to student's timezone for display
- Use date boundaries in student's timezone for "day" calculations

### Weekend Handling

Current implementation:
- Weekends are treated as regular days
- If no classes scheduled on weekend, no impact on streak

Future enhancement:
- Only count weekdays (Mon-Fri)
- Exclude university holidays

## Future Enhancements

1. **Streak Milestones**: Achievements for 7, 30, 100-day streaks
2. **Streak Leaderboard**: Compete on longest current streak
3. **Streak Recovery**: Purchase additional freezes with points
4. **Streak Challenges**: Compete with friends on streaks
5. **Streak Insights**: Show streak trends and patterns
6. **Smart Notifications**: ML-based optimal notification timing

## Requirements Mapping

- **Requirement 2**: Points and Streaks Display
  - Current streak with fire icon
  - Streak at-risk warning
  - Streak freeze inventory
  - Longest streak tracking

## Related Documentation

- [Points Calculation](./POINTS_CALCULATION.md)
- [Gamification Engine](./GAMIFICATION_ENGINE.md) (to be created)
- [Database Schema](./DATABASE_SCHEMA.md)
- [Task 14 Summary](./TASK_14_SUMMARY.md) (to be created)
