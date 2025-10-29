# Token-Based Email Confirmation Setup

## Overview

The authentication system now uses **token-based email confirmation** instead of Supabase's default `ConfirmationURL`. This provides more control over the confirmation flow and better user experience. We standardize on passing the hashed token via the `token_hash` query param.

## What Changed

### Before (Default Supabase)
```html
<a href="{{ .ConfirmationURL }}">Confirm your mail</a>
```
- Uses Supabase's auto-generated confirmation URL
- Less control over the confirmation page
- Limited customization options

### After (Token-Based, using TokenHash)
```html
<a href="{{ .SiteURL }}/confirm?token_hash={{ .TokenHash }}&type=signup">Confirm your mail</a>
```
- Uses custom `/confirm` page with full control
- Hashed token passed as `token_hash` URL parameter
- Better error handling and user feedback
- Consistent branding and UX

## Implementation Details

### 1. Email Confirmation Page (`/confirm`)
- **File**: `src/app/confirm/page.tsx`
- **URL**: `https://yourdomain.com/confirm?token_hash=xxx&type=signup`
- **Handles**:
  - Email signup confirmation (`type=signup`)
  - Magic link login (`type=magiclink`)
  - Email change confirmation (`type=email_change`)

### 2. Password Reset Flow
- **Reset Request**: User enters email on `/reset-password`
- **Email Sent**: Contains link to `/update-password?token_hash=xxx&type=recovery`
- **Update Page**: `src/app/update-password/page.tsx` verifies token and allows password change

### 3. Token Verification
Uses Supabase's `verifyOtp()` method with the correct type:
```typescript
await supabase.auth.verifyOtp({
  token_hash: token,
   type: 'signup', // 'signup' for email confirmation; 'recovery' for reset; 'magiclink' or 'email_change' as applicable
});
```

## Setup Instructions

### Step 1: Configure Supabase Email Templates

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Authentication** → **Email Templates**
4. Update each template according to `SUPABASE_EMAIL_TEMPLATES.md`

**Key Templates to Update**:
- ✅ Confirm Signup
- ✅ Magic Link
- ✅ Reset Password
- ✅ Change Email Address

### Step 2: Set Site URL

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL**:
   - Development: `http://localhost:3000`
   - Production: `https://yourdomain.com`

### Step 3: Add Redirect URLs

Add these to **Redirect URLs** (under URL Configuration):
- `http://localhost:3000/confirm`
- `http://localhost:3000/update-password`
- `https://yourdomain.com/confirm` (production)
- `https://yourdomain.com/update-password` (production)

### Step 4: Test the Flow

1. **Signup Test**:
   ```
   1. Go to /signup
   2. Fill in the form
   3. Submit
   4. Check email inbox
   5. Click confirmation link
   6. Should redirect to /confirm
   7. Should show success and redirect to /login
   ```

2. **Password Reset Test**:
   ```
   1. Go to /reset-password
   2. Enter email
   3. Check email inbox
   4. Click reset link
   5. Should redirect to /update-password
   6. Enter new password
   7. Should redirect to /login
   ```

## Email Template Variables

Available in all Supabase email templates:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{ .Token }}` | Verification token | `abc123...` |
| `{{ .TokenHash }}` | Hashed token | `xyz789...` |
| `{{ .SiteURL }}` | Your site URL | `https://yourdomain.com` |
| `{{ .Email }}` | User's email | `user@example.com` |
| `{{ .ConfirmationURL }}` | Auto-generated URL (not used) | - |

## Token Types

| Type | Use Case | Expiry |
|------|----------|--------|
| `signup` | Email signup confirmation | 24 hours |
| `recovery` | Password reset | 1 hour |
| `magiclink` | Passwordless login | 1 hour |
| `email_change` | Email address change | 24 hours |

## Security Features

1. **Token Expiration**: All tokens expire automatically
2. **One-Time Use**: Each token can only be used once
3. **Type Validation**: Token type must match the operation
4. **HTTPS Required**: Always use HTTPS in production
5. **Rate Limiting**: Supabase has built-in rate limiting

## Troubleshooting

### Email Not Received
- Check spam/junk folder
- Verify SMTP settings in Supabase
- Check email template is saved correctly
- Verify Site URL is configured

### Token Expired/Invalid Error
- Tokens expire after 24 hours (signup) or 1 hour (password reset)
- Ensure your template passes `token_hash={{ .TokenHash }}` and the correct `type`
- Request a new confirmation email
- Check system time is correct

### Confirmation Fails
- Check browser console for errors
- Verify URL contains `token_hash` (our confirm page tolerates `token`/`code` for legacy links)
- Ensure `/confirm` page is accessible
- Check Supabase logs for authentication errors
- Verify email template uses correct URL format and type (e.g., `type=signup`)

### Wrong Redirect
- Check Site URL in Supabase settings
- Verify Redirect URLs are configured
- Clear browser cache and cookies

## Benefits of Token-Based Approach

1. **Full Control**: Custom confirmation page with your branding
2. **Better UX**: Loading states, error messages, success animations
3. **Flexibility**: Handle multiple confirmation types in one place
4. **Analytics**: Track confirmation success/failure rates
5. **Debugging**: Easier to debug with custom error handling
6. **Consistency**: Same look and feel as rest of the app

## Migration from ConfirmationURL (or plain Token)

If you're migrating from the default `ConfirmationURL`:

1. Update email templates to use token-based URLs with `token_hash={{ .TokenHash }}`
2. Create `/confirm` page (already done)
3. Test all auth flows
4. Monitor for any issues
5. Update documentation

**No database changes required** - this is purely a frontend change.

## Related Files

- `src/app/confirm/page.tsx` - Email confirmation page
- `src/app/update-password/page.tsx` - Password update page
- `SUPABASE_EMAIL_TEMPLATES.md` - Complete email template guide
- `AUTH_IMPLEMENTATION.md` - Full authentication documentation

## Support

For issues or questions:
1. Check Supabase logs in Dashboard
2. Review browser console errors
3. Verify email template configuration
4. Test with different email providers
5. Check Supabase status page

---

**Last Updated**: October 23, 2025
