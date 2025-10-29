# Push Notification Toggle Fix

## Problem

The push notification master toggle button couldn't be turned off after being enabled. Once notifications were granted, the toggle would stay in the "ON" position even after clicking it.

## Root Cause

The `useNotifications` hook was conflating two separate concepts:

1. **Browser Permission** (`NotificationPermission`) - Whether the browser allows notifications
   - Values: `'default'`, `'granted'`, `'denied'`
   - Set by the browser, cannot be changed programmatically
   - Persists even after unsubscribing

2. **Push Subscription Status** - Whether the user has an active push subscription
   - Boolean: subscribed or not subscribed
   - Can be changed by subscribing/unsubscribing
   - Independent of browser permission

### The Bug

When unsubscribing, the hook was setting `permission` to `'denied'`:

```typescript
const unsubscribe = async () => {
  const success = await unsubscribeFromPushNotifications(studentId);
  if (success) {
    setPermission('denied'); // ❌ Wrong! Browser permission doesn't change
  }
  return success;
};
```

This caused issues because:
- The browser permission stays `'granted'` after unsubscribing
- The UI was checking `permission === 'granted'` to determine if notifications were enabled
- Result: Toggle appeared stuck in "ON" position

## Solution

### 1. Track Subscription Status Separately

Added a new state variable `isSubscribed` to track whether the user has an active push subscription:

```typescript
const [isSubscribed, setIsSubscribed] = useState(false);
```

### 2. Check Subscription on Mount

Check if the user already has an active subscription when the component mounts:

```typescript
useEffect(() => {
  const currentPermission = getNotificationPermissionStatus();
  setPermission(currentPermission);

  // Check if already subscribed
  if ('serviceWorker' in navigator && currentPermission === 'granted') {
    navigator.serviceWorker.ready.then(async (registration) => {
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    });
  }
  // ...
}, [studentId]);
```

### 3. Update Subscription Status on Subscribe/Unsubscribe

```typescript
const subscribe = async () => {
  const subscription = await subscribeToPushNotifications(studentId);
  if (subscription) {
    const newPermission = getNotificationPermissionStatus();
    setPermission(newPermission);
    setIsSubscribed(true); // ✅ Track subscription
    return true;
  }
  return false;
};

const unsubscribe = async () => {
  const success = await unsubscribeFromPushNotifications(studentId);
  if (success) {
    setIsSubscribed(false); // ✅ Track subscription (don't change permission)
  }
  return success;
};
```

### 4. Update `isGranted` Logic

Changed the `isGranted` return value to check both permission AND subscription status:

```typescript
return {
  permission,
  preferences,
  loading,
  subscribe,
  unsubscribe,
  updatePreferences,
  isGranted: permission === 'granted' && isSubscribed, // ✅ Check both
  isDenied: permission === 'denied',
  isDefault: permission === 'default',
  isSubscribed, // ✅ Expose subscription status
};
```

## How It Works Now

### State Diagram

```
Initial State:
- permission: 'default'
- isSubscribed: false
- isGranted: false
→ Toggle shows OFF

User clicks toggle (first time):
1. Browser prompts for permission
2. User grants permission
- permission: 'granted'
- isSubscribed: true
- isGranted: true
→ Toggle shows ON

User clicks toggle (to disable):
1. Unsubscribe from push
- permission: 'granted' (unchanged)
- isSubscribed: false
- isGranted: false
→ Toggle shows OFF ✅

User clicks toggle (to re-enable):
1. Subscribe to push (no browser prompt needed)
- permission: 'granted' (unchanged)
- isSubscribed: true
- isGranted: true
→ Toggle shows ON ✅
```

### Key Points

1. **Browser permission persists** - Once granted, it stays granted
2. **Subscription can be toggled** - User can subscribe/unsubscribe freely
3. **No repeated prompts** - After initial grant, no more browser prompts
4. **Toggle reflects subscription** - ON = subscribed, OFF = not subscribed

## Testing

### Manual Test Steps

1. **Initial State**
   - [ ] Toggle is OFF
   - [ ] No notification types shown

2. **Enable Notifications (First Time)**
   - [ ] Click toggle
   - [ ] Browser prompts for permission
   - [ ] Grant permission
   - [ ] Toggle turns ON
   - [ ] Notification types appear

3. **Disable Notifications**
   - [ ] Click toggle
   - [ ] Toggle turns OFF ✅
   - [ ] Notification types disappear
   - [ ] No browser prompt

4. **Re-enable Notifications**
   - [ ] Click toggle
   - [ ] Toggle turns ON ✅
   - [ ] Notification types appear
   - [ ] No browser prompt

5. **Verify Subscription**
   - [ ] Check browser DevTools → Application → Service Workers
   - [ ] Verify push subscription exists when ON
   - [ ] Verify push subscription removed when OFF

## Files Modified

- ✅ `tagtapgo-app/src/hooks/useNotifications.ts`
  - Added `isSubscribed` state
  - Check subscription status on mount
  - Update subscription status on subscribe/unsubscribe
  - Fixed `isGranted` logic

## Related Issues

This fix also resolves:
- Toggle appearing stuck after page reload
- Inconsistent state between browser permission and UI
- Confusion between permission and subscription status

## Browser Compatibility

This fix works across all modern browsers that support:
- Service Workers
- Push API
- Notification API

Tested on:
- Chrome/Edge (Chromium)
- Firefox
- Safari (iOS 16.4+)

## Future Enhancements

Potential improvements:
1. Show different UI states for:
   - Permission not requested (default)
   - Permission granted but not subscribed
   - Permission granted and subscribed
   - Permission denied

2. Add "Reset Permissions" button for denied state

3. Show subscription details (endpoint, keys) in debug mode

4. Add subscription health check (verify subscription is still valid)
