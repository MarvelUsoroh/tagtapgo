# Push Notification 401 Unauthorized - Fix Documentation

## Problem

The Edge Function `send-push-notification` was returning **401 Unauthorized** when called from the application.

### Error Message:

```
POST https://jbjdprrgckghfequgigc.supabase.co/functions/v1/send-push-notification 401 (Unauthorized)
Edge Function error: {code: 401, message: 'Invalid JWT'}
```

## Root Causes

### 1. Legacy JWT Verification Enabled

The primary issue was that **"Verify JWT with legacy secret"** was enabled in the Supabase Dashboard function settings. This setting requires JWTs signed with the legacy JWT secret, but the application uses the **new API key format** (`sb_publishable_...`) which generates JWTs with a different signing method.

**Solution:** Disable "Verify JWT with legacy secret" in the Supabase Dashboard and let the Edge Function code handle JWT validation using `supabaseAuth.auth.getUser(token)`.

### 2. @supabase/ssr Client Limitations

The application uses `@supabase/ssr`'s `createBrowserClient` for SSR/cookie-based authentication. However, **this client does NOT automatically attach JWT tokens to Edge Function invocations**.

**Why `@supabase/ssr` Doesn't Auto-Inject Headers:**

1. **SSR-Optimized Client**: `@supabase/ssr` is designed for Next.js server-side rendering with cookie-based auth
2. **No Auto-Auth for Functions**: Unlike the standard `@supabase/supabase-js` client, it doesn't automatically inject Authorization headers into `functions.invoke()` calls
3. **Missing Header**: The Edge Function expects `Authorization: Bearer <jwt>` but receives nothing → 401 Unauthorized

## Solution: Direct Fetch Call

**Bypass `supabase.functions.invoke()` and use direct `fetch()` to the Edge Function:**

Since `@supabase/ssr`'s `functions.invoke()` doesn't properly handle custom Authorization headers (they get stripped or overridden), we use a direct HTTP request with explicit headers.

### Implementation:

**Updated:** `src/lib/notification-triggers.ts`

```typescript
import { supabase } from './supabase';

async function sendNotification(...) {
  // Get current session and access token
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated. Please sign in to send notifications.');
  }

  // Use direct fetch because @supabase/ssr's functions.invoke() doesn't properly
  // handle custom Authorization headers
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const functionUrl = `${supabaseUrl}/functions/v1/send-push-notification`;

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': supabaseAnonKey,  // Required for JWT validation
    },
    body: JSON.stringify({
      studentId,
      title,
      body,
      data,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `Edge Function returned ${response.status}`);
  }

  return await response.json();
}
```

### Critical: Both Headers Required

The Edge Function requires **TWO headers** for proper operation:

1. **`Authorization: Bearer <jwt>`** - The user's JWT token for authentication
2. **`apikey: <anon_key>`** - The Supabase anon key (required by Supabase gateway)

## Changes Made

### 1. Supabase Dashboard Configuration

**Disabled "Verify JWT with legacy secret"** in Function Settings:

- Go to: Supabase Dashboard → Functions → send-push-notification
- Turn OFF "Verify JWT with legacy secret" toggle
- Click "Save changes"

This allows the function to accept JWTs from the new API key format.

### 2. Updated File: `src/lib/notification-triggers.ts`

- Validate user with `supabase.auth.getUser()` before sending
- Extract session and access token using `supabase.auth.getSession()`
- Build Edge Function URL: `${SUPABASE_URL}/functions/v1/send-push-notification`
- Use direct `fetch()` with explicit `Authorization: Bearer <token>` header
- Bypasses `supabase.functions.invoke()` which strips custom headers
- Works reliably with `@supabase/ssr` client

### 3. Updated Edge Function: `send-push-notification/index.ts`

- Fixed web-push module import: Changed from broken `deno.land/x/web_push@0.0.6` to working `npm:web-push@3.6.7`
- Validates JWT using `supabaseAuth.auth.getUser(token)` with anon key
- Uses service role key only for database operations (not for JWT validation)

## How It Works

### Authentication Flow:

**Client-Side:**

1. User logs in → Session stored in localStorage/cookies
2. When calling Edge Function:
   - Extract session: `await supabase.auth.getSession()`
   - Get access token: `session.access_token`
   - Add to headers: `Authorization: Bearer ${session.access_token}`
3. Edge Function receives request with Authorization header

**Edge Function:**

1. Reads `Authorization: Bearer <jwt>` header
2. Validates JWT using `supabaseAuth.auth.getUser(token)`
3. Extracts user ID from validated token
4. Proceeds with request if valid

## Testing

After this fix, the push notification flow works as follows:

1. **User logs in** → Session established
2. **Click "Subscribe to Push Notifications"** → Browser permission granted
3. **Trigger a server push notification** from the application
4. **Client extracts JWT** → From `supabase.auth.getSession()`
5. **Function invoked** → Direct fetch with Authorization header
6. **Edge Function validates** → Token validated with `auth.getUser()`
7. **Notification sent** → Success! ✅

## Verification Steps

1. Ensure you're logged in (check browser console for user ID)
2. Subscribe to push notifications through the application
3. Test server push notifications
4. Click "Test Server Push Notifications"
5. Check browser console - should see success messages
6. Check Supabase Edge Function logs for successful invocations

## Why This Solution Works

### ✅ Simple:

- Single Supabase client (SSR client)
- Explicit header management
- Easy to understand and debug

### ✅ Compatible with @supabase/ssr:

- Works with existing SSR setup
- No need for multiple client instances
- Leverages existing session management

### ✅ Production-Ready:

- Handles authentication properly
- Clear error messages
- Works with token refresh

### ✅ Maintainable:

- Straightforward implementation
- Easy to troubleshoot
- Minimal code changes

## Key Takeaways

### When using new Supabase API keys (sb*publishable*...):

- ❌ Don't enable "Verify JWT with legacy secret" in Dashboard
- ✅ Do disable it and handle JWT validation in function code
- ✅ Use `supabaseAuth.auth.getUser(token)` with anon key for validation

### When using `@supabase/ssr` for Edge Function calls:

- ❌ Don't use `supabase.functions.invoke()` - it strips custom headers
- ✅ Do use direct `fetch()` to Edge Function URL
- ✅ Manually add `Authorization: Bearer ${session.access_token}` header
- ✅ Extract token from `supabase.auth.getSession()`

## Why Direct Fetch Works

`@supabase/ssr`'s `functions.invoke()` method has internal logic that overrides or strips custom Authorization headers. By using a direct `fetch()` call, we have full control over the HTTP request and can ensure the Authorization header reaches the Edge Function.

## Important: Function Redeployment

**Note:** When you redeploy an Edge Function using `supabase functions deploy`, the "Verify JWT with legacy secret" toggle may get re-enabled automatically. After each deployment, verify the toggle is still OFF in the Dashboard.

## Related Files

- `tagtapgo-app/src/lib/notification-triggers.ts` - Client-side notification triggers with direct fetch
- `tagtapgo-app/src/lib/supabase.ts` - SSR Supabase client
- `tagtapgo-backend/supabase/functions/send-push-notification/index.ts` - Edge Function

## References

- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase JS Client Functions API](https://supabase.com/docs/reference/javascript/functions-invoke)
