# Redemption RLS Policy Fix

## Problem

When students tried to redeem rewards, they received a 403 error:

```
Error: new row violates row-level security policy for table "redemptions"
Code: 42501
```

## Root Cause

The `redemptions` table had Row-Level Security (RLS) enabled, but there were no policies allowing authenticated students to insert their own redemption records.

Additionally, the redemption flow also inserts into the `points` table (to deduct points), which likely had the same issue.

## Solution

Created migration `20241027000001_fix_redemptions_rls.sql` to add proper RLS policies for:

### 1. Redemptions Table

**Policies Added:**
- ✅ Students can INSERT their own redemptions
- ✅ Students can SELECT (view) their own redemptions
- ✅ Students can UPDATE their own redemptions
- ✅ Service role has full access

**SQL:**
```sql
CREATE POLICY "Students can insert own redemptions"
  ON redemptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can view own redemptions"
  ON redemptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Students can update own redemptions"
  ON redemptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);
```

### 2. Points Table

**Policies Added:**
- ✅ Students can INSERT their own points transactions
- ✅ Students can SELECT (view) their own points
- ✅ Service role has full access

**SQL:**
```sql
CREATE POLICY "Students can insert own points"
  ON points
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can view own points"
  ON points
  FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);
```

### 3. Rewards Table

**Policies Added:**
- ✅ Students can SELECT (view) all active rewards
- ✅ Service role has full access

**SQL:**
```sql
CREATE POLICY "Students can view all rewards"
  ON rewards
  FOR SELECT
  TO authenticated
  USING (is_active = true);
```

## How Redemption Works

### Redemption Flow

1. **Student clicks "Redeem" on a reward**
2. **Frontend validates points balance**
3. **Frontend inserts redemption record:**
   ```typescript
   await supabase
     .from('redemptions')
     .insert({
       student_id: studentId,
       reward_id: rewardId,
       points_spent: pointsCost,
       status: 'pending',
     });
   ```
4. **Frontend deducts points:**
   ```typescript
   await supabase
     .from('points')
     .insert({
       student_id: studentId,
       points: -pointsCost,
       transaction_type: 'redemption',
       description: `Redeemed: ${rewardName}`,
     });
   ```
5. **Backend processes redemption** (generates code, updates status)
6. **Student receives notification** with redemption code

### Security Model

**Students can:**
- ✅ Insert their own redemptions (can't redeem for others)
- ✅ View their own redemptions (can't see others' redemptions)
- ✅ Update their own redemptions (for status tracking)
- ✅ Insert their own points transactions (for redemptions)
- ✅ View their own points history
- ✅ View all active rewards in the catalog

**Students cannot:**
- ❌ Insert redemptions for other students
- ❌ View other students' redemptions
- ❌ Modify other students' points
- ❌ View inactive/hidden rewards
- ❌ Modify reward catalog

**Service role can:**
- ✅ Full access to all tables (for backend jobs)

## Testing

### Manual Test Steps

1. **Login as a student**
2. **Navigate to Rewards page**
3. **Select a reward** (ensure you have enough points)
4. **Click "Redeem"**
5. **Verify:**
   - ✅ Redemption succeeds (no 403 error)
   - ✅ Points are deducted
   - ✅ Redemption appears in history
   - ✅ Redemption code is generated
   - ✅ Notification is sent

### SQL Test Queries

```sql
-- Test as authenticated student
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "student-uuid"}';

-- Should succeed: Insert own redemption
INSERT INTO redemptions (student_id, reward_id, points_spent, status)
VALUES ('student-uuid', 'reward-uuid', 100, 'pending');

-- Should succeed: View own redemptions
SELECT * FROM redemptions WHERE student_id = 'student-uuid';

-- Should fail: Insert redemption for another student
INSERT INTO redemptions (student_id, reward_id, points_spent, status)
VALUES ('other-student-uuid', 'reward-uuid', 100, 'pending');

-- Should succeed: Insert own points transaction
INSERT INTO points (student_id, points, transaction_type, description)
VALUES ('student-uuid', -100, 'redemption', 'Test redemption');

-- Should succeed: View own points
SELECT * FROM points WHERE student_id = 'student-uuid';

-- Should succeed: View active rewards
SELECT * FROM rewards WHERE is_active = true;

-- Reset role
RESET ROLE;
```

## Migration Deployment

### Option 1: Supabase CLI

```bash
cd tagtapgo-backend
supabase db push
```

### Option 2: Manual SQL Execution

Run the SQL from `20241027000001_fix_redemptions_rls.sql` in Supabase SQL Editor.

## Verification

After deploying the migration, verify policies are in place:

```sql
-- Check redemptions policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'redemptions';

-- Check points policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'points';

-- Check rewards policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'rewards';
```

Expected output: 4 policies for redemptions, 3 for points, 2 for rewards.

## Related Tables

Other tables that may need similar RLS policies:

- ✅ `redemptions` - Fixed
- ✅ `points` - Fixed
- ✅ `rewards` - Fixed
- ⚠️ `students` - Should have policies for viewing own profile
- ⚠️ `streaks` - Should have policies for viewing own streak
- ⚠️ `student_achievements` - Should have policies for viewing own achievements
- ⚠️ `leaderboards` - Should have policies for viewing leaderboards
- ⚠️ `notifications` - Should have policies for viewing own notifications
- ⚠️ `push_subscriptions` - Should have policies for managing own subscription

## Best Practices

### RLS Policy Checklist

For each table, consider:

1. **SELECT (Read):**
   - Can students view their own data?
   - Can students view public data (leaderboards, rewards)?
   - Can students view other students' data (for social features)?

2. **INSERT (Create):**
   - Can students create their own records?
   - Should creation be restricted to backend only?

3. **UPDATE (Modify):**
   - Can students update their own records?
   - Which fields can be updated?

4. **DELETE (Remove):**
   - Can students delete their own records?
   - Should deletion be restricted to backend only?

5. **Service Role:**
   - Always grant full access to service role for backend jobs

### Security Principles

1. **Principle of Least Privilege** - Grant minimum necessary permissions
2. **Own Data Only** - Students can only access their own data (unless public)
3. **Read-Only Public Data** - Students can view but not modify public data
4. **Backend Control** - Sensitive operations restricted to service role
5. **Audit Trail** - Log all policy violations for security monitoring

## Files Modified

- ✅ Created: `tagtapgo-backend/supabase/migrations/20241027000001_fix_redemptions_rls.sql`
- ✅ Created: `tagtapgo-backend/docs/REDEMPTION_RLS_FIX.md`

## Status

**Issue:** ✅ **FIXED**

Students can now successfully redeem rewards without RLS policy violations.
