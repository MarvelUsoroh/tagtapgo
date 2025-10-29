# TagTapGo Deployment Guide

## Prerequisites

- GitHub account
- Vercel account (free tier works)
- Supabase project set up and configured

## Project Structure

```
tagtapgo/
├── tagtapgo-app/          # Next.js frontend application
├── tagtapgo-backend/      # Supabase backend (Edge Functions, migrations)
├── .gitignore            # Root gitignore
└── README.md
```

## Deployment Steps

### 1. Prepare Repository

The codebase is already cleaned up and ready for deployment:
- ✅ Demo app removed (`tagtapgo-demo`)
- ✅ Dev tools removed (`dev-tools` page)
- ✅ Debug files excluded (`.gitignore`)
- ✅ Build artifacts excluded (`.next/`, `node_modules/`)

### 2. Push to GitHub

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Production ready"

# Add remote (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/tagtapgo.git

# Push to GitHub
git push -u origin main
```

### 3. Deploy Frontend to Vercel

#### Option A: Using Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure project settings:
   - **Framework Preset:** Next.js
   - **Root Directory:** `tagtapgo-app`
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
   - **Install Command:** `npm install`

5. Add Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
   ```

6. Click "Deploy"

#### Option B: Using Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to app directory
cd tagtapgo-app

# Deploy
vercel

# Follow prompts and set environment variables when asked
```

### 4. Configure Custom Domain (Optional)

1. In Vercel dashboard, go to your project
2. Navigate to "Settings" → "Domains"
3. Add your custom domain
4. Update DNS records as instructed by Vercel

### 5. Backend Configuration

The backend (Supabase) is already deployed. Ensure:

- ✅ All migrations are applied
- ✅ Edge Functions are deployed
- ✅ RLS policies are enabled
- ✅ Environment variables are set in Supabase dashboard

### 6. Post-Deployment Verification

1. **Test Authentication:**
   - Visit your deployed URL
   - Try signing up and logging in
   - Verify email confirmation works

2. **Test Core Features:**
   - Dashboard loads correctly
   - Achievements page works
   - Leaderboard displays
   - Rewards catalog loads
   - Profile page accessible

3. **Test Performance:**
   - Run Lighthouse audit
   - Check bundle size
   - Verify images load properly
   - Test on mobile devices

4. **Test PWA Features:**
   - Service worker registers
   - Offline mode works
   - Push notifications work (if configured)

## Environment Variables

### Required for Frontend (Vercel)

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Optional (for Push Notifications)

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
```

## Troubleshooting

### Build Fails

- Check that all dependencies are in `package.json`
- Verify TypeScript compiles locally: `npm run type-check`
- Check build logs in Vercel dashboard

### Environment Variables Not Working

- Ensure variables are prefixed with `NEXT_PUBLIC_` for client-side access
- Redeploy after adding new environment variables
- Check Vercel dashboard → Settings → Environment Variables

### 404 Errors

- Verify root directory is set to `tagtapgo-app`
- Check that middleware is configured correctly
- Ensure all routes are properly defined

### Slow Performance

- Enable Vercel Analytics
- Check bundle size: `npm run analyze`
- Optimize images using Next.js Image component
- Review Lighthouse report

## Continuous Deployment

Vercel automatically deploys:
- **Production:** Pushes to `main` branch
- **Preview:** Pull requests and other branches

To disable auto-deployment:
1. Go to Project Settings → Git
2. Configure deployment branches

## Monitoring

### Vercel Analytics

Enable in Project Settings → Analytics to track:
- Page views
- Performance metrics
- User demographics

### Error Tracking

Consider integrating:
- Sentry for error tracking
- LogRocket for session replay
- Vercel Speed Insights

## Rollback

If deployment fails:
1. Go to Vercel dashboard
2. Navigate to "Deployments"
3. Find previous working deployment
4. Click "..." → "Promote to Production"

## Support

- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs
- Supabase Docs: https://supabase.com/docs

---

**Last Updated:** October 29, 2025
