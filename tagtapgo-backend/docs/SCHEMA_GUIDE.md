# Database Schema Guide - Class Schedules and Student Enrollment

## Overview

This guide explains the data model for class schedules, student enrollments, and attendance tracking in TagTapGo. Understanding these relationships is critical for correctly querying student class information.

## Key Concept: Class Schedules are Course Templates

**IMPORTANT**: The `class_schedules` table is a **course schedule template**, NOT individual student sessions.

- ❌ **WRONG**: "class_schedules contains each student's individual class schedule"
- ✅ **CORRECT**: "class_schedules defines when a course meets (e.g., 'CS101 meets Mon/Wed/Fri 9-10am')"

Students are linked to courses via the `enrollments` table, and attendance records track individual student presence.

## Table Relationships

```
┌─────────────┐
│  students   │  (Individual students)
└──────┬──────┘
       │
       │ enrolled_in
       ▼
┌─────────────┐      ┌──────────────┐
│ enrollments │─────▶│   courses    │  (Course offerings)
└──────┬──────┘      └──────┬───────┘
       │                    │
       │                    │ has_schedule
       │                    ▼
       │             ┌──────────────────┐
       │             │ class_schedules  │  (Course meeting times)
       │             │ - day_of_week    │
       │             │ - start_time     │
       │             │ - end_time       │
       │             │ - effective_from │
       │             │ - effective_to   │
       │             └──────────────────┘
       │
       │ records_attendance
       ▼
┌─────────────┐
│ attendance  │  (Student presence records)
│ - date      │
│ - status    │
│ - course_id │
└─────────────┘
```

## Table Definitions

### students
Individual students in the system.

**Key Columns**:
- `id` (UUID): Primary key
- `name` (TEXT): Student name
- `email` (TEXT): Student email

### enrollments
Links students to courses they are registered for.

**Key Columns**:
- `id` (UUID): Primary key
- `student_id` (UUID): FK → students
- `course_id` (UUID): FK → courses
- `status` (TEXT): 'active', 'dropped', 'completed'
- `enrolled_at` (TIMESTAMPTZ): When student enrolled

**Purpose**: Represents "Student X is enrolled in Course Y"

### courses
Course offerings (e.g., "CS101 - Introduction to Programming").

**Key Columns**:
- `id` (UUID): Primary key
- `code` (TEXT): Course code (e.g., "CS101")
- `name` (TEXT): Course name
- `credits` (INTEGER): Credit hours

### class_schedules
**Course schedule templates** defining when a course meets.

**Key Columns**:
- `id` (UUID): Primary key
- `course_id` (UUID): FK → courses
- `day_of_week` (TEXT): 'Monday', 'Tuesday', etc.
- `start_time` (TIME): Class start time (e.g., '09:00:00')
- `end_time` (TIME): Class end time (e.g., '10:30:00')
- `location` (TEXT): Room/building
- `effective_from` (DATE): Start date of schedule
- `effective_to` (DATE): End date of schedule

**Purpose**: Represents "Course X meets on Day Y from Time A to Time B"

**IMPORTANT**: This table does NOT have a `student_id` column. All students enrolled in the course follow the same schedule.

### attendance
Records of student presence/absence for specific class sessions.

**Key Columns**:
- `id` (UUID): Primary key
- `student_id` (UUID): FK → students
- `course_id` (UUID): FK → courses
- `date` (DATE): Date of class session
- `status` (TEXT): 'present', 'late', 'excused', 'absent'
- `check_in_time` (TIMESTAMPTZ): When student checked in

**Purpose**: Represents "Student X attended/missed Course Y on Date Z"

## Common Query Patterns

### Pattern 1: Find a Student's Classes on a Specific Date

**Goal**: Get all classes a student has on a given date.

**Query Path**: students → enrollments → courses → class_schedules

```sql
-- Find student's classes on Monday, Oct 30, 2024
SELECT 
  cs.id as schedule_id,
  c.code as course_code,
  c.name as course_name,
  cs.start_time,
  cs.end_time,
  cs.location
FROM enrollments e
JOIN courses c ON c.id = e.course_id
JOIN class_schedules cs ON cs.course_id = e.course_id
WHERE e.student_id = 'student-uuid'
  AND e.status = 'active'
  AND cs.day_of_week = 'Monday'
  AND cs.effective_from <= '2024-10-30'
  AND cs.effective_to >= '2024-10-30'
ORDER BY cs.start_time;
```

**TypeScript Helper**:
```typescript
import { getStudentSchedulesForDate } from './schedule-query-helpers.ts';

const schedules = await getStudentSchedulesForDate(
  supabase,
  studentId,
  new Date('2024-10-30')
);
```

### Pattern 2: Find All Students in a Class Schedule

**Goal**: Get all students enrolled in a specific class schedule.

**Query Path**: class_schedules → courses → enrollments → students

```sql
-- Find all students enrolled in a class schedule
SELECT 
  e.student_id,
  s.name as student_name,
  c.code as course_code
FROM class_schedules cs
JOIN courses c ON c.id = cs.course_id
JOIN enrollments e ON e.course_id = cs.course_id
JOIN students s ON s.id = e.student_id
WHERE cs.id = 'schedule-uuid'
  AND e.status = 'active';
```

**TypeScript Helper**:
```typescript
import { getStudentsForClassSchedule } from './schedule-query-helpers.ts';

const students = await getStudentsForClassSchedule(
  supabase,
  scheduleId
);
```

### Pattern 3: Check Which Students Attended a Class

**Goal**: Find which enrolled students attended a specific class session.

**Query Path**: class_schedules → enrollments → attendance

```sql
-- Find students who attended CS101 on Oct 30, 2024
SELECT 
  e.student_id,
  a.status,
  a.check_in_time
FROM class_schedules cs
JOIN enrollments e ON e.course_id = cs.course_id
LEFT JOIN attendance a ON a.student_id = e.student_id 
  AND a.course_id = cs.course_id
  AND a.date = '2024-10-30'
WHERE cs.id = 'schedule-uuid'
  AND e.status = 'active';
```

**TypeScript Example**:
```typescript
// Get enrolled students
const students = await getStudentsForClassSchedule(supabase, scheduleId);
const studentIds = students.map(s => s.student_id);

// Batch query attendance
const { data: attendance } = await supabase
  .from('attendance')
  .select('student_id, status')
  .eq('course_id', courseId)
  .eq('date', '2024-10-30')
  .in('student_id', studentIds);
```

### Pattern 4: Find a Student's Upcoming Classes

**Goal**: Get classes starting within a time window (e.g., next 2 hours).

**Query Path**: students → enrollments → courses → class_schedules (filtered by time)

```typescript
import { getStudentUpcomingClasses } from './schedule-query-helpers.ts';

const now = new Date();
const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

const upcomingClasses = await getStudentUpcomingClasses(
  supabase,
  studentId,
  now,
  twoHoursLater
);
```

## Common Mistakes to Avoid

### ❌ Mistake 1: Querying class_schedules with student_id

```typescript
// WRONG - class_schedules doesn't have student_id column
const { data } = await supabase
  .from('class_schedules')
  .select('*')
  .eq('student_id', studentId);  // ❌ This column doesn't exist!
```

**Why it's wrong**: `class_schedules` is a course template, not student-specific.

**Correct approach**: Join through enrollments first.

### ❌ Mistake 2: Assuming one schedule per student

```typescript
// WRONG - assumes each student has their own schedule
const { data } = await supabase
  .from('class_schedules')
  .select('*')
  .eq('id', scheduleId)
  .single();

// Then trying to get "the student" for this schedule
// ❌ There are MANY students for one schedule!
```

**Why it's wrong**: Multiple students share the same class schedule.

**Correct approach**: Query enrollments to find all students in the course.

### ❌ Mistake 3: Not filtering by effective dates

```typescript
// WRONG - returns schedules that may no longer be active
const { data } = await supabase
  .from('class_schedules')
  .select('*')
  .eq('course_id', courseId)
  .eq('day_of_week', 'Monday');
```

**Why it's wrong**: Schedules have effective date ranges (e.g., Fall 2024 vs Spring 2025).

**Correct approach**: Filter by `effective_from` and `effective_to`.

### ❌ Mistake 4: Individual queries in a loop

```typescript
// WRONG - N+1 query problem
for (const student of students) {
  const { data } = await supabase
    .from('attendance')
    .select('*')
    .eq('student_id', student.id)
    .eq('date', today);
}
```

**Why it's wrong**: Makes one database query per student (slow for many students).

**Correct approach**: Batch query with `IN` clause.

```typescript
// CORRECT - single query for all students
const studentIds = students.map(s => s.id);
const { data } = await supabase
  .from('attendance')
  .select('*')
  .in('student_id', studentIds)
  .eq('date', today);
```

## Helper Functions

The `schedule-query-helpers.ts` service provides reusable functions that implement these patterns correctly:

- `getStudentSchedulesForDate()` - Get student's classes on a date
- `getStudentUpcomingClasses()` - Get classes starting soon
- `getStudentsForClassSchedule()` - Get enrolled students for a schedule
- `getCourseDetailsForSchedule()` - Get course info for a schedule

**Always use these helpers** instead of writing raw queries to avoid common mistakes.

## Performance Considerations

### Indexes

The following indexes optimize schedule queries:

- `idx_enrollments_student_course_status` - Student enrollment lookups
- `idx_enrollments_course_status` - Course enrollment lookups
- `idx_class_schedules_course_day` - Schedule lookups by course and day
- `idx_attendance_course_date_status` - Batch attendance queries

### Query Optimization Tips

1. **Use batch queries**: Query multiple students at once with `IN` clause
2. **Filter early**: Apply `status = 'active'` on enrollments
3. **Limit results**: Use `LIMIT` when you only need a few results
4. **Select specific columns**: Don't use `SELECT *` if you only need a few fields

## Migration Guidance

### Why NOT to Add student_id to class_schedules

You might be tempted to add a `student_id` column to `class_schedules` to simplify queries. **Don't do this!**

**Reasons**:
1. **Data duplication**: Would create one schedule row per student (wasteful)
2. **Maintenance burden**: Schedule changes would require updating many rows
3. **Inconsistency risk**: Students could have different schedules for the same course
4. **Violates normalization**: Breaks database normal forms

**Correct approach**: Keep the current structure and use proper joins through `enrollments`.

## Examples from Real Code

### Feedback Prompt Job

**Goal**: Send feedback prompts to students who attended a class that just ended.

```typescript
// 1. Find class schedules that ended 15-20 minutes ago
const { data: schedules } = await supabase
  .from('class_schedules')
  .select('id, course_id, day_of_week')
  .gte('end_time', '14:45:00')
  .lte('end_time', '14:50:00');

// 2. For each schedule, find enrolled students
for (const schedule of schedules) {
  const students = await getStudentsForClassSchedule(supabase, schedule.id);
  
  // 3. Batch check attendance
  const { data: attendance } = await supabase
    .from('attendance')
    .select('student_id')
    .eq('course_id', schedule.course_id)
    .eq('date', today)
    .in('student_id', students.map(s => s.student_id));
  
  // 4. Create prompts for students who attended
  // ...
}
```

### Streak At-Risk Notification

**Goal**: Notify students with active streaks about upcoming classes.

```typescript
// 1. Find students with active streaks who haven't attended today
const { data: atRiskStudents } = await supabase
  .from('streaks')
  .select('student_id, current_streak')
  .gt('current_streak', 0)
  .neq('last_attendance_date', today);

// 2. For each student, find upcoming classes
for (const student of atRiskStudents) {
  const upcomingClasses = await getStudentUpcomingClasses(
    supabase,
    student.student_id,
    now,
    twoHoursFromNow
  );
  
  if (upcomingClasses.length > 0) {
    // Send notification about first upcoming class
    // ...
  }
}
```

## Summary

- `class_schedules` = course template (when/where course meets)
- `enrollments` = student-to-course mapping
- `attendance` = student presence records
- Always join through `enrollments` to find student schedules
- Use helper functions to avoid common mistakes
- Batch queries for performance

## Further Reading

- [schedule-query-helpers.ts](../supabase/functions/_shared/services/schedule-query-helpers.ts) - Helper function implementations
- [feedback-prompt-job](../supabase/functions/feedback-prompt-job/index.ts) - Real-world usage example
- [PostgreSQL JOIN documentation](https://www.postgresql.org/docs/current/tutorial-join.html)
