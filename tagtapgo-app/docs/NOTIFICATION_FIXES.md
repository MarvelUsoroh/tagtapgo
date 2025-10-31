# Notification System Fixes

## Issues Fixed

### 1. ✅ Unread Count Inconsistency Between Badge and Panel

**Problem**: Bell badge showed 20 unread, but panel header showed 17 unread.

**Root Cause**: Panel was counting unread from only the 20 most recent notifications it fetched (due to `limit(20)`), while the bell badge was counting ALL unread notifications in the database.

**Solution**: Added separate query to fetch total unread count in `NotificationsPanel.tsx`:

```typescript
// Fetch recent notifications (limited to 20)
const { data } = await supabase
  .from('notifications')
  .select('*')
  .eq('student_id', studentId)
  .order('created_at', { ascending: false })
  .limit(20);

// Fetch total unread count (all notifications)
const { count } = await supabase
  .from('notifications')
  .select('*', { count: 'exact', head: true })
  .eq('student_id', studentId)
  .eq('read', false);

setTotalUnreadCount(count || 0);
```

**Result**: 
- Badge and panel header now show the same unread count
- Panel shows "(showing 20 most recent)" when there are more than 20 unread
- Consistent user experience across components

---

### 2. ✅ Notifications Not Redirecting When Clicked

**Problem**: Clicking on notifications didn't navigate to the relevant page.

**Root Cause**: Notifications in the database didn't have a `url` field in their `data` column.

**Solution**: Added default URL mapping based on notification type in `NotificationsPanel.tsx`:

```typescript
switch (notification.notification_type) {
  case 'achievement':
  case 'achievement_unlocked':
    url = '/achievements';
    break;
  case 'rank':
    url = '/leaderboard';
    break;
  case 'streak':
    url = '/';
    break;
  case 'feedback_prompt':
    url = `/feedback/${notification.data.promptId}` || '/feedback';
    break;
  case 'perfect_week':
  case 'perfect_month':
    url = '/profile';
    break;
  default:
    url = '/';
}
```

**Result**: Clicking notifications now navigates to the appropriate page.

---

### 3. ✅ Unread Count Not Updating When Notifications Marked as Read

**Problem**: The bell badge count didn't update when notifications were marked as read in the panel.

**Root Cause**: No real-time subscription in the NotificationsPanel to refresh data after marking as read.

**Solution**: Added Supabase real-time subscription in `NotificationsPanel.tsx`:

```typescript
const channel = supabase
  .channel('notifications-panel')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'notifications',
    filter: `student_id=eq.${studentId}`,
  }, () => {
    fetchNotifications();
  })
  .subscribe();
```

**Result**: 
- Badge count updates immediately when notifications are marked as read
- Panel refreshes automatically when new notifications arrive
- Real-time synchronization between bell and panel

---

### 4. ✅ Duplicate Notifications Being Created

**Problem**: Two notifications were created for each achievement unlock:
- One with type `achievement_unlocked` (from achievement-checker)
- One with type `achievement` (from send-push-notification)

**Root Cause**: Both `achievement-checker.ts` and `send-push-notification` function were inserting notifications into the database.

**Flow Before Fix**:
```
achievement-checker.ts
  ↓
  1. Insert notification (type: achievement_unlocked)
  ↓
  2. Call send-push-notification
     ↓
     3. Insert notification (type: achievement) ← DUPLICATE!
     ↓
     4. Send push to device
```

**Solution**: Removed the database insert from `achievement-checker.ts` and let only `send-push-notification` handle it:

**File**: `tagtapgo-backend/supabase/functions/_shared/services/achievement-checker.ts`

**Before**:
```typescript
async function sendAchievementNotification(...) {
  // Store notification in database
  await supabase.from('notifications').insert({...}); // ← REMOVED THIS
  
  // Send push notification
  await sendPush(...);
}
```

**After**:
```typescript
async function sendAchievementNotification(...) {
  // Send push notification (which will also store in database)
  await sendPush(...);
}
```

**Flow After Fix**:
```
achievement-checker.ts
  ↓
  1. Call send-push-notification
     ↓
     2. Insert notification (type: achievement) ← SINGLE NOTIFICATION
     ↓
     3. Send push to device
```

**Result**: Only one notification is created per achievement unlock.

---

## Files Modified

### Frontend
1. **tagtapgo-app/src/components/NotificationsPanel.tsx**
   - Added default URL mapping for navigation
   - Added real-time subscription for updates
   - Improved notification click handling

### Backend
2. **tagtapgo-backend/supabase/functions/_shared/services/achievement-checker.ts**
   - Removed duplicate database insert
   - Updated comments to explain the flow
   - Simplified notification sending logic

---

## Testing Checklist

### Notification Redirect
- [ ] Click achievement notification → navigates to `/achievements`
- [ ] Click rank notification → navigates to `/leaderboard`
- [ ] Click streak notification → navigates to `/`
- [ ] Click feedback prompt → navigates to `/feedback/[id]`
- [ ] Click perfect week/month → navigates to `/profile`

### Unread Count Update
- [ ] Open notifications panel
- [ ] Click "Mark all as read"
- [ ] Verify badge count updates to 0
- [ ] Click individual notification
- [ ] Verify badge count decreases by 1
- [ ] Unlock new achievement
- [ ] Verify badge count increases by 1

### No Duplicates
- [ ] Unlock an achievement
- [ ] Check notifications table in database
- [ ] Verify only ONE notification created
- [ ] Check notification panel
- [ ] Verify only ONE notification displayed

---

## Database Queries for Verification

### Check for Duplicate Notifications
```sql
-- Find duplicate notifications (same student, same achievement, same time)
SELECT 
  student_id,
  notification_type,
  title,
  created_at,
  COUNT(*) as count
FROM notifications
WHERE notification_type IN ('achievement', 'achievement_unlocked')
  AND created_at >= NOW() - INTERVAL '1 hour'
GROUP BY student_id, notification_type, title, created_at
HAVING COUNT(*) > 1;
```

### Check Notification Types
```sql
-- See distribution of notification types
SELECT 
  notification_type,
  COUNT(*) as count
FROM notifications
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY notification_type
ORDER BY count DESC;
```

### Check Unread Notifications
```sql
-- Check unread count for test student
SELECT COUNT(*) as unread_count
FROM notifications
WHERE student_id = 'ab191d6e-e016-418b-80a1-0b2b25e007c7'
  AND read = false;
```

---

## Deployment Notes

### Backend Changes
The backend changes require redeploying the Edge Functions:

```bash
cd tagtapgo-backend
supabase functions deploy achievement-checker
```

Or deploy all functions:
```bash
supabase functions deploy
```

### Frontend Changes
The frontend changes will be deployed automatically on next build:

```bash
cd tagtapgo-app
npm run build
```

### No Database Migrations Required
All fixes are code-only changes. No database schema changes needed.

---

## Expected Behavior After Fixes

### User Experience
1. **Click Notification** → Immediately navigates to relevant page
2. **Mark as Read** → Badge count updates in real-time
3. **New Achievement** → Only one notification appears
4. **Panel Updates** → Automatically refreshes when changes occur

### System Behavior
1. **One Notification Per Event** → No duplicates in database
2. **Real-time Sync** → Bell and panel stay synchronized
3. **Proper Navigation** → Each notification type has correct destination
4. **Clean Data** → No orphaned or duplicate notifications

---

## Future Enhancements

### Potential Improvements
1. **Deep Linking Data**: Add specific URLs to notification data in backend
2. **Notification Actions**: Add action buttons (e.g., "View Achievement", "Dismiss")
3. **Notification Grouping**: Group similar notifications (e.g., "3 achievements unlocked")
4. **Read Receipts**: Track when notifications were actually viewed
5. **Notification History**: Archive old notifications instead of deleting
6. **Notification Preferences**: Per-type notification settings
7. **Batch Operations**: Mark multiple notifications as read at once
8. **Notification Search**: Search through notification history
9. **Notification Filters**: Filter by type, read/unread, date range
10. **Notification Analytics**: Track notification engagement metrics

---

## Related Documentation

- [Notification Bell Implementation](./NOTIFICATION_BELL_IMPLEMENTATION.md)
- [Achievement Test Results](../../tagtapgo-backend/docs/ACHIEVEMENT_TEST_RESULTS.md)
- [Push Notification Test Plan](../../tagtapgo-backend/docs/PUSH_NOTIFICATION_TEST_PLAN.md)

---

**Fix Date**: 2025-10-30  
**Status**: ✅ Complete  
**Tested**: Pending deployment verification
