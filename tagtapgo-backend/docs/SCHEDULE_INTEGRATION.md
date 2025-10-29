## Schedule Data Integration Guide

This guide explains how to use schedule data for time-based features in the TagTapGo gamification system.

## Overview

Schedule data from SIS/LMS systems enables three key time-based features:

1. **Feedback Prompts** - Trigger 15 minutes after class ends
2. **Streak Warnings** - Alert 2 hours before next class if no attendance
3. **Dashboard Countdown** - Show time until next class

---

## Data Flow

```
SIS/LMS System
    ↓
Adapter (Moodle/openSIS/Generic)
    ↓
Canonical Schema (class_schedules)
    ↓
Schedule Helpers
    ↓
Time-Based Features
```

---

## Schedule Helpers API

### 1. Get Next Class

Returns the soonest upcoming class for a student.

```typescript
import { getNextClass } from '../_shared/utils/schedule-helpers.ts';

const nextClass = getNextClass(schedules, 'Europe/Dublin');

if (nextClass) {
  console.log(`Next class: ${nextClass.courseName}`);
  console.log(`Starts in: ${nextClass.minutesUntilStart} minutes`);
  console.log(`Location: ${nextClass.location}`);
}
```

**Response:**
```typescript
{
  courseId: 123,
  courseName: "CS101",
  dayOfWeek: "Monday",
  period: "Morning",
  startTime: "09:00:00",
  endTime: "10:30:00",
  location: "Room 201",
  startsAt: Date,           // Absolute datetime
  endsAt: Date,             // Absolute datetime
  minutesUntilStart: 45,
  isToday: true
}
```

### 2. Get Today's Classes

Returns all classes scheduled for today.

```typescript
import { getTodayClasses } from '../_shared/utils/schedule-helpers.ts';

const todayClasses = getTodayClasses(schedules, 'Europe/Dublin');

console.log(`You have ${todayClasses.length} classes today`);

todayClasses.forEach(cls => {
  if (cls.isActive) {
    console.log(`Currently in class: ${cls.courseId}`);
  } else if (cls.hasEnded) {
    console.log(`Completed: ${cls.courseId}`);
  } else {
    console.log(`Upcoming: ${cls.courseId} at ${cls.startTime}`);
  }
});
```

### 3. Check if Class is Active

Check if a specific class is currently in session.

```typescript
import { isClassActive } from '../_shared/utils/schedule-helpers.ts';

const active = isClassActive(schedules, sessionId, 'Europe/Dublin');

if (active) {
  console.log('Class is currently in session');
  // Show "Tap for Class" button
}
```

### 4. Check Streak at Risk

Determine if a student's streak is at risk.

```typescript
import { isStreakAtRisk } from '../_shared/utils/schedule-helpers.ts';

const atRisk = isStreakAtRisk(
  schedules,
  lastAttendanceDate,
  'Europe/Dublin'
);

if (atRisk) {
  console.log('⚠️ Streak at risk! Next class in < 2 hours');
  // Send push notification
}
```

### 5. Calculate Feedback Prompt Time

Calculate when to send feedback prompt (15 min after class).

```typescript
import { 
  getClassEndTime,
  minutesUntilFeedbackPrompt 
} from '../_shared/utils/schedule-helpers.ts';

const endTime = getClassEndTime(schedules, sessionId, 'Europe/Dublin');

if (endTime) {
  const minutesUntil = minutesUntilFeedbackPrompt(endTime);
  console.log(`Send feedback prompt in ${minutesUntil} minutes`);
}
```

### 6. Format Time Display

Format time until next class for user-friendly display.

```typescript
import { formatTimeUntilClass } from '../_shared/utils/schedule-helpers.ts';

const formatted = formatTimeUntilClass(45);
// Returns: "45 minutes"

const formatted2 = formatTimeUntilClass(125);
// Returns: "2h 5m"
```

---

## Use Case 1: Feedback Prompts

**Goal:** Send feedback prompt 15 minutes after class ends.

**Implementation:**

```typescript
// In feedback-prompt-job Edge Function

import { createClient } from '@supabase/supabase-js';
import { getClassEndTime, minutesUntilFeedbackPrompt } from '../_shared/utils/schedule-helpers.ts';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get classes that ended 15 minutes ago
const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

const { data: schedules } = await supabase
  .from('class_schedules')
  .select('*')
  .lte('end_time', fifteenMinutesAgo.toISOString());

for (const schedule of schedules) {
  // Get students who attended this class
  const { data: attendance } = await supabase
    .from('attendance')
    .select('student_id')
    .eq('session_id', schedule.id)
    .eq('status', 'present');
  
  for (const record of attendance) {
    // Check if feedback prompt already sent
    const { data: existing } = await supabase
      .from('feedback_prompts')
      .select('id')
      .eq('student_id', record.student_id)
      .eq('class_schedule_id', schedule.id)
      .single();
    
    if (!existing) {
      // Create feedback prompt
      await supabase
        .from('feedback_prompts')
        .insert({
          student_id: record.student_id,
          class_schedule_id: schedule.id,
          prompt_sent_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending'
        });
      
      // Send push notification
      await sendPushNotification(record.student_id, {
        title: 'How was class?',
        body: 'Share your feedback and earn bonus points!',
        data: {
          type: 'feedback_prompt',
          scheduleId: schedule.id
        }
      });
    }
  }
}
```

---

## Use Case 2: Streak Warnings

**Goal:** Alert students 2 hours before next class if they haven't attended today.

**Implementation:**

```typescript
// In streak-warning-job Edge Function

import { createClient } from '@supabase/supabase-js';
import { getNextClass, isStreakAtRisk } from '../_shared/utils/schedule-helpers.ts';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get all active students
const { data: students } = await supabase
  .from('students')
  .select('id, university_id')
  .eq('status', 'active');

for (const student of students) {
  // Get student's schedules
  const { data: schedules } = await supabase
    .from('class_schedules')
    .select('*')
    .eq('university_id', student.university_id);
  
  // Get last attendance
  const { data: lastAttendance } = await supabase
    .from('attendance')
    .select('recorded_at')
    .eq('student_id', student.id)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .single();
  
  const lastAttendanceDate = lastAttendance 
    ? new Date(lastAttendance.recorded_at)
    : new Date(0); // Never attended
  
  // Check if streak is at risk
  if (isStreakAtRisk(schedules, lastAttendanceDate, 'Europe/Dublin')) {
    const nextClass = getNextClass(schedules, 'Europe/Dublin');
    
    // Send warning notification
    await sendPushNotification(student.id, {
      title: '🔥 Streak at Risk!',
      body: `Your next class starts in ${nextClass.minutesUntilStart} minutes. Don't break your streak!`,
      data: {
        type: 'streak_warning',
        nextClassId: nextClass.courseId
      }
    });
  }
}
```

---

## Use Case 3: Dashboard Countdown

**Goal:** Show time until next class on dashboard.

**Implementation:**

```typescript
// In dashboard API endpoint

import { createClient } from '@supabase/supabase-js';
import { getNextClass, formatTimeUntilClass } from '../_shared/utils/schedule-helpers.ts';

export async function getDashboardData(studentId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Get student's university
  const { data: student } = await supabase
    .from('students')
    .select('university_id')
    .eq('id', studentId)
    .single();
  
  // Get student's schedules
  const { data: schedules } = await supabase
    .from('class_schedules')
    .select('*, courses(name)')
    .eq('university_id', student.university_id);
  
  // Get next class
  const nextClass = getNextClass(schedules, 'Europe/Dublin');
  
  return {
    nextClass: nextClass ? {
      courseName: nextClass.courseName,
      startsIn: formatTimeUntilClass(nextClass.minutesUntilStart),
      location: nextClass.location,
      isToday: nextClass.isToday
    } : null
  };
}
```

**Frontend Display:**

```tsx
// In Dashboard component

{nextClass && (
  <div className="next-class-card">
    <h3>Next Class</h3>
    <p className="course-name">{nextClass.courseName}</p>
    <p className="countdown">{nextClass.startsIn}</p>
    <p className="location">{nextClass.location}</p>
  </div>
)}
```

---

## Timezone Handling

All schedule helpers accept a timezone parameter:

```typescript
// Dublin timezone
const nextClass = getNextClass(schedules, 'Europe/Dublin');

// New York timezone
const nextClass = getNextClass(schedules, 'America/New_York');

// UTC (default)
const nextClass = getNextClass(schedules, 'UTC');
```

**Best Practice:** Store timezone in university configuration:

```sql
SELECT timezone FROM universities WHERE id = 'uni-123';
-- Returns: 'Europe/Dublin'
```

---

## Testing

### Test Next Class Calculation

```typescript
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { getNextClass } from './schedule-helpers.ts';

Deno.test('getNextClass - returns soonest upcoming class', () => {
  const schedules = [
    {
      id: '123-Monday-Morning',
      courseId: 123,
      dayOfWeek: 'Monday',
      startTime: '09:00:00',
      endTime: '10:30:00',
      effectiveFrom: '2025-09-01',
      effectiveTo: '2025-12-15',
    },
    {
      id: '124-Monday-Afternoon',
      courseId: 124,
      dayOfWeek: 'Monday',
      startTime: '14:00:00',
      endTime: '15:30:00',
      effectiveFrom: '2025-09-01',
      effectiveTo: '2025-12-15',
    }
  ];
  
  const nextClass = getNextClass(schedules, 'UTC');
  
  assertEquals(nextClass?.courseId, 123); // Morning class is next
  assertEquals(nextClass?.startTime, '09:00:00');
});
```

### Test Streak at Risk

```typescript
Deno.test('isStreakAtRisk - returns true when class is soon and no attendance', () => {
  const schedules = [/* ... */];
  const lastAttendance = new Date('2025-10-24T10:00:00Z'); // Yesterday
  
  const atRisk = isStreakAtRisk(schedules, lastAttendance, 'UTC');
  
  assertEquals(atRisk, true);
});
```

---

## Performance Considerations

### Caching

Cache schedule data to reduce database queries:

```typescript
// Cache schedules for 1 hour
const cacheKey = `schedules:${universityId}`;
let schedules = await redis.get(cacheKey);

if (!schedules) {
  schedules = await supabase
    .from('class_schedules')
    .select('*')
    .eq('university_id', universityId);
  
  await redis.set(cacheKey, schedules, { ex: 3600 });
}
```

### Indexing

Ensure proper database indexes:

```sql
CREATE INDEX idx_class_schedules_university_id ON class_schedules(university_id);
CREATE INDEX idx_class_schedules_course_id ON class_schedules(course_id);
CREATE INDEX idx_class_schedules_day_of_week ON class_schedules(day_of_week);
CREATE INDEX idx_class_schedules_effective_dates ON class_schedules(effective_from, effective_to);
```

---

## Troubleshooting

### Issue: Next class not found

**Cause:** Schedule data not synced or expired.

**Solution:**
1. Check if schedules exist: `SELECT * FROM class_schedules WHERE university_id = 'xxx';`
2. Check effective dates: `WHERE effective_from <= NOW() AND effective_to >= NOW()`
3. Trigger manual sync: `SELECT trigger_attendance_sync();`

### Issue: Incorrect timezone

**Cause:** Timezone not set correctly in university config.

**Solution:**
```sql
UPDATE universities 
SET timezone = 'Europe/Dublin' 
WHERE id = 'uni-123';
```

### Issue: Feedback prompts not sending

**Cause:** Class end time calculation incorrect.

**Solution:**
1. Check schedule data: `SELECT * FROM class_schedules WHERE id = 'xxx';`
2. Verify end_time format: Should be 'HH:MM:SS'
3. Check feedback-prompt-job logs

---

## References

- Schedule Helpers: `_shared/utils/schedule-helpers.ts`
- Canonical Schema: `_shared/types/canonical-schema.ts`
- Feedback Prompt Job: `functions/feedback-prompt-job/index.ts`
- Streak Warning Job: (To be implemented in Task 14)
