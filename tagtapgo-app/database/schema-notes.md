# Database Schema Notes for JWKS Authentication

## Important: JWT Secret Line

The following line in your schema is **NOT NEEDED** with JWKS authentication:

```sql
-- ❌ REMOVE THIS LINE (obsolete with JWKS)
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret-here';
```

## Why?

With JWKS (JSON Web Key Sets):
- Supabase manages private keys internally
- Your app verifies tokens using public keys from the JWKS endpoint
- No static JWT secret is needed in the database or environment

## What Stays the Same?

All your Row Level Security (RLS) policies remain unchanged:

```sql
-- ✅ This still works perfectly
CREATE POLICY IF NOT EXISTS students_view_own ON students
FOR SELECT USING (auth.uid()::text = id::text);
```

The `auth.uid()` function automatically extracts the user ID from the JWT token after Supabase verifies it using JWKS.

## Authentication Flow

1. **Client** → Authenticates with Supabase Auth
2. **Supabase** → Issues JWT signed with private key (ES256)
3. **Your Middleware** → Verifies JWT using public key from JWKS endpoint
4. **Database RLS** → Uses `auth.uid()` from verified token to enforce policies

## Summary

- ❌ Remove: `ALTER DATABASE postgres SET "app.jwt_secret"`
- ✅ Keep: All RLS policies (they work with JWKS automatically)
- ✅ Keep: All table structures and indexes
- ✅ Keep: All triggers and functions
