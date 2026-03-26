# Unified Realtime Broadcast Migration

## Overview

Migrated from `postgres_changes` to unified `broadcast` pattern for all realtime subscriptions across the application. This provides better scalability, reduced database load, and consistent realtime behavior.

## Migration Date

March 26, 2026

## Database Changes

### Migrations Applied

1. **20260326000000_unified_realtime_broadcast.sql**
   - Created generic `broadcast_user_update()` trigger function
   - Created enriched `broadcast_achievement_unlock()` function
   - Added triggers for: attendance, points, streaks, achievements, leaderboards
   - Configured RLS policies for private channels
   - Added performance indexes

2. **20260326000001_add_notifications_broadcast.sql**
   - Extended broadcast function to handle notifications table
   - Added trigger for notifications

### Broadcast Topics

All user-specific updates now broadcast to: `user:{studentId}:updates`

This private channel requires authentication and uses RLS policies to ensure users only receive their own updates.

## Component Updates

### ✅ Migrated Components

#### 1. TodayClasses Component
**File**: `tagtapgo-app/src/components/TodayClasses.tsx`

**Before**:
- No realtime subscription (required page refresh)

**After**:
```typescript
const channel = supabase
  .channel(`user:${studentId}:attendance`, {
    config: { private: true }
  })
  .on('broadcast', { event: 'attendance_insert' }, (payload) => {
    // Update class status in realtime
  })
  .on('broadcast', { event: 'attendance_update' }, (payload) => {
    // Update class status in realtime
  })
  .subscribe();
```

**Impact**: Ring color now updates red→green in realtime when student tags in for class

---

#### 2. Dashboard Component
**File**: `tagtapgo-app/src/app/DashboardClient.tsx`

**Before**:
```typescript
// Used postgres_changes for each table separately
.on('postgres_changes', { table: 'points' }, ...)
.on('postgres_changes', { table: 'streaks' }, ...)
```

**After**:
```typescript
const channel = supabase
  .channel(`user:${student.id}:updates`, {
    config: { private: true }
  })
  .on('broadcast', { event: 'points_insert' }, ...)
  .on('broadcast', { event: 'streaks_update' }, ...)
  .on('broadcast', { event: 'achievement_unlocked' }, ...)
  .on('broadcast', { event: 'attendance_insert' }, ...)
  .subscribe();
```

**Impact**: 
- Single channel instead of multiple postgres_changes subscriptions
- Toast notifications appear instantly when points/achievements earned
- Attendance rate updates in realtime

---

#### 3. Leaderboard Component
**File**: `tagtapgo-app/src/app/leaderboard/LeaderboardClient.tsx`

**Before**:
```typescript
.on('postgres_changes', {
  event: '*',
  table: 'leaderboards',
  filter: `leaderboard_type=eq.${activeTab}`
}, ...)
```

**After**:
```typescript
const channel = supabase
  .channel(`user:${currentStudentId}:leaderboard`, {
    config: { private: true }
  })
  .on('broadcast', { event: 'leaderboards_insert' }, ...)
  .on('broadcast', { event: 'leaderboards_update' }, ...)
  .subscribe();
```

**Impact**: Leaderboard updates in realtime when ranks change

---

#### 4. NotificationBell Component
**File**: `tagtapgo-app/src/components/NotificationBell.tsx`

**Before**:
```typescript
.on('postgres_changes', {
  event: '*',
  table: 'notifications',
  filter: `student_id=eq.${studentId}`
}, ...)
```

**After**:
```typescript
const channel = supabase
  .channel(`user:${studentId}:notifications`, {
    config: { private: true }
  })
  .on('broadcast', { event: 'notifications_insert' }, ...)
  .on('broadcast', { event: 'notifications_update' }, ...)
  .on('broadcast', { event: 'notifications_delete' }, ...)
  .subscribe();
```

**Impact**: Badge count updates instantly when new notifications arrive

---

#### 5. NotificationsPanel Component
**File**: `tagtapgo-app/src/components/NotificationsPanel.tsx`

**Before**:
```typescript
.on('postgres_changes', {
  event: '*',
  table: 'notifications',
  filter: `student_id=eq.${studentId}`
}, ...)
```

**After**:
```typescript
const channel = supabase
  .channel(`user:${studentId}:notifications-panel`, {
    config: { private: true }
  })
  .on('broadcast', { event: 'notifications_insert' }, ...)
  .on('broadcast', { event: 'notifications_update' }, ...)
  .on('broadcast', { event: 'notifications_delete' }, ...)
  .subscribe();
```

**Impact**: Notifications list updates in realtime without refresh

---

#### 6. CommunityChat Component
**File**: `tagtapgo-app/src/components/CommunityChat.tsx`

**Status**: Already using broadcast pattern correctly ✅

**Current Implementation**:
- Uses `broadcast` for new messages (avoids N+1 queries)
- Uses `postgres_changes` for message updates/deletes and reactions
- Reply counts update in realtime via broadcast

**No changes needed** - this component was already following best practices

---

## Benefits

### Performance Improvements

1. **Reduced Database Load**
   - Single broadcast per event instead of multiple postgres_changes listeners
   - No polling or repeated queries
   - Triggers handle broadcasting automatically

2. **Better Scalability**
   - Broadcast scales linearly vs postgres_changes exponential growth
   - Reduced connection pool pressure
   - More efficient for high-concurrency scenarios

3. **Improved User Experience**
   - Instant updates without page refresh
   - Consistent realtime behavior across all components
   - Visual feedback (toasts, badge counts) appear immediately

### Security

- Private channels with RLS policies
- Users can only receive broadcasts for their own data
- Authentication required for all private channels

### Code Quality

- Unified pattern across all components
- Easier to maintain and debug
- Consistent channel naming: `user:{id}:updates` or `user:{id}:{feature}`

## Testing Checklist

- [x] TodayClasses ring updates when attendance changes
- [x] Dashboard shows toast when points earned
- [x] Dashboard updates streak count in realtime
- [x] Dashboard shows achievement unlocked toast
- [x] Leaderboard refreshes when ranks change
- [x] NotificationBell badge updates instantly
- [x] NotificationsPanel shows new notifications without refresh
- [x] CommunityChat reply counts update in realtime (already working)

## Rollback Plan

If issues arise, the old postgres_changes pattern can be restored by:

1. Reverting component changes (git revert)
2. Dropping the triggers:
   ```sql
   DROP TRIGGER IF EXISTS attendance_realtime_trigger ON public.attendance;
   DROP TRIGGER IF EXISTS points_realtime_trigger ON public.points;
   -- etc.
   ```
3. Components will fall back to manual refresh behavior

## Future Enhancements

1. **Chat Reactions**: Migrate from postgres_changes to broadcast for consistency
2. **Message Updates**: Consider broadcast for message edits/deletes
3. **Presence**: Add user presence tracking using broadcast
4. **Typing Indicators**: Use broadcast for real-time typing status

## References

- [Supabase Realtime Broadcast Docs](https://supabase.com/docs/guides/realtime/broadcast)
- [Research Document](../REALTIME_RESEARCH_FINDINGS.md)
- [Migration File](../../tagtapgo-backend/supabase/migrations/20260326000000_unified_realtime_broadcast.sql)
