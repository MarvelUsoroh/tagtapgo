# Supabase Email Templates Configuration

This document provides the email templates to configure in your Supabase project for token-based email confirmation.

## Setup Instructions

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Email Templates**
3. Update each template as shown below

---

## 1. Confirm Signup Template

**Template Name:** Confirm signup

**Subject:** Confirm Your Email - TagTapGo

**Body (HTML):**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Your Email</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #374151;
      background-color: #f3f4f6;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #4ADE80 0%, #22C55E 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content {
      padding: 40px 30px;
    }
    .content h2 {
      color: #111827;
      font-size: 24px;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .content p {
      margin-bottom: 20px;
      font-size: 16px;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background-color: #4ADE80;
      color: #ffffff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      transition: background-color 0.2s;
    }
    .button:hover {
      background-color: #22C55E;
    }
    .footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      font-size: 14px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      margin: 5px 0;
    }
    .footer a {
      color: #4ADE80;
      text-decoration: none;
    }
    .divider {
      border-top: 1px solid #e5e7eb;
      margin: 30px 0;
    }
    .note {
      background-color: #f0fdf4;
      border-left: 4px solid #4ADE80;
      padding: 15px;
      margin: 20px 0;
      font-size: 14px;
      color: #166534;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 TagTapGo</h1>
    </div>
    
    <div class="content">
      <h2>Confirm Your Email Address</h2>
      
      <p>Hi there! 👋</p>
      
      <p>Thanks for signing up for TagTapGo! We're excited to have you join thousands of students who are making attendance fun and rewarding.</p>
      
      <p>To get started, please confirm your email address by clicking the button below:</p>
      
      <div style="text-align: center;">
        <a href="{{ .SiteURL }}/confirm?token_hash={{ .TokenHash }}&type=signup" class="button">
          Confirm Email Address
        </a>
      </div>
      
      <div class="note">
        <strong>⏰ This link expires in 24 hours</strong><br>
        If you didn't create an account with TagTapGo, you can safely ignore this email.
      </div>
      
      <div class="divider"></div>
      
      <p style="font-size: 14px; color: #6b7280;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="{{ .SiteURL }}/confirm?token_hash={{ .TokenHash }}&type=signup" style="color: #4ADE80; word-break: break-all;">
          {{ .SiteURL }}/confirm?token_hash={{ .TokenHash }}&type=signup
        </a>
      </p>
    </div>
    
    <div class="footer">
      <p><strong>TagTapGo</strong></p>
      <p>Making attendance rewarding, one tap at a time</p>
      <p style="margin-top: 15px;">
        <a href="{{ .SiteURL }}">Visit Website</a> • 
        <a href="{{ .SiteURL }}/support">Support</a> • 
        <a href="{{ .SiteURL }}/privacy">Privacy Policy</a>
      </p>
      <p style="margin-top: 15px; font-size: 12px;">
        © 2024 TagTapGo. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
```

---

## 2. Magic Link Template

**Template Name:** Magic Link

**Subject:** Your TagTapGo Login Link

**Body (HTML):**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Login Link</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #374151;
      background-color: #f3f4f6;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #4ADE80 0%, #22C55E 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content {
      padding: 40px 30px;
    }
    .content h2 {
      color: #111827;
      font-size: 24px;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .content p {
      margin-bottom: 20px;
      font-size: 16px;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background-color: #4ADE80;
      color: #ffffff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      transition: background-color 0.2s;
    }
    .button:hover {
      background-color: #22C55E;
    }
    .footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      font-size: 14px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }
    .note {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      font-size: 14px;
      color: #92400e;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 TagTapGo</h1>
    </div>
    
    <div class="content">
      <h2>Your Login Link</h2>
      
      <p>Hi there! 👋</p>
      
      <p>Click the button below to log in to your TagTapGo account:</p>
      
      <div style="text-align: center;">
        <a href="{{ .SiteURL }}/confirm?token_hash={{ .TokenHash }}&type=magiclink" class="button">
          Log In to TagTapGo
        </a>
      </div>
      
      <div class="note">
        <strong>⚠️ Security Notice</strong><br>
        This link expires in 1 hour. If you didn't request this login link, please ignore this email.
      </div>
    </div>
    
    <div class="footer">
      <p>© 2024 TagTapGo. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## 3. Reset Password Template

**Template Name:** Reset Password

**Subject:** Reset Your TagTapGo Password

**Body (HTML):**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #374151;
      background-color: #f3f4f6;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #4ADE80 0%, #22C55E 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content {
      padding: 40px 30px;
    }
    .content h2 {
      color: #111827;
      font-size: 24px;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .content p {
      margin-bottom: 20px;
      font-size: 16px;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background-color: #4ADE80;
      color: #ffffff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      transition: background-color 0.2s;
    }
    .button:hover {
      background-color: #22C55E;
    }
    .footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      font-size: 14px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }
    .note {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      font-size: 14px;
      color: #92400e;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 TagTapGo</h1>
    </div>
    
    <div class="content">
      <h2>Reset Your Password</h2>
      
      <p>Hi there! 👋</p>
      
      <p>We received a request to reset your TagTapGo password. Click the button below to create a new password:</p>
      
      <div style="text-align: center;">
        <a href="{{ .SiteURL }}/update-password?token_hash={{ .TokenHash }}&type=recovery" class="button">
          Reset Password
        </a>
      </div>
      
      <div class="note">
        <strong>⚠️ Security Notice</strong><br>
        This link expires in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
      </div>
      
      <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="{{ .SiteURL }}/update-password?token_hash={{ .TokenHash }}&type=recovery" style="color: #4ADE80; word-break: break-all;">
          {{ .SiteURL }}/update-password?token_hash={{ .TokenHash }}&type=recovery
        </a>
      </p>
    </div>
    
    <div class="footer">
      <p>© 2024 TagTapGo. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## 4. Change Email Address Template

**Template Name:** Change Email Address

**Subject:** Confirm Your New Email - TagTapGo

**Body (HTML):**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Email Change</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #374151;
      background-color: #f3f4f6;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #4ADE80 0%, #22C55E 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content {
      padding: 40px 30px;
    }
    .content h2 {
      color: #111827;
      font-size: 24px;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .content p {
      margin-bottom: 20px;
      font-size: 16px;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background-color: #4ADE80;
      color: #ffffff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      transition: background-color 0.2s;
    }
    .button:hover {
      background-color: #22C55E;
    }
    .footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      font-size: 14px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }
    .note {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      font-size: 14px;
      color: #92400e;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 TagTapGo</h1>
    </div>
    
    <div class="content">
      <h2>Confirm Your New Email</h2>
      
      <p>Hi there! 👋</p>
      
      <p>We received a request to change your TagTapGo email address. Click the button below to confirm this change:</p>
      
      <div style="text-align: center;">
        <a href="{{ .SiteURL }}/confirm?token={{ .Token }}&type=email_change" class="button">
          Confirm Email Change
        </a>
      </div>
      
      <div class="note">
        <strong>⚠️ Security Notice</strong><br>
        If you didn't request this email change, please contact support immediately.
      </div>
    </div>
    
    <div class="footer">
      <p>© 2024 TagTapGo. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## Configuration Steps

### 1. Update Supabase Email Templates

1. Log in to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Authentication** → **Email Templates**
4. For each template above:
   - Click on the template name
   - Replace the default content with the HTML provided
   - Update the subject line
   - Click **Save**

### 2. Configure Site URL

Make sure your Site URL is configured correctly:

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to:
   - Development: `http://localhost:3000`
   - Production: `https://yourdomain.com`

### 3. Configure Redirect URLs

Add your confirmation page to allowed redirect URLs:

1. Go to **Authentication** → **URL Configuration**
2. Add to **Redirect URLs**:
   - `http://localhost:3000/confirm`
   - `https://yourdomain.com/confirm` (for production)

### 4. Test Email Delivery

1. Create a test account using the signup page
2. Check your email inbox
3. Click the confirmation link
4. Verify you're redirected to `/confirm` page
5. Confirm the email verification succeeds

---

## Template Variables

Supabase provides these variables for email templates:

- `{{ .Token }}` - The verification token
- `{{ .TokenHash }}` - Hashed version of the token
- `{{ .SiteURL }}` - Your configured site URL
- `{{ .Email }}` - User's email address
- `{{ .ConfirmationURL }}` - Auto-generated confirmation URL (not used in token-based flow)

---

## Troubleshooting

### Email not received
- Check spam/junk folder
- Verify SMTP settings in Supabase
- Check email template is saved correctly

### Token expired error
- Tokens expire after 24 hours (signup) or 1 hour (password reset)
- Request a new confirmation email

### Confirmation fails
- Check browser console for errors
- Verify token parameter is in URL
- Ensure `/confirm` page is accessible
- Check Supabase logs for authentication errors

---

## Security Notes

1. **Token Expiration**: Tokens automatically expire for security
2. **One-time Use**: Each token can only be used once
3. **HTTPS Required**: Always use HTTPS in production
4. **Rate Limiting**: Supabase has built-in rate limiting for email sending

---

## Next Steps

After configuring email templates:

1. Test the complete signup flow
2. Test password reset flow
3. Test email change flow (if implemented)
4. Configure custom SMTP (optional, for branded emails)
5. Set up email analytics/monitoring

---

**Last Updated**: October 20, 2025
