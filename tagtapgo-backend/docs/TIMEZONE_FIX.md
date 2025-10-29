# Timezone Fix for Leaderboard Filters

## Problem

The monthly filter was showing no data, and class filter was showing "no class data available" due to timezone mismatches between frontend and backend.

## Root Cause

### Backend (Edge Function)
```typescript
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
periodStart = monthStart.toISOString().split('T')[0];
```

When running in a timezone ahead of UTC (e.g., UTC+1), this creates:
- Local: October 1, 2025 00:00:00
- ISO: `2025-09-30T23:00:00.000Z`
- Split: `2025-09-30` ❌

### Frontend (React Component)
```typescript
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
periodStart = monthStart.toISOString().split('T')[0];
```

Same issue - creates `2025-09-30` when it should be `2025-10-01`.

### Database
Stores as DATE type: `2025-10-01` (correct)

### The Mismatch
- Backend stores: `2025-09-30` (due to timezone conversion)
- Frontend queries: `2025-09-30` (due to timezone conversion)
- Database displays: `2025-10-01` (correct date)
- **Query fails because `'2025-09-30' != '2025-10-01'`**

Wait, that's not right. Let me check again...

Actually, the backend and frontend SHOULD match since they use the same logic. The issue is that the database stores the timestamp with timezone, and when queried as a date, it shows the UTC date.

## Actual Problem

The database column `period_start` is type `DATE`, but when a timestamp like `2025-09-30T23:00:00.000Z` is stored, PostgreSQL converts it to the date in UTC, which is `2025-09-30`.

However, when we want October 1st, we need to store `2025-10-01T00:00:00.000Z`.

## Solution

Use `Date.UTC()` to create dates in UTC timezone:

### Before (Broken)
```typescript
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
periodStart = monthStart.toISOString().split('T')[0];
// Result: 2025-09-30 (in UTC+1 timezone)
```

### After (Fixed)
```typescript
const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
periodStart = monthStart.toISOString().split('T')[0];
// Result: 2025-10-01 (always UTC)
```

## Files Changed

### Frontend
1. `tagtapgo-app/src/app/leaderboard/LeaderboardClient.tsx`
   - Fixed `fetchLeaderboard()` monthly calculation
   - Fixed `getUserPrimaryClass()` monthly calculation

2. `tagtapgo-app/src/components/LeaderboardPreview.tsx`
   - Fixed `fetchLeaderboard()` monthly calculation

### Backend
The backend already uses the correct logic in `getPeriodBoundaries()`, but we need to verify it's consistent.

## Testing

After the fix:
1. Monthly filter should show data
2. Class filter should show class leaderboard
3. All periods should work correctly

## Why This Matters

Timezone issues are subtle and can cause:
- Data appearing/disappearing based on user location
- Filters not working correctly
- Inconsistent behavior across deployments

Always use UTC for date calculations when storing/comparing dates across systems.
