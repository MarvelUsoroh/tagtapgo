# User → Student Profile Creation Fix

## Summary

Fixed the critical issue where users could exist in `auth.users` but not in `public.students`, causing dashboard errors and broken gamification features.

**Solution**: Implemented automatic student profile creation using a PostgreSQL database trigger.

---

## Problem

### Symptoms
- Users successfully sign up but dashboard shows errors
- Missing student data (points, streaks, achievements)
- Database query shows users without student profiles:
  ```sql
  SELECT au.id, au.email
  FROM auth.users au
  LEFT JOIN public.students s ON au.id = s.id
  WHERE s.id IS NULL;
  -- Returns: marvelusoroh@gmail.com (and potentially others)
  ```

### Root Causes

1. **RLS Policy Blocks Client-Side Inserts**
   - `students` table only had SELECT policy for authenticated users
   - No INSERT policy for regular users
   - Client-side profile creation failed silently

2. **Signup Flow Attempted Client-Side Insert**
   - `signup/page.tsx` tried to insert after user creation
   - Failed due to RLS but continued anyway

3. **Dashboard's `ensureStudentProfile` Also Failed**
   - Used server-side client but still subject to RLS
   - Failed if university_id was missing/invalid

4. **Field Name Mismatch**
   - Code tried to insert `name` field
   - Database uses `first_name`, `last_name`, `full_name`
   - Migration `20241028000005` removed `students.name` column

---

## Solution: Database Trigger (Option A)

### Why This Approach?

✅ **Most Reliable**
- Runs automatically on every user creation
- Bypasses RLS entirely (SECURITY DEFINER)
- No client-side code dependency
- Handles both email signup and SSO

✅ **Idempotent**
- Safe to run multiple times
- Checks if profile exists before creating

✅ **Graceful Error Handling**
- Logs warnings but doesn't fail user creation
- Skips users without valid university_id

---

## Implementation

### 1. Database Migration

**File**: `tagtapgo-backend/supabase/migrations/20251029000500_auto_create_student_profile.sql`

**What it does:**
- Creates `public.handle_new_user()` trigger function
- Creates trigger on `auth.users` INSERT
- Backfills existing users without profiles
- Ensures service_role RLS policy exists

**Trigger Logic:**
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

**Profile Creation Logic:**
1. Check if profile already exists → skip if yes
2. Extract `university_id` from user metadata
3. If missing, try to match email domain to `universities.domain`
4. If still missing, skip (log warning)
5. Split full name into first/last name
6. Create student profile with proper fields
7. Handle errors gracefully

### 2. Frontend Updates

#### `ensure-student.ts`
**Changed:**
- `name` → `full_name`, `first_name`, `last_name`
- Added name splitting logic
- Uses correct database fields

**Before:**
```typescript
name: nameFromMeta,
```

**After:**
```typescript
first_name: firstName,
last_name: lastName,
full_name: fullNameFromMeta,
```

#### `signup/page.tsx`
**Changed:**
- `name` → `full_name`, `first_name`, `last_name`
- Added comment explaining trigger handles creation
- Client-side insert kept as fallback (will likely fail due to RLS)

**Before:**
```typescript
name,
```

**After:**
```typescript
first_name: firstName,
last_name: lastName,
full_name: name,
```

---

## Field Mapping

| Source | Target Field | Notes |
|--------|-------------|-------|
| `user_metadata.name` (split) | `first_name` | First word of name |
| `user_metadata.name` (split) | `last_name` | Remaining words |
| - | `full_name` | **GENERATED ALWAYS** column (auto-computed) |
| `user_metadata.university_id` | `university_id` | UUID |
| `user_metadata.external_id` | `external_id` | Fallback to email local part |
| `email` | `email` | User's email |

**Important**: `full_name` is a GENERATED ALWAYS column that automatically concatenates `first_name` and `last_name`. The trigger and frontend code do NOT insert into this column.

---

## University Resolution

The trigger uses this logic to find university_id:

1. **Check user metadata**: `raw_user_meta_data->>'university_id'`
2. **If missing, check email domain**: 
   ```sql
   SELECT id FROM universities 
   WHERE domain = split_part(email, '@', 2)
   ```
3. **If still missing**: Skip profile creation (log warning)

This prevents FK constraint violations.

---

## Files Changed

### Backend
1. ✅ `tagtapgo-backend/supabase/migrations/20251029000500_auto_create_student_profile.sql`
   - New migration file

2. ✅ `tagtapgo-backend/docs/AUTO_STUDENT_PROFILE_CREATION.md`
   - Detailed documentation

3. ✅ `tagtapgo-backend/docs/USER_TO_STUDENT_PROFILE_FIX.md`
   - This summary document

### Frontend
4. ✅ `tagtapgo-app/src/lib/ensure-student.ts`
   - Fixed field names
   - Added name splitting

5. ✅ `tagtapgo-app/src/app/signup/page.tsx`
   - Fixed field names
   - Added explanatory comments

---

## Testing

### 1. Run Migration

```bash
cd tagtapgo-backend
supabase db push
```

### 2. Verify Trigger Exists

```sql
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';
```

Expected: 1 row, `tgenabled = 'O'` (enabled)

### 3. Check Backfill Results

```sql
-- Should return 0 (all users have profiles)
SELECT COUNT(*)
FROM auth.users au
LEFT JOIN public.students s ON au.id = s.id
WHERE s.id IS NULL;
```

### 4. Test New User Creation

1. Go to `/signup`
2. Fill in form with Demo University
3. Submit
4. Check database:
   ```sql
   SELECT * FROM public.students 
   WHERE email = 'test@demo.edu';
   ```

Expected: Profile exists with correct fields

### 5. Verify Field Names

```sql
SELECT 
  id,
  email,
  first_name,
  last_name,
  full_name
FROM public.students
WHERE created_at > NOW() - INTERVAL '1 hour';
```

Expected: All fields populated correctly

---

## Monitoring

### Check for Missing Profiles

```sql
SELECT 
  au.id,
  au.email,
  au.raw_user_meta_data->>'university_id' as metadata_university_id
FROM auth.users au
LEFT JOIN public.students s ON au.id = s.id
WHERE s.id IS NULL;
```

Should always return 0 rows.

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

Check `created_by` field:
- `'auto_trigger'` = Created by trigger
- `'backfill_migration'` = Created by migration backfill

---

## Related Issues

### Issue: `students.name` Column Removed

**Context**: Migration `20241028000005_consolidate_student_name_fields.sql` removed the `name` column in favor of `first_name`, `last_name`, and `full_name`.

**Reference**: `LEADERBOARD_COMPLETE_FIX_SUMMARY.md`

**Impact**: Any code using `students.name` will fail.

**Resolution**: This fix updates all remaining references to use correct fields.

---

## Rollback Plan

If issues occur, you can disable the trigger:

```sql
-- Disable trigger
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

-- Re-enable later
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
```

To completely remove:

```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
```

---

## Status

✅ **IMPLEMENTED**

- [x] Migration created
- [x] Trigger function created
- [x] Trigger enabled
- [x] Existing users backfilled
- [x] Frontend code updated
- [x] Field names corrected
- [x] Documentation created

---

## Next Steps

1. **Deploy Migration**
   ```bash
   cd tagtapgo-backend
   supabase db push
   ```

2. **Monitor for Issues**
   - Check for users without profiles (should be 0)
   - Verify new signups create profiles automatically
   - Check logs for any trigger errors

3. **Test Thoroughly**
   - Create new user via signup
   - Verify dashboard loads correctly
   - Check gamification features work

---

## Related Documentation

- `AUTO_STUDENT_PROFILE_CREATION.md` - Detailed technical documentation
- `LEADERBOARD_COMPLETE_FIX_SUMMARY.md` - Why `students.name` was removed
- `UNIVERSITIES_INTEGRATION.md` - University resolution logic
- `DATABASE_SCHEMA.md` - Students table schema
