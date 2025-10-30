# Developer Guide - TagTapGo Backend

## Overview

This guide provides essential information for developers working on the TagTapGo backend, including common patterns, best practices, and troubleshooting tips.

## Table of Contents

1. [Querying Student Class Schedules](#querying-student-class-schedules)
2. [Common Patterns](#common-patterns)
3. [Best Practices](#best-practices)
4. [Troubleshooting](#troubleshooting)

## Querying Student Class Schedules

### ⚠️ Critical Concept

The `class_schedules` table is a **course schedule template**, NOT individual student sessions.

**❌ WRONG**:
```typescript
// This will FAIL - class_schedules doesn't have student_id column
const { data } = await supabase
  .from('class_schedules')
  .select('*')
  .eq('student_id', studentId);
```

**✅ CORRECT**:
```typescript
// Use helper function that joins through enrollments
import { getStudentSchedulesForDate } from '../_shared/services/schedule-query-helpers.ts';

const schedules = await getStudentSchedulesForDate(
  supabase,
  studentId,
  new Date()
);
```

### Data Model Quick Reference

```
students → enrollments → courses → class_schedules
                                 ↓
                            attendance
```

- **enrollments**: Links students to courses
- **class_schedules**: Defines when courses meet (shared by all enrolled students)
- **attendance**: Records individual student presence

### Helper Functions

Always use the helper functions in `schedule-query-helpers.ts`:

#### Get Student's Classes on a Date
```typescript
import { getStudentSchedulesForDate } from '../_shared/services/schedule-query-helpers.ts';

const schedules = await getStudentSchedulesForDate(
  supabase,
  studentId,
  new Date('2024-10-30')
);

// Returns: Array of StudentSchedule objects
// {
//   schedule_id: string,
//   course_id: string,
//   course_code: string,
//   course_name: string,
//   day_of_week: string,
//   start_time: string,
//   end_time: string,
//   location: string | null
// }
```

#### Get Student's Upcoming Classes
```typescript
import { getStudentUpcomingClasses } from '../_shared/services/schedule-query-helpers.ts';

const now = new Date();
const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

const upcomingClasses = await getStudentUpcomingClasses(
  supabase,
  studentId,
  now,
  twoHoursLater
);

// Returns: Array of StudentUpcomingClass objects with calculated datetimes
```

#### Get Students for a Class Schedule
```typescript
import { getStudentsForClassSchedule } from '../_shared/services/schedule-query-helpers.ts';

const students = await getStudentsForClassSchedule(
  supabase,
  scheduleId
);

// Returns: Array of EnrolledStudent objects
// {
//   student_id: string,
//   enrollment_id: string,
//   course_id: string,
//   course_code: string,
//   course_name: string
// }
```

#### Get Course Details for a Schedule
```typescript
import { getCourseDetailsForSchedule } from '../_shared/services/schedule-query-helpers.ts';

const course = await getCourseDetailsForSchedule(
  supabase,
  scheduleId
);

// Returns: { course_id: string, code: string, name: string } | null
```

## Common Patterns

### Pattern 1: Send Notifications to Students Who Attended a Class

```typescript
// 1. Find class schedules that ended recently
const { data: schedules } = await supabase
  .from('class_schedules')
  .select('id, course_id, day_of_week')
  .gte('end_time', recentTimeStart)
  .lte('end_time', recentTimeEnd);

for (const schedule of schedules) {
  // 2. Get enrolled students
  const students = await getStudentsForClassSchedule(supabase, schedule.id);
  
  // 3. Batch check attendance (efficient!)
  const studentIds = students.map(s => s.student_id);
  const { data: attendance } = await supabase
    .from('attendance')
    .select('student_id')
    .eq('course_id', schedule.course_id)
    .eq('date', today)
    .in('status', ['present', 'late', 'excused'])
    .in('student_id', studentIds);
  
  // 4. Create Set for O(1) lookup
  const attendedIds = new Set(attendance.map(a => a.student_id));
  
  // 5. Process students who attended
  for (const student of students) {
    if (attendedIds.has(student.student_id)) {
      // Send notification...
    }
  }
}
```

### Pattern 2: Find Students with Upcoming Classes

```typescript
// 1. Get students who need notifications (e.g., streak at risk)
const { data: students } = await supabase
  .from('streaks')
  .select('student_id, current_streak')
  .gt('current_streak', 0);

// 2. For each student, check for upcoming classes
for (const student of students) {
  const upcomingClasses = await getStudentUpcomingClasses(
    supabase,
    student.student_id,
    now,
    twoHoursFromNow
  );
  
  if (upcomingClasses.length > 0) {
    const nextClass = upcomingClasses[0];
    // Send notification with nextClass.course_code, nextClass.start_datetime...
  }
}
```

### Pattern 3: Batch Processing for Performance

```typescript
// ❌ SLOW - N+1 query problem
for (const student of students) {
  const { data } = await supabase
    .from('attendance')
    .select('*')
    .eq('student_id', student.id);
}

// ✅ FAST - Single batch query
const studentIds = students.map(s => s.id);
const { data } = await supabase
  .from('attendance')
  .select('*')
  .in('student_id', studentIds);

// Then process in memory
const attendanceByStudent = new Map();
for (const record of data) {
  if (!attendanceByStudent.has(record.student_id)) {
    attendanceByStudent.set(record.student_id, []);
  }
  attendanceByStudent.get(record.student_id).push(record);
}
```

## Best Practices

### 1. Always Filter Active Enrollments

```typescript
// ✅ CORRECT - Only active enrollments
const { data } = await supabase
  .from('enrollments')
  .select('*')
  .eq('student_id', studentId)
  .eq('status', 'active');  // Important!
```

### 2. Check Effective Date Ranges

```typescript
// ✅ CORRECT - Filter by effective dates
const { data } = await supabase
  .from('class_schedules')
  .select('*')
  .eq('course_id', courseId)
  .lte('effective_from', today)
  .gte('effective_to', today);
```

### 3. Use Batch Queries

```typescript
// ✅ CORRECT - Batch query with IN clause
const { data } = await supabase
  .from('attendance')
  .select('*')
  .in('student_id', studentIds)  // Batch!
  .eq('date', today);
```

### 4. Handle Errors Gracefully

```typescript
try {
  const schedules = await getStudentSchedulesForDate(supabase, studentId, date);
  
  if (schedules.length === 0) {
    console.log(`No schedules found for student ${studentId}`);
    return;
  }
  
  // Process schedules...
} catch (error) {
  console.error(`Error fetching schedules:`, error);
  // Don't throw - log and continue with other students
}
```

### 5. Log with Context

```typescript
// ✅ GOOD - Includes context
console.log(`[Job Name] Processing ${students.length} students`);
console.log(`[Job Name] Created ${promptsCreated} prompts for schedule ${scheduleId}`);

// ❌ BAD - No context
console.log('Processing students');
console.log('Created prompts');
```

## Troubleshooting

### Issue: "Column 'student_id' does not exist in class_schedules"

**Cause**: Trying to query `class_schedules` with `student_id` column.

**Solution**: Use helper functions that join through `enrollments`:
```typescript
// Instead of querying class_schedules directly:
const students = await getStudentsForClassSchedule(supabase, scheduleId);
```

### Issue: "No students found for class schedule"

**Possible causes**:
1. No active enrollments for the course
2. Schedule's `effective_from`/`effective_to` dates don't include today
3. Course has no enrollments

**Debug**:
```typescript
// Check if schedule exists
const { data: schedule } = await supabase
  .from('class_schedules')
  .select('*, courses(*)')
  .eq('id', scheduleId)
  .single();

console.log('Schedule:', schedule);

// Check enrollments
const { data: enrollments } = await supabase
  .from('enrollments')
  .select('*')
  .eq('course_id', schedule.course_id)
  .eq('status', 'active');

console.log('Active enrollments:', enrollments.length);
```

### Issue: "Query is slow with many students"

**Cause**: N+1 query problem or missing indexes.

**Solutions**:
1. Use batch queries with `IN` clause
2. Ensure indexes exist (see migration `20251030000006_add_schedule_query_indexes.sql`)
3. Limit result sets with `LIMIT`
4. Select only needed columns

```typescript
// ✅ Optimized query
const { data } = await supabase
  .from('attendance')
  .select('student_id, status')  // Only needed columns
  .in('student_id', studentIds)  // Batch query
  .eq('date', today)
  .limit(1000);  // Reasonable limit
```

### Issue: "Wrong day of week returned"

**Cause**: Timezone issues or incorrect day name matching.

**Solution**: Use helper functions that handle day-of-week conversion:
```typescript
// Helper handles day name conversion correctly
const schedules = await getStudentSchedulesForDate(supabase, studentId, date);
```

### Issue: "Duplicate notifications sent"

**Cause**: Job runs multiple times or no idempotency check.

**Solution**: Check for existing records before creating:
```typescript
// Check if notification already exists
const { data: existing } = await supabase
  .from('notifications')
  .select('id')
  .eq('student_id', studentId)
  .eq('notification_type', 'streak')
  .eq('created_at', today)
  .maybeSingle();

if (existing) {
  console.log('Notification already sent');
  continue;
}

// Create notification...
```

## Testing

### Unit Testing Helper Functions

```typescript
import { assertEquals } from 'https://deno.land/std/testing/asserts.ts';
import { getStudentSchedulesForDate } from './schedule-query-helpers.ts';

Deno.test('getStudentSchedulesForDate returns schedules for enrolled courses', async () => {
  // Setup test data...
  
  const schedules = await getStudentSchedulesForDate(
    supabase,
    testStudentId,
    new Date('2024-10-30')
  );
  
  assertEquals(schedules.length, 3);
  assertEquals(schedules[0].course_code, 'CS101');
});
```

### Integration Testing Jobs

```typescript
Deno.test('feedback-prompt-job creates prompts for attended students', async () => {
  // Setup: Create student, enrollment, attendance
  
  // Run job
  const response = await fetch('http://localhost:54321/functions/v1/feedback-prompt-job');
  const result = await response.json();
  
  // Verify prompts created
  assertEquals(result.promptsCreated, 1);
});
```

## Performance Guidelines

### Expected Performance

- **Individual schedule query**: < 100ms
- **Batch query (100 students)**: < 500ms
- **Feedback prompt job (1000 students)**: < 30 seconds
- **Streak notification job (1000 students)**: < 60 seconds

### Optimization Checklist

- [ ] Use helper functions (they're optimized)
- [ ] Batch queries with `IN` clause
- [ ] Filter by `status = 'active'` on enrollments
- [ ] Check effective date ranges on schedules
- [ ] Select only needed columns
- [ ] Use `LIMIT` for large result sets
- [ ] Add appropriate indexes
- [ ] Log execution times for monitoring

## Additional Resources

- [Schema Guide](./SCHEMA_GUIDE.md) - Detailed data model documentation
- [schedule-query-helpers.ts](../supabase/functions/_shared/services/schedule-query-helpers.ts) - Helper function source code
- [Supabase Documentation](https://supabase.com/docs) - Official Supabase docs
- [PostgreSQL JOIN Tutorial](https://www.postgresql.org/docs/current/tutorial-join.html) - Understanding joins

## Getting Help

If you encounter issues:

1. Check this guide and the Schema Guide
2. Review helper function implementations
3. Check Supabase logs for error messages
4. Ask in team chat with:
   - What you're trying to do
   - Code snippet
   - Error message
   - What you've tried

## Contributing

When adding new schedule-related features:

1. Use existing helper functions when possible
2. Add new helpers to `schedule-query-helpers.ts` if needed
3. Document query patterns in this guide
4. Add tests for new functionality
5. Update Schema Guide if data model changes
