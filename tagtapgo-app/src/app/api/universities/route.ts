import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { createServerClient } from '@/lib/supabase-server';

// GET /api/universities
// Returns minimal university fields safe for pre-auth clients.
export async function GET() {
  try {
    // Prefer admin client (bypass RLS). Fallback to anon server client if admin not configured.
    const admin = createAdminClient();
    const supabase = admin ?? createServerClient();

    const { data, error } = await supabase
      .from('universities')
      .select('id, name, domain')
      .order('name');

    if (error) {
      // If we failed with anon client due to RLS (or other), expose a friendly error
      const status = admin ? 500 : 403;
      return NextResponse.json(
        { ok: false, error: 'Unable to load universities' },
        { status }
      );
    }

    return NextResponse.json({ ok: true, universities: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown_error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
