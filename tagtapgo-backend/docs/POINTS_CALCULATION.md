# Points Calculation Service

## Overview

The Points Calculation Service is responsible for calculating and awarding points to students based on their attendance records. It implements an idempotent transaction ledger pattern to ensure points are never awarded twice for the same attendance record.

## Point Rules

### Base Points
- **10 points** per attendance (present, late, or excused)
- **0 points** for absent

### Bonuses

#### Early Arrival Bonus
- **+5 points** if student checks in 5+ minutes before scheduled time
- Requires both `check_in_time` and `scheduled_time` to be present

#### Perfect Week Bonus
- **+50 points** for attending 5 out of 5 days (Monday-Friday)
- Awarded once per week
- Only awarded on or after Friday
- Counts unique days (multiple classes per day = 1 day)

#### Perfect Month Bonus
- **+200 points** for attending 20 out of 20 days in a month
- Awarded once per month
- Only awarded on or after the 20th day of the month
- Counts unique days (multiple classes per day = 1 day)

## Architecture

### Idempotency

The service uses a transaction ledger pattern with `reference_id` to ensure idempotency:

1. Each attendance record has a unique ID
2. Before awarding points, check if points already exist with that `reference_id`
3. If points exist, skip awarding (idempotent)
4. If not, insert new point transactions

### Transaction Types

Points are recorded in the `points` table with the following transaction types:

- `attendance` - Base attendance points
- `early_arrival` - Early arrival bonus
- `perfect_week` - Perfect week bonus
- `perfect_month` - Perfect month bonus
- `adjustment` - Manual adjustment (compensating entry)

### Compensating Entries

If attendance is corrected or points need to be adjusted:

1. Original points remain in the ledger (audit trail)
2. Create a compensating entry with `transaction_type: 'adjustment'`
3. Compensating entry can be positive or negative
4. Total points = sum of all transactions

## Usage

### Calculate and Award Points

```typescript
import { calculateAndAwardPoints } from '../_shared/services/points-calculator.ts';

const attendanceRecords = [
  {
    id: 'att-123',
    student_id: 'student-456',
    course_id: 'course-789',
    date: '2024-10-26',
    status: 'present',
    check_in_time: '2024-10-26T09:55:00Z',
    scheduled_time: '2024-10-26T10:00:00Z',
    created_at: '2024-10-26T09:55:00Z',
  },
];

const results = await calculateAndAwardPoints(supabase, attendanceRecords);

// Results:
// [
//   {
//     student_id: 'student-456',
//     total_points_awarded: 15, // 10 base + 5 early
//     transactions: [
//       {
//         transaction_type: 'attendance',
//         points: 10,
//         description: 'Attendance for 2024-10-26',
//         reference_id: 'att-123',
//         metadata: { course_id: 'course-789', date: '2024-10-26', status: 'present' }
//       },
//       {
//         transaction_type: 'early_arrival',
//         points: 5,
//         description: 'Early arrival (5 min early)',
//         reference_id: 'att-123',
//         metadata: { course_id: 'course-789', date: '2024-10-26', minutes_early: 5 }
//       }
//     ],
//     errors: []
//   }
// ]
```

### Create Compensating Entry

```typescript
import { createCompensatingEntry } from '../_shared/services/points-calculator.ts';

// Deduct 10 points due to attendance correction
await createCompensatingEntry(
  supabase,
  'student-456',
  'att-123',
  -10,
  'Attendance marked as absent after review'
);
```

## Database Schema

### Points Table

```sql
CREATE TABLE points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'attendance', 'achievement', 'bonus', 'early_arrival', 
    'perfect_week', 'perfect_month', 'streak', 'challenge', 
    'referral', 'redemption', 'adjustment', 'feedback'
  )),
  reference_id TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_points_student_id ON points(student_id);
CREATE INDEX idx_points_reference_id ON points(reference_id);
CREATE INDEX idx_points_transaction_type ON points(transaction_type);
```

### Student Points Balance View

```sql
CREATE VIEW student_points_balance AS
SELECT 
  student_id,
  SUM(points) AS total_points
FROM points
GROUP BY student_id;
```

## Testing

Run tests with:

```bash
deno test tagtapgo-backend/supabase/functions/_shared/services/__tests__/points-calculator.test.ts
```

Tests cover:
- Base attendance points
- Early arrival bonus
- Perfect week bonus (requires mock data)
- Perfect month bonus (requires mock data)
- Idempotency
- Multiple students
- Absent status (no points)

## Error Handling

The service handles errors gracefully:

1. **Database errors**: Logged and returned in `errors` array
2. **Duplicate points**: Detected via `reference_id` check (idempotency)
3. **Invalid data**: Skipped with error logged
4. **Per-student isolation**: One student's error doesn't affect others

## Performance Considerations

### Batch Processing

The service processes multiple attendance records in a single call:

1. Group records by student
2. Process each student independently
3. Award all points for a student in a single database transaction

### Indexes

Ensure these indexes exist for optimal performance:

- `points(student_id)` - For balance calculations
- `points(reference_id)` - For idempotency checks
- `points(transaction_type)` - For filtering by type
- `attendance(student_id, date)` - For perfect week/month checks

### Caching

Consider caching:
- Perfect week/month bonus checks (expensive queries)
- Student points balance (use materialized view)

## Integration

### Gamification Engine

The points calculator is called by the gamification engine after attendance sync:

```typescript
// In gamification-job/index.ts
import { calculateAndAwardPoints } from '../_shared/services/points-calculator.ts';

// Get new attendance records since last run
const { data: newAttendance } = await supabase
  .from('attendance')
  .select('*')
  .gte('created_at', lastRunTime);

// Calculate and award points
const results = await calculateAndAwardPoints(supabase, newAttendance);
```

## Future Enhancements

1. **Dynamic point values**: Store point values in database for easy adjustment
2. **Custom bonuses**: Allow universities to define custom bonus rules
3. **Point multipliers**: Implement temporary multiplier events (e.g., 2x points week)
4. **Point caps**: Implement daily/weekly point caps to prevent gaming
5. **Retroactive adjustments**: Bulk adjustment tool for historical corrections

## Requirements Mapping

- **Requirement 1**: Dashboard displays points balance (calculated from ledger)
- **Requirement 2**: Points and streaks display (points calculation service)
- **Requirement 13**: Animations for points (count-up animation on award)

## Related Documentation

- [Database Schema](./DATABASE_SCHEMA.md)
- [Gamification Engine](./GAMIFICATION_ENGINE.md) (to be created)
- [Task 14 Summary](./TASK_14_SUMMARY.md) (to be created)
