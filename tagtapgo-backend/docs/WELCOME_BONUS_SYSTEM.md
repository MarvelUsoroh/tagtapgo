# Welcome Bonus Points System

## Overview

New students automatically receive **100 welcome bonus points** when their profile is created. This gives users an immediate feel for the gamification system and encourages engagement.

## Features

✅ **Automatic** - Points awarded via database trigger  
✅ **Idempotent** - Won't award points twice to the same student  
✅ **Modular** - Easy to enable/disable independently  
✅ **Backfilled** - Existing students receive bonus retroactively

---

## How It Works

### Trigger Flow

```
User signs up
    ↓
auth.users INSERT
    ↓
handle_new_user() trigger
    ↓
students INSERT
    ↓
award_welcome_bonus() trigger  ← NEW!
    ↓
100 points added to points table
    ↓
Student sees points on dashboard
```

### Database Implementation

**Trigger Function**: `public.award_welcome_bonus()`

- Checks if welcome bonus already awarded
- Inserts 100 points with type `'welcome_bonus'`
- Uses student ID as reference_id for idempotency
- Logs success/failure

**Trigger**: `on_student_created_award_bonus`

- Fires AFTER INSERT on `public.students`
- Calls `award_welcome_bonus()` function

**Index**: `idx_points_welcome_bonus`

- Speeds up duplicate check
- Partial index on `transaction_type = 'welcome_bonus'`

---

## Points Transaction Details

| Field                | Value                                                                          |
| -------------------- | ------------------------------------------------------------------------------ |
| **points**           | 100                                                                            |
| **transaction_type** | `'bonus'`                                                                      |
| **reference_id**     | Student's user ID (UUID)                                                       |
| **description**      | "Welcome to TagTapGo! 🎉"                                                      |
| **metadata**         | `{ bonus_type: 'welcome', awarded_at: timestamp, awarded_by: 'auto_trigger' }` |

**Note**: We use `transaction_type = 'bonus'` (allowed by CHECK constraint) and distinguish welcome bonuses via `metadata.bonus_type = 'welcome'`.

---

## Idempotency

The system prevents duplicate bonuses using:

1. **Reference ID**: Student's user ID ensures uniqueness
2. **Existence Check**: Queries points table before inserting
3. **Unique Constraint**: Database-level protection (if configured)

```sql
-- Check before awarding
IF EXISTS (
  SELECT 1 FROM public.points
  WHERE student_id = NEW.id
    AND transaction_type = 'bonus'
    AND metadata->>'bonus_type' = 'welcome'
) THEN
  -- Skip - already awarded
END IF;
```

---

## Backfill

The migration includes a backfill script that:

- Finds all students without welcome bonus
- Awards 100 points to each
- Reports statistics (awarded, skipped, errors)

**Backfill Metadata:**

```json
{
  "bonus_type": "welcome",
  "awarded_at": "2025-10-29T...",
  "awarded_by": "backfill_migration"
}
```

---

## Monitoring

### Check Welcome Bonus Distribution

```sql
-- Students with welcome bonus
SELECT COUNT(DISTINCT student_id)
FROM public.points
WHERE transaction_type = 'bonus'
  AND metadata->>'bonus_type' = 'welcome';

-- Students without welcome bonus
SELECT s.id, s.email, s.first_name, s.last_name
FROM public.students s
WHERE NOT EXISTS (
  SELECT 1 FROM public.points p
  WHERE p.student_id = s.id
    AND p.transaction_type = 'bonus'
    AND p.metadata->>'bonus_type' = 'welcome'
);
```

### View Welcome Bonus Transactions

```sql
SELECT
  p.student_id,
  s.email,
  s.first_name,
  s.last_name,
  p.points,
  p.description,
  p.metadata->>'awarded_by' as awarded_by,
  p.created_at
FROM public.points p
JOIN public.students s ON p.student_id = s.id
WHERE p.transaction_type = 'bonus'
  AND p.metadata->>'bonus_type' = 'welcome'
ORDER BY p.created_at DESC;
```

### Total Points Awarded

```sql
SELECT
  COUNT(*) as total_bonuses,
  SUM(points) as total_points_awarded
FROM public.points
WHERE transaction_type = 'bonus'
  AND metadata->>'bonus_type' = 'welcome';
```

---

## Testing

### Test New User Signup

1. **Create new user via signup**

   ```
   - Go to /signup
   - Fill in form
   - Submit
   ```

2. **Check points were awarded**

   ```sql
   SELECT * FROM public.points
   WHERE student_id = '<new-user-id>'
     AND transaction_type = 'bonus'
     AND metadata->>'bonus_type' = 'welcome';
   ```

3. **Verify dashboard shows 100 points**
   - Login as new user
   - Check points display on dashboard

### Test Idempotency

```sql
-- Try to award bonus again (should be prevented)
INSERT INTO public.points (
  student_id,
  points,
  transaction_type,
  reference_id,
  description,
  metadata
) VALUES (
  '<existing-student-id>',
  100,
  'bonus',
  '<existing-student-id>',
  'Test duplicate',
  '{"bonus_type": "welcome"}'::jsonb
);
-- Should fail or be skipped by trigger logic
```

---

## Disabling the Feature

### Temporary Disable (Keep Function)

```sql
-- Disable trigger for new students
DROP TRIGGER IF EXISTS on_student_created_award_bonus ON public.students;

-- Re-enable later
CREATE TRIGGER on_student_created_award_bonus
  AFTER INSERT ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.award_welcome_bonus();
```

### Permanent Removal

```sql
-- Remove trigger
DROP TRIGGER IF EXISTS on_student_created_award_bonus ON public.students;

-- Remove function
DROP FUNCTION IF EXISTS public.award_welcome_bonus();

-- Remove index
DROP INDEX IF EXISTS idx_points_welcome_bonus;
```

**Note**: This does NOT remove already awarded points.

### Remove Awarded Points (Use with Caution!)

```sql
-- Delete all welcome bonus points
DELETE FROM public.points
WHERE transaction_type = 'bonus'
  AND metadata->>'bonus_type' = 'welcome';

-- This will affect:
-- - Student point balances
-- - Leaderboard rankings
-- - Achievement progress
```

---

## Modifying the Bonus Amount

To change the bonus amount (e.g., from 100 to 200 points):

```sql
-- Update the function
CREATE OR REPLACE FUNCTION public.award_welcome_bonus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ... (same logic)

  INSERT INTO public.points (
    student_id,
    points,
    -- ... other fields
  ) VALUES (
    NEW.id,
    200,  -- Changed from 100
    -- ... other values
  );

  -- ... (rest of function)
END;
$$;
```

**Note**: This only affects NEW students. Existing students keep their original bonus.

---

## Troubleshooting

### Student Didn't Receive Bonus

**Check if profile was created:**

```sql
SELECT * FROM public.students WHERE id = '<user-id>';
```

**Check if bonus was awarded:**

```sql
SELECT * FROM public.points
WHERE student_id = '<user-id>'
  AND transaction_type = 'bonus'
  AND metadata->>'bonus_type' = 'welcome';
```

**Check trigger is enabled:**

```sql
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'on_student_created_award_bonus';
```

**Manually award bonus:**

```sql
INSERT INTO public.points (
  student_id,
  points,
  transaction_type,
  reference_id,
  description,
  metadata
) VALUES (
  '<student-id>',
  100,
  'bonus',
  '<student-id>',
  'Welcome to TagTapGo! 🎉',
  jsonb_build_object(
    'bonus_type', 'welcome',
    'awarded_at', NOW(),
    'awarded_by', 'manual_fix'
  )
);
```

### Duplicate Bonuses Awarded

**Check for duplicates:**

```sql
SELECT student_id, COUNT(*) as bonus_count
FROM public.points
WHERE transaction_type = 'bonus'
  AND metadata->>'bonus_type' = 'welcome'
GROUP BY student_id
HAVING COUNT(*) > 1;
```

**Remove duplicates (keep oldest):**

```sql
DELETE FROM public.points
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY student_id
             ORDER BY created_at ASC
           ) as rn
    FROM public.points
    WHERE transaction_type = 'bonus'
      AND metadata->>'bonus_type' = 'welcome'
  ) t
  WHERE rn > 1
);
```

---

## Migration Details

**File**: `20251029000502_add_welcome_bonus_points.sql`

**What it does:**

1. Creates `award_welcome_bonus()` function
2. Creates trigger on `students` table
3. Backfills existing students
4. Creates performance index
5. Reports statistics

**Safe to run multiple times**: Yes (idempotent)

**Dependencies**:

- Requires `students` table
- Requires `points` table
- Should run after `20251029000500_auto_create_student_profile.sql`

---

## Related Documentation

- `AUTO_STUDENT_PROFILE_CREATION.md` - Student profile creation trigger
- `POINTS_CALCULATION.md` - Points system overview
- `GAMIFICATION_ENGINE.md` - Gamification architecture

---

## Status

✅ **IMPLEMENTED**

- [x] Trigger function created
- [x] Trigger enabled
- [x] Backfill script included
- [x] Performance index added
- [x] Documentation created
- [x] Modular design (easy to disable)

---

## Future Enhancements

Potential improvements for future versions:

1. **Variable Bonus Amounts**
   - Different amounts per university
   - Promotional periods with higher bonuses

2. **Referral Bonuses**
   - Award points for referring friends
   - Track referral source

3. **Time-Limited Bonuses**
   - Early adopter bonuses
   - Seasonal promotions

4. **Achievement Integration**
   - Unlock "Welcome" achievement
   - Trigger notification

5. **A/B Testing**
   - Test different bonus amounts
   - Measure impact on engagement
