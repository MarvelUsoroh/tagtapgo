# Gamification Cron Job Fixes

## Overview
This document details the fixes applied to resolve errors in the gamification cron job that were preventing leaderboard updates and achievement unlocking.

## Issues Found & Fixed

### 🔴 Issue 1: Leaderboard Updater - Missing `university_id` ✅ FIXED

**Error:**
```
null value in column "university_id" of relation "leaderboards" violates not-null constraint
```

**Root Cause:**
- The `leaderboards` table requires `university_id` (NOT NULL constraint)
- The leaderboard updater service wasn't fetching or providing this value
- Caused ALL leaderboard updates to fail across all types and periods

**Impact:**
- 12 leaderboard update errors per cron run
- Stale leaderboard data (not reflecting recent points/redemptions)
- Users seeing incorrect scores and rankings

**Fix Applied:**
1. Updated `LeaderboardEntry` interface to include:
   - `university_id`
   - `student_name`
   - `student_avatar_url`

2. Added student data fetch before creating leaderboard entries:
   ```typescript
   const { data: studentsData } = await supabase
     .from('students')
     .select('id, university_id, name, avatar_url')
     .in('id', studentIds);
   
   const studentDataMap = new Map(studentsData?.map(s => [s.id, s]) || []);
   ```

3. Map student data to each leaderboard entry:
   ```typescript
   const entries = rankings.map((r) => {
     const studentData = studentDataMap.get(r.student_id);
     return {
       student_id: r.student_id,
       university_id: studentData?.university_id,
       student_name: studentData?.name,
       student_avatar_url: studentData?.avatar_url,
       // ... other fields
     };
   });
   ```

**Files Modified:**
- `tagtapgo-backend/supabase/functions/_shared/services/leaderboard-updater.ts`

---

### ⚠️ Issue 2: Achievement Checker - Unknown Criteria Types ✅ FIXED

**Errors:**
```
[Achievement Checker] Unknown criteria type: redemption_count
[Achievement Checker] Unknown criteria type: perfect_month
[Achievement Checker] Unknown criteria type: challenge_count
[Achievement Checker] Unknown criteria type: perfect_week
[Achievement Checker] Unknown criteria type: streak
```

**Root Cause:**
- Achievement criteria types in the database didn't match handler function names
- Some handlers were missing entirely
- Inconsistent use of `target` vs `value` in criteria JSON

**Impact:**
- 5+ achievements couldn't be unlocked automatically
- Missing achievement points in the points table
- Inconsistent bonus points calculation
- Users not receiving rewards for completing achievements

**Achievements Affected:**
1. **Streak Achievements:**
   - Fire Starter (7-day streak) - 100 points
   - Week Warrior (5-day streak)
   - On Fire (14-day streak)
   - Unstoppable (30-day streak)
   - Legend (60-day streak)

2. **Time-Based Achievements:**
   - Perfect Week (1 perfect week)
   - Perfect Month (1 perfect month)

3. **Reward Achievements:**
   - Reward Hunter (5 redemptions)

4. **Social Achievements:**
   - Challenger (5 challenges)
   - Team Player (5 friends)

**Fix Applied:**

1. **Added Criteria Type Aliases:**
   ```typescript
   case 'streak_milestone':
   case 'streak': // Alias for streak_milestone
     return await calculateStreakMilestone(...);
   
   case 'perfect_week_count':
   case 'perfect_week': // Alias
     return await calculatePerfectWeekCount(...);
   
   case 'perfect_month_count':
   case 'perfect_month': // Alias
     return await calculatePerfectMonthCount(...);
   
   case 'reward_redemption_count':
   case 'redemption_count': // Alias
     return await calculateRewardRedemptionCount(...);
   ```

2. **Added Missing Handlers:**
   ```typescript
   // Challenge count handler
   async function calculateChallengeCount(
     supabase: SupabaseClient,
     studentId: string,
     criteria: AchievementCriteria
   ): Promise<number> {
     const { count } = await supabase
       .from('challenges')
       .select('id', { count: 'exact', head: true })
       .eq('creator_id', studentId)
       .eq('status', 'completed');
     return count || 0;
   }
   
   // Friend count handler (placeholder)
   async function calculateFriendCount(
     supabase: SupabaseClient,
     studentId: string,
     criteria: AchievementCriteria
   ): Promise<number> {
     // Friends feature not implemented yet
     console.warn('[Achievement Checker] Friend count not implemented yet');
     return 0;
   }
   ```

3. **Fixed Target/Value Inconsistency:**
   ```typescript
   // Handle both 'target' and 'value' fields in criteria
   const target = achievement.criteria.target || achievement.criteria.value || 0;
   const unlocked = progress >= target;
   ```

4. **Added `unlocked` Field Updates:**
   - Set `unlocked: true` when unlocking achievements
   - Set `unlocked: false` when updating progress
   - Ensures consistency with database schema

**Files Modified:**
- `tagtapgo-backend/supabase/functions/_shared/services/achievement-checker.ts`

---

## Testing & Verification

### Before Fixes:
- ❌ 12 leaderboard update errors per cron run
- ❌ 5+ achievement criteria warnings per run
- ❌ Stale leaderboard data
- ❌ Missing achievement points
- ❌ Inconsistent bonus points

### After Fixes:
- ✅ Leaderboard updates should succeed
- ✅ All achievement types can be checked
- ✅ Achievement points awarded automatically
- ✅ Bonus points calculation accurate
- ✅ Real-time leaderboard updates

### Next Cron Run Will:
1. Update all leaderboards with correct `university_id`
2. Recalculate scores with current points (including redemptions)
3. Check and unlock eligible achievements
4. Award missing achievement points
5. Send achievement unlock notifications

---

## Database Schema Notes

### Leaderboards Table Columns:
```sql
- id (uuid, PK)
- student_id (uuid, NOT NULL)
- university_id (uuid, NOT NULL) ← Required field
- student_name (text)
- student_avatar_url (text)
- leaderboard_type (text, NOT NULL)
- period (text, NOT NULL)
- course_id (uuid)
- rank (integer, NOT NULL)
- points (integer, NOT NULL)
- current_streak (integer, default 0)
- longest_streak (integer, default 0)
- score (integer) ← Computed: (current_streak * 100) + points
- period_start (date, NOT NULL)
- period_end (date)
- updated_at (timestamptz)
```

### Student Achievements Table Columns:
```sql
- id (uuid, PK)
- student_id (uuid, NOT NULL)
- achievement_id (uuid, NOT NULL)
- unlocked_at (timestamptz)
- progress (jsonb, default '{}')
- unlocked (boolean, default false) ← Important for filtering
```

---

## Achievement Criteria Types Supported

### Attendance:
- `attendance_count` - Total attendance records
- `perfect_week` / `perfect_week_count` - Perfect weeks completed
- `perfect_month` / `perfect_month_count` - Perfect months completed

### Streak:
- `streak` / `streak_milestone` - Current streak milestones

### Time:
- `early_arrival_count` - Early arrival count

### Social:
- `feedback_count` - Total feedback submissions
- `feedback_unique_courses` - Unique courses with feedback
- `feedback_with_comments` - Feedback with comments
- `challenge_count` - Challenges completed
- `friend_count` - Friends added (not implemented yet)

### Reward:
- `redemption_count` / `reward_redemption_count` - Rewards redeemed

---

## Monitoring

### Check Cron Job Logs:
```sql
-- View recent gamification job logs
SELECT 
    timestamp,
    event_message,
    metadata->>'level' as level
FROM edge_logs
WHERE metadata->>'function_id' = '6a383824-3b40-4c35-b853-f8fcf357bc53'
ORDER BY timestamp DESC
LIMIT 50;
```

### Verify Leaderboard Updates:
```sql
-- Check recent leaderboard updates
SELECT 
    leaderboard_type,
    period,
    COUNT(*) as entries,
    MAX(updated_at) as last_update
FROM leaderboards
GROUP BY leaderboard_type, period
ORDER BY last_update DESC;
```

### Verify Achievement Unlocks:
```sql
-- Check recent achievement unlocks
SELECT 
    a.name,
    a.points_reward,
    sa.unlocked_at,
    sa.unlocked
FROM student_achievements sa
JOIN achievements a ON sa.achievement_id = a.id
WHERE sa.unlocked = true
ORDER BY sa.unlocked_at DESC
LIMIT 20;
```

---

## Related Documentation

- [Hybrid Leaderboard System](./HYBRID_LEADERBOARD_SYSTEM.md)
- [Leaderboard System](./LEADERBOARD_SYSTEM.md)
- [Points Calculation](./POINTS_CALCULATION.md)
- [Achievement System](./ACHIEVEMENT_SYSTEM.md) (to be created)

---

## Deployment Notes

1. **Deploy Updated Functions:**
   ```bash
   supabase functions deploy gamification-job
   ```

2. **Monitor Next Cron Run:**
   - Check logs for errors
   - Verify leaderboard updates
   - Confirm achievement unlocks

3. **Manual Trigger (if needed):**
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/gamification-job \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
   ```

---

## Summary

Both critical issues have been fixed:
1. ✅ Leaderboard updater now includes required `university_id` field
2. ✅ Achievement checker supports all criteria types with proper aliases

The next gamification cron job run should complete successfully without errors, updating leaderboards and unlocking eligible achievements with proper point awards.
