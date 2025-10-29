/**
 * Supabase Admin Client (server-only)
 * Uses the Service Role key if available to bypass RLS for safe read operations.
 * Never import this into client components.
 */

import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!serviceRoleKey) {
    // Intentionally do not throw: callers can choose to fallback to anon client
    // or return a 503 explaining that admin access is not configured.
    return null;
  }

  const client = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return client;
}
