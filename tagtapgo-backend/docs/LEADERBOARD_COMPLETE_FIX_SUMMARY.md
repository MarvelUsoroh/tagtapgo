# Leaderboard System - Complete Fix Summary

## Session Overview
Fixed multiple critical issues with the leaderboard system including database schema mismatches, timezone issues, and query problems.

---

## Issues Fixed

### 1. ✅ Database Schema - `students.name` Column Removed
**Problem:** Leaderboard updater was querying `students.name` which was removed in a previous migration.

**Error:**
```
column students.name does not exist
```

**Fix:**
- Updated all queries to use `students.full_name` (generated column)
- Fixed in 4 locations in `leaderboard-updater.ts`
- Redeployed `gamification-job` Edge Function

**Files Changed:**
- `tagtapgo-backend/supabase/functions/_shared/services/leaderboard-updater.ts`

---

### 2. ✅ Year/School Leaderboard Data Not Being Created
**Problem:** Year and school leaderboards were incorrectly setting `course_id` when they should be NULL.

**Fix:**
- Changed year/school leaderboard entries to always set:
  - `course_id: null`
  - `primary_course_id: null`
- Only class leaderboards use these fields

**Files Changed:**
- `tagtapgo-backend/supabase/functions/_shared/services/leaderboard-updater.ts`

---

### 3. ✅ Monthly Filter Showing No Data (Timezone Issue)
**Problem:** Frontend and backend were calculating monthly period_start differently due to timezone conversion.

**Root Cause:**
```typescript
// This creates 2025-09-30 in UTC+1 timezone
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
periodStart = monthStart.toISOString().split('T')[0]; // "2025-09-30"
```

**Fix:**
```typescript
// Use UTC to get consistent 2025-10-01
const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
periodStart = monthStart.toISOString().split('T')[0]; // "2025-10-01"
```

**Files Changed:**
- `tagtapgo-app/src/app/leaderboard/LeaderboardClient.tsx` (2 locations)
- `tagtapgo-app/src/components/LeaderboardPreview.tsx`
- `tagtapgo-backend/supabase/functions/_shared/services/leaderboard-updater.ts`

---

### 4. ✅ Class Filter Showing "No Class Data Available"
**Problem:** Supabase query with join syntax failed due to ambiguous foreign key constraints.

**Root Cause:**
- Two foreign key constraints on `leaderboards.primary_course_id`:
  1. `fk_leaderboards_primary_course`
  2. `leaderboards_primary_course_id_fkey`
- Supabase join syntax `courses!primary_course_id(name)` didn't know which to use

**Fix:**
- Removed join syntax from query
- Fetch course name separately with second query
- Removed duplicate foreign key constraint via migration

**Files Changed:**
- `tagtapgo-app/src/app/leaderboard/LeaderboardClient.tsx`
- `tagtapgo-backend/supabase/migrations/20251028151720_remove_duplicate_fk_constraint.sql`

---

## Score Calculation Clarification

### The Formula
```
Score = (Current Streak × 100) + Points
```

### Example
- Current Streak: 5 days
- Points: 80
- **Score: 580** ✅

This is a **hybrid scoring system** that prioritizes consistent attendance (streaks) over one-time point gains.

### Why All Periods Show Same Points
If all points were earned today:
- Weekly: 80 points (today is in this week)
- Monthly: 80 points (today is in this month)
- All-Time: 80 points (all points)

**This is correct behavior!** Filters will show different values when points are earned across different time periods.

---

## PARTIAL Indexes Explained

### Why We Use Them
Different leaderboard types have different uniqueness requirements:

**Class Leaderboards:**
- One entry per student per period (regardless of course)
- Grouped by primary class (most attended)
```sql
CREATE UNIQUE INDEX leaderboards_unique_class_entry 
ON leaderboards (student_id, leaderboard_type, period, period_start) 
WHERE leaderboard_type = 'class';
```

**Year/School Leaderboards:**
- One entry per student per period
- No course grouping
```sql
CREATE UNIQUE INDEX leaderboards_unique_other_entry 
ON leaderboards (student_id, leaderboard_type, period, course_id, period_start) 
WHERE leaderboard_type != 'class';
```

---

## Deployments Made

1. ✅ **gamification-job** (3 times)
   - Fix 1: `students.name` → `students.full_name`
   - Fix 2: Year/school `course_id` → `null`
   - Fix 3: Monthly timezone fix

2. ✅ **Database Migration**
   - Removed duplicate foreign key constraint

---

## Testing Checklist

- [x] Dashboard leaderboard preview shows data
- [x] Weekly filter works
- [x] Monthly filter works
- [x] All-time filter works
- [x] Class leaderboard shows course name
- [x] Year leaderboard works
- [x] School leaderboard works
- [x] Score calculation is correct
- [x] Ranks update properly

---

## Documentation Created

1. **LEADERBOARD_FIXES.md** - Technical details about fixes and PARTIAL indexes
2. **LEADERBOARD_SCORE_EXPLANATION.md** - Explains scoring system for users
3. **TIMEZONE_FIX.md** - Details about timezone issue and solution
4. **LEADERBOARD_COMPLETE_FIX_SUMMARY.md** - This document

---

## Architecture Notes

### Component Reusability
- **Dashboard** uses `RecentAchievements` and `LeaderboardPreview` components
- **Individual pages** (`/achievements`, `/leaderboard`) have their own client components
- Components are NOT currently reusable between dashboard and full pages

### Future Improvements
1. Extract common leaderboard logic into shared hooks
2. Create reusable `LeaderboardList` component
3. Create reusable `AchievementGrid` component
4. Add database indexes for common queries
5. Consider materialized views for leaderboard calculations

---

## Key Learnings

1. **Always use UTC for date calculations** when storing/comparing dates across systems
2. **Avoid ambiguous foreign key constraints** - use descriptive names and avoid duplicates
3. **PARTIAL indexes are powerful** for different uniqueness constraints on the same table
4. **Hybrid scoring systems** can prioritize different behaviors (consistency vs. volume)
5. **Timezone issues are subtle** and can cause data to appear/disappear based on location

---

## Status: ✅ ALL ISSUES RESOLVED

The leaderboard system is now fully functional with:
- Correct data display across all filters
- Proper timezone handling
- Clean database schema
- Accurate score calculations
- Working class/year/school leaderboards
