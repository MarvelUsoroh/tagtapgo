# TagTapGo Student Mobile App (PWA)

**Sprint 4: Student Mobile App**

A Progressive Web App (PWA) for students to track attendance, earn points, unlock achievements, and redeem rewards.

## Features

### ✅ Implemented
- **Home Dashboard** - Points, streaks, today's classes, quick stats
- **Bottom Navigation** - Easy navigation between main sections
- **PWA Support** - Installable, works offline, push notifications ready
- **Responsive Design** - Mobile-first, works on all devices
- **Real-time Updates** - Supabase Realtime for live leaderboards
- **State Management** - Zustand for global state
- **Animations** - Framer Motion for smooth transitions

### 🚧 To Be Implemented
- Achievements page
- Leaderboard page
- Rewards page
- Profile page
- Login/Signup pages
- Notifications
- Challenges
- Friends

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **State:** Zustand
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Charts:** Recharts

## Project Structure

```
tagtapgo-app/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── page.tsx        # Home dashboard
│   │   ├── layout.tsx      # Root layout
│   │   └── globals.css     # Global styles
│   ├── components/          # React components
│   │   ├── BottomNav.tsx   # Bottom navigation
│   │   ├── StatCard.tsx    # Stat card component
│   │   └── TodayClasses.tsx # Today's classes
│   ├── lib/                 # Utilities
│   │   └── supabase.ts     # Supabase client & types
│   └── store/               # State management
│       └── useStore.ts     # Zustand store
├── public/                  # Static assets
│   └── manifest.json       # PWA manifest
├── package.json
├── next.config.js
├── tailwind.config.js
└── tsconfig.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Update .env.local with your Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
# Build
npm run build

# Start production server
npm start
```

## PWA Features

### Installable
- Add to home screen on mobile
- Standalone app experience
- Custom splash screen

### Offline Support
- Service worker caching
- Offline fallback pages
- Background sync

### Push Notifications
- Streak reminders
- Achievement unlocks
- Challenge invitations
- Rank changes

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=TagTapGo

# Features
NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true
NEXT_PUBLIC_ENABLE_CHALLENGES=true
NEXT_PUBLIC_ENABLE_REWARDS=true
```

### Server-only (optional)

```env
# Enables /api/universities to bypass RLS for read operations pre-auth
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Note: Do not expose the service role key client-side. Set it only in your server/Vercel project settings.

## Development

### Run Tests
```bash
npm test
```

### Lint
```bash
npm run lint
```

### Type Check
```bash
npm run type-check
```

## Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Other Platforms
- Netlify
- AWS Amplify
- Google Cloud Run
- Self-hosted

## Performance

- **Lighthouse Score:** 95+ (target)
- **First Contentful Paint:** <1.5s
- **Time to Interactive:** <3s
- **Bundle Size:** <200KB (gzipped)

## Browser Support

- Chrome/Edge 90+
- Safari 14+
- Firefox 88+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Next Steps

1. **Complete remaining pages:**
   - Achievements
   - Leaderboard
   - Rewards
   - Profile
   - Login/Signup

2. **Add features:**
   - Push notifications
   - Offline support
   - Background sync
   - Share achievements

3. **Optimize:**
   - Image optimization
   - Code splitting
   - Lazy loading
   - Caching strategy

4. **Test:**
   - Unit tests
   - Integration tests
   - E2E tests
   - PWA audit

## Universities data source

- Canonical universities are stored in our Supabase `public.universities` table.
- The signup page fetches a pre-auth-safe list from `GET /api/universities` (server-side route).
- An optional Hipo-backed search endpoint exists at `GET /api/universities/search?name=&country=` which maps external domains to internal rows; UI hookup is pending.
- See `docs/UNIVERSITIES_INTEGRATION.md` for details.

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT

---

**Built with ❤️ by TagTapGo Team**
