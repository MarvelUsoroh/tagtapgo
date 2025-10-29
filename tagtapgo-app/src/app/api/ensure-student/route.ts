import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { ensureStudentProfile } from '@/lib/ensure-student';

export async function POST() {
  try {
    const supabase = createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }
    if (!user) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
    }

    const result = await ensureStudentProfile(supabase, {
      id: user.id,
      email: user.email ?? undefined,
      user_metadata: user.user_metadata ?? null,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown_error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
