# Supabase Push Notifications Setup Guide

This guide walks you through setting up server-side push notifications using Supabase Edge Functions.

## Prerequisites

- Supabase project created
- Supabase CLI installed: `npm install -g supabase`
- VAPID keys generated (see below)

## Step 1: Generate VAPID Keys

VAPID keys are required for Web Push notifications. Generate them using the `web-push` library:

```bash
# Install web-push globally
npm install -g web-push

# Generate VAPID keys
web-push generate-vapid-keys
```

You'll get output like:

```
Public Key: BEl62iUYgUivxIkv69yViEuiBIa-Ib27SzV8kFj_VPF...
Private Key: p6YrrVCOEdjXS7Wgx9_bR0iQNK8f5lECYYyWEM...
```

**Save these keys securely!** You'll need them for the next steps.

## Step 2: Set Up Supabase Secrets

Add your VAPID keys as Supabase secrets:

```bash
# Login to Supabase CLI
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Set secrets
supabase secrets set VAPID_PUBLIC_KEY="your-public-key-here"
supabase secrets set VAPID_PRIVATE_KEY="your-private-key-here"
supabase secrets set VAPID_SUBJECT="mailto:your-email@example.com"
```

## Step 3: Create Database Tables

Run this SQL in your Supabase SQL Editor:

```sql
-- Push subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id)
);

-- Notifications table (for history)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_student_id ON notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Enable Row Level Security
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for push_subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Users can update their own subscriptions"
  ON push_subscriptions FOR UPDATE
  USING (auth.uid() = student_id);

CREATE POLICY "Users can delete their own subscriptions"
  ON push_subscriptions FOR DELETE
  USING (auth.uid() = student_id);

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = student_id);
```

## Step 4: Deploy Edge Function

```bash
# Navigate to the backend project
cd tagtapgo-backend

# Deploy the edge function
supabase functions deploy send-push-notification

# Verify deployment
supabase functions list
```

**Note:** The Edge Function is located in `tagtapgo-backend/supabase/functions/send-push-notification/index.ts`

## Step 5: Update Environment Variables

Add the VAPID public key to your `.env.local`:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-public-key-here
```

Restart your dev server after adding this.

## Step 6: Test the Setup

### Using Browser Console

```javascript
// Subscribe to push notifications
const { subscribeToPushNotifications } = await import(
  "/src/lib/notifications.ts"
);
const subscription = await subscribeToPushNotifications("your-student-id");
console.log("Subscribed:", subscription);
```

### Option 3: Test Edge Function Directly

```bash
# Using curl (must use a USER access token, not the anon key)
# Get a user access token from your app session and paste below
curl -X POST https://your-project-ref.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "<same-user-id-as-token>",
    "title": "Test Notification",
    "body": "This is a test from Supabase!",
    "data": { "type": "test" }
  }'
```

For internal server-to-server usage (cron jobs, other Edge Functions), you can authenticate using the Service Role key:

```bash
curl -X POST https://your-project-ref.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "student-uuid-here",
    "title": "Internal Send",
    "body": "Sent by a trusted job",
    "data": { "type": "internal-test" }
  }'
```

## Step 7: Trigger Notifications from Your App

Update your notification trigger functions to call the Edge Function:

```typescript
// Example: Trigger achievement notification
async function triggerAchievementNotification(
  studentId: string,
  achievementName: string,
  points: number
) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push-notification`,
    {
      method: "POST",
      headers: {
        // Use a USER access token so users can only notify themselves
        Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        studentId,
        title: "Achievement Unlocked! 🏆",
        body: `You earned "${achievementName}" and ${points} points!`,
        data: {
          type: "achievement",
          achievementName,
          points,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to send notification");
  }

  return response.json();
}
```

## Alternative: Simpler Client-Only Approach (For Testing)

If you want to test notifications without setting up the Edge Function, you can use local notifications:

```typescript
import { showLocalNotification } from "@/lib/notifications";

// This shows a notification directly from the client
await showLocalNotification(
  "Achievement Unlocked!",
  'You earned "Early Bird" and 50 points!',
  { type: "achievement" }
);
```

**Note:** This only works when the app is open. For real push notifications (when app is closed), you need the Edge Function.

## Troubleshooting

### "No subscription found"

- Make sure the user has granted notification permission
- Check that the subscription was saved to the database
- Verify the student_id is correct

### "VAPID keys not set"

- Run `supabase secrets list` to verify secrets are set
- Make sure you deployed the function after setting secrets
- Redeploy: `supabase functions deploy send-push-notification`

### "Subscription invalid (410/404)"

- The subscription has expired or been revoked
- The function will automatically remove invalid subscriptions
- User needs to re-subscribe

### Edge Function not working

- Check function logs: `supabase functions logs send-push-notification`
- Verify the function is deployed: `supabase functions list`
- Check that secrets are set: `supabase secrets list`

## Production Checklist

- [ ] VAPID keys generated and stored securely
- [ ] Supabase secrets configured
- [ ] Database tables created with RLS policies
- [ ] Edge function deployed
- [ ] Environment variables set in production
- [ ] Test notifications working
- [ ] Notification preferences respected
- [ ] Invalid subscriptions cleaned up automatically
- [ ] Notification history stored in database

## Cost Considerations

- Supabase Edge Functions: Free tier includes 500K invocations/month
- Database storage: Minimal (subscriptions + notification history)
- Web Push: Free (no third-party service needed)

## Security Notes

- VAPID private key must be kept secret (never expose to client)
- Use Row Level Security (RLS) on all tables
- Validate all input in Edge Function
- Respect user notification preferences
- Provide easy opt-out mechanism

## Next Steps

1. Set up scheduled notifications (e.g., streak reminders)
2. Implement notification batching for efficiency
3. Add notification analytics
4. Create admin dashboard for sending bulk notifications
5. Implement notification templates

## Resources

- [Web Push Protocol](https://datatracker.ietf.org/doc/html/rfc8030)
- [VAPID Specification](https://datatracker.ietf.org/doc/html/rfc8292)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Web Push for Deno](https://deno.land/x/web_push)

---

**Need Help?** Check the Supabase function logs for detailed error messages:

```bash
supabase functions logs send-push-notification --tail
```
