# Push Notifications Implementation

This document describes the push notification system implemented for the TagTapGo student PWA.

## Overview

The notification system allows students to receive timely push notifications about:
- Streak reminders (2 hours before class)
- Achievement unlocks
- Challenge invitations
- Leaderboard rank changes
- Reward redemption confirmations

## Architecture

### Components

1. **Service Worker** (`public/sw.js`)
   - Handles push events from the push service
   - Manages notification display
   - Routes notification clicks to appropriate pages
   - Implements offline caching

2. **Notification Library** (`src/lib/notifications.ts`)
   - Service worker registration
   - Permission management
   - Push subscription handling
   - Preference management

3. **Notification Triggers** (`src/lib/notification-triggers.ts`)
   - Functions to trigger specific notification types
   - Checks user preferences before sending
   - Stores notifications in database

4. **UI Components**
   - `NotificationPermissionPrompt`: Prompts users to enable notifications
   - `ServiceWorkerRegistration`: Auto-registers service worker on app load
   - `NotificationSettingsPage`: Allows users to manage preferences

5. **Custom Hook** (`src/hooks/useNotifications.ts`)
   - Manages notification state
   - Provides subscribe/unsubscribe functions
   - Handles preference updates

## Database Schema

### Required Tables

```sql
-- Push subscriptions table
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id)
);

-- Notifications table (for history and unread tracking)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_notifications_student_id ON notifications(student_id);
CREATE INDEX idx_notifications_read ON notifications(read);
```

### Student Settings

Notification preferences are stored in the `students.settings` JSONB field:

```json
{
  "notifications": {
    "streak_risk": true,
    "achievement_unlocked": true,
    "challenge_invitation": true,
    "rank_change": true,
    "reward_redemption": true
  }
}
```

## Setup Instructions

### 1. Environment Variables

Add to `.env.local`:

```env
# VAPID keys for push notifications (generate using web-push library)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
```

To generate VAPID keys:

```bash
npm install -g web-push
web-push generate-vapid-keys
```

### 2. Database Setup

Run the SQL schema above in your Supabase SQL editor.

### 3. Backend Integration

For production, you'll need to implement actual push notification sending using a library like `web-push`:

```typescript
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// Send notification
const subscription = /* get from database */;
const payload = JSON.stringify({
  title: 'Achievement Unlocked!',
  body: 'You earned "Early Bird" and 50 points!',
  data: { type: 'achievement' }
});

await webpush.sendNotification(subscription, payload);
```

## Usage

### Requesting Permission

The notification permission prompt automatically appears on the dashboard for users who haven't granted or denied permission yet.

Users can also enable notifications from:
- Profile → Notifications
- Settings → Notifications

### Triggering Notifications

Use the trigger functions from `notification-triggers.ts`:

```typescript
import {
  triggerStreakRiskNotification,
  triggerAchievementUnlockedNotification,
  triggerChallengeInvitationNotification,
  triggerRankChangeNotification,
  triggerRewardRedemptionNotification,
} from '@/lib/notification-triggers';

// Example: Achievement unlocked
await triggerAchievementUnlockedNotification(
  studentId,
  'Early Bird',
  'Attend 5 classes before 9 AM',
  50
);
```

### Managing Preferences

Users can toggle individual notification types in the settings page:
- Navigate to Profile → Notifications
- Toggle each notification type on/off
- Changes are saved automatically

## Notification Types

### 1. Streak Risk
- **Trigger**: 2 hours before class
- **Purpose**: Remind students to attend class to maintain streak
- **Data**: `{ type: 'streak', className, classTime, currentStreak }`

### 2. Achievement Unlocked
- **Trigger**: When achievement criteria is met
- **Purpose**: Celebrate accomplishments
- **Data**: `{ type: 'achievement', achievementName, achievementDescription, pointsEarned }`

### 3. Challenge Invitation
- **Trigger**: When another student sends a challenge
- **Purpose**: Engage students in friendly competition
- **Data**: `{ type: 'challenge', challengeName, inviterName, challengeId }`

### 4. Rank Change
- **Trigger**: When leaderboard position changes significantly
- **Purpose**: Keep students engaged with competition
- **Data**: `{ type: 'rank', oldRank, newRank, leaderboardType, isImprovement }`

### 5. Reward Redemption
- **Trigger**: When reward is successfully redeemed
- **Purpose**: Confirm redemption and provide code
- **Data**: `{ type: 'reward', rewardName, redemptionCode, expiresAt }`

## Testing

### Local Testing

1. Run the app in development:
   ```bash
   npm run dev
   ```

2. Open the app in a browser (Chrome recommended)

3. Grant notification permission when prompted

4. Test local notifications:
   ```typescript
   import { showLocalNotification } from '@/lib/notifications';
   
   await showLocalNotification(
     'Test Notification',
     'This is a test message',
     { type: 'test' }
   );
   ```

### Production Testing

1. Deploy to a hosting service (Vercel recommended)
2. Ensure HTTPS is enabled (required for service workers)
3. Test on mobile devices (iOS Safari, Android Chrome)
4. Verify notifications appear even when app is closed

## Browser Support

- ✅ Chrome/Edge (Desktop & Android)
- ✅ Firefox (Desktop & Android)
- ✅ Safari (Desktop & iOS 16.4+)
- ❌ iOS Safari < 16.4 (no push notification support)

## Troubleshooting

### Notifications not appearing

1. Check browser permission status
2. Verify service worker is registered: DevTools → Application → Service Workers
3. Check console for errors
4. Ensure HTTPS is enabled (required for service workers)

### Permission denied

Users must manually enable notifications in browser settings if they previously denied permission.

### Service worker not updating

1. Unregister old service worker: DevTools → Application → Service Workers → Unregister
2. Clear cache and reload
3. Ensure `skipWaiting()` is called in service worker

## Future Enhancements

- [ ] Rich notifications with images
- [ ] Notification actions (e.g., "View Achievement", "Dismiss")
- [ ] Scheduled notifications (e.g., daily summary)
- [ ] Notification grouping
- [ ] Sound customization
- [ ] Do Not Disturb mode
- [ ] Notification history page

## Security Considerations

- VAPID keys should be kept secret (private key never exposed to client)
- Validate all notification data on the server
- Implement rate limiting to prevent spam
- Respect user preferences at all times
- Provide easy opt-out mechanism

## References

- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [VAPID Protocol](https://datatracker.ietf.org/doc/html/rfc8292)
