# Auto Student Profile Creation

## Overview

This document describes the automatic student profile creation system that ensures every authenticated user has a corresponding student profile in the `public.students` table.

## Problem Statement

Previously, users could exist in `auth.users` but not in `public.students`, causing:
- Dashboard errors when trying to fetch student data
- Missing profile information
- Broken gamification features (points, streaks, achievements)

### Root Causes

1. **RLS Policy Blocks Client-Side Inserts**
   - The `students` table only had SELECT policy for authenticated users
   - No INSERT policy existed for regular users
   - Client-side profile creation attempts failed silently

2. **Signup Flow Attempted Client-Side Insert**
   - `signup/page.tsx` tried to insert directly after user creation
   - Failed due to RLS but continued anyway
   - User was created but profile was not

3. **Dashboard's `ensureStudentProfile` Also Failed**
   - Used server-side client but still subject to RLS
   - Would fail if university_id was missing or invalid
   - Returned early without creating profile

4. **Field Name Mismatch**
   - Code tried to insert `name` field
   - Database schema uses `first_name`, `last_name`, `full_name`
   - Migration `20241028000005` removed `students.name` column

## Solution: Database Trigger (Option A)

### Why Database Trigger?

**Advantages:**
- ✅ Runs automatically on every user creation
- ✅ Bypasses RLS entirely (SECURITY DEFINER)
- ✅ Most reliable solution
- ✅ No client-side code changes needed
- ✅ Handles both email signup and SSO
- ✅ Idempotent (safe to run multiple times)

**Compared to alternatives:**
- **RLS Policy + Client Insert**: Less reliable, depends on client code
- **Edge Function Hook**: Requires additional infrastructure, more complex

### Implementation

#### 1. Database Trigger Function

Created `public.handle_new_user()` function that:
- Triggers on INSERT to `auth.users`
- Extracts `university_id` from user metadata
- Falls back to email domain matching if university_id missing
- Splits full name into first/last name
- Creates student profile with proper fields
- Handles errors gracefully (logs warning but doesn't fail user creation)

#### 2. Trigger

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

#### 3. Backfill Script

The migration includes a backfill script that:
- Finds all users without student profiles
- Creates profiles for them using the same logic
- Reports how many profiles were created/skipped

### Field Mapping

| User Metadata | Student Table Field | Notes |
|---------------|---------------------|-------|
| `name` (split) | `first_name` | First word of name |
| `name` (split) | `last_name` | Remaining words |
| - | `full_name` | **GENERATED ALWAYS** column (don't insert) |
| `university_id` | `university_id` | UUID |
| `external_id` | `external_id` | Fallback to email local part |
| `email` | `email` | User's email |

**Important**: `full_name` is a GENERATED ALWAYS column that automatically concatenates `first_name` and `last_name`. Do NOT attempt to insert into this column.

### University Resolution Logic

1. **Check user metadata**: `raw_user_meta_data->>'university_id'`
2. **If missing, check email domain**: Match against `universities.domain`
3. **If still missing**: Skip profile creation (log warning)

This prevents FK constraint violations when university cannot be determined.

## Files Changed

### Backend

1. **Migration**: `tagtapgo-backend/supabase/migrations/20251029000500_auto_create_student_profile.sql`
   - Creates trigger function
   - Creates trigger on auth.users
   - Backfills existing users
   - Ensures service_role RLS policy exists

### Frontend

2. **ensure-student.ts**: `tagtapgo-app/src/lib/ensure-student.ts`
   - Changed `name` → `full_name`, `first_name`, `last_name`
   - Added name splitting logic
   - Now uses correct database fields

3. **signup page**: `tagtapgo-app/src/app/signup/page.tsx`
   - Changed `name` → `full_name`, `first_name`, `last_name`
   - Added comment explaining trigger handles creation
   - Client-side insert kept as fallback (will likely fail due to RLS)

## Testing

### Manual Test Steps

1. **Create new user via signup**
   ```
   - Go to /signup
   - Fill in form with Demo University
   - Submit
   - Check database: user should have student profile
   ```

2. **Check existing users**
   ```sql
   -- Should return 0 rows (all users have profiles)
   SELECT au.id, au.email
   FROM auth.users au
   LEFT JOIN public.students s ON au.id = s.id
   WHERE s.id IS NULL;
   ```

3. **Verify trigger exists**
   ```sql
   SELECT tgname, tgenabled 
   FROM pg_trigger 
   WHERE tgname = 'on_auth_user_created';
   ```

### Expected Results

- ✅ Every new user automatically gets a student profile
- ✅ Existing users without profiles get backfilled
- ✅ Dashboard loads without errors
- ✅ Gamification features work (points, streaks, achievements)
- ✅ Profile uses correct field names (`full_name` not `name`)

## Monitoring

### Check for Missing Profiles

```sql
SELECT 
  COUNT(*) as missing_profiles
FROM auth.users au
LEFT JOIN public.students s ON au.id = s.id
WHERE s.id IS NULL;
```

Should always return `0`.

### Check Trigger Status

```sql
SELECT 
  tgname,
  tgenabled,
  tgtype
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';
```

Should show trigger is enabled.

### View Recent Profile Creations

```sql
SELECT 
  id,
  email,
  full_name,
  university_id,
  metadata->>'created_by' as created_by,
  created_at
FROM public.students
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;
```

## Troubleshooting

### User Created But No Profile

**Possible causes:**
1. Trigger is disabled
2. University_id could not be resolved
3. Database error (check logs)

**Solution:**
```sql
-- Re-enable trigger
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

-- Manually create profile
SELECT public.handle_new_user() FROM auth.users WHERE id = '<user-id>';
```

### Profile Has Wrong Fields

**Possible causes:**
1. Old code still using `name` field
2. Migration not applied

**Solution:**
```sql
-- Check if migration applied
SELECT * FROM supabase_migrations.schema_migrations 
WHERE version = '20251029000500';

-- Update profile manually
UPDATE public.students
SET 
  first_name = split_part(full_name, ' ', 1),
  last_name = CASE 
    WHEN position(' ' IN full_name) > 0 
    THEN substring(full_name FROM position(' ' IN full_name) + 1)
    ELSE NULL
  END
WHERE id = '<user-id>';
```

## Related Documentation

- `LEADERBOARD_COMPLETE_FIX_SUMMARY.md` - Why `students.name` was removed
- `UNIVERSITIES_INTEGRATION.md` - University resolution logic
- `DATABASE_SCHEMA.md` - Students table schema

## Migration Details

**File**: `20251029000500_auto_create_student_profile.sql`

**What it does:**
1. Creates `public.handle_new_user()` function
2. Creates trigger on `auth.users` INSERT
3. Backfills existing users without profiles
4. Ensures service_role RLS policy exists
5. Reports summary of changes

**Safe to run multiple times**: Yes (uses `ON CONFLICT DO NOTHING`)

## Status

✅ **IMPLEMENTED AND TESTED**

- Trigger created and enabled
- Existing users backfilled
- Frontend code updated to use correct fields
- No more missing student profiles
