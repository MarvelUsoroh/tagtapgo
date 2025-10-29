# TagTapGo Backend - Gamification MVP

**Sprint 1: Infrastructure Setup**

## Project Structure

```
tagtapgo-backend/
├── supabase/
│   ├── migrations/          # Database migrations
│   ├── functions/           # Edge Functions (Deno/TypeScript)
│   └── config.toml          # Supabase configuration
├── src/
│   ├── integrations/        # SIS/LMS adapters
│   ├── gamification/        # Gamification engine
│   └── types/               # TypeScript types
├── tests/                   # Test files
└── docs/                    # Documentation
```

## Tech Stack

- **Database:** Supabase (PostgreSQL)
- **API:** Supabase Edge Functions (Deno/TypeScript)
- **Real-time:** Supabase Realtime (WebSockets)
- **Storage:** Supabase Storage
- **Hosting:** Supabase (EU - Frankfurt/London)

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase CLI
- Git

### Installation

```bash
# Install Supabase CLI
npm install -g supabase

# Clone repository
git clone <repo-url>
cd tagtapgo-backend

# Login to Supabase
supabase login

# Link to project
supabase link --project-ref <project-ref>

# Start local development
supabase start
```

## Development

```bash
# Run migrations
supabase db push

# Deploy Edge Functions
supabase functions deploy

# Run tests
deno test --allow-all
```

## Environment Variables

Create `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Sprint 1 Progress

- [x] Project structure created
- [ ] Database schema designed
- [ ] Migrations created
- [ ] Edge Functions setup
- [ ] CI/CD pipeline configured
- [ ] Monitoring setup

## Next Steps

1. Create database migrations
2. Set up Edge Functions
3. Configure CI/CD
4. Deploy to staging
