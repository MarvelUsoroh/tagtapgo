import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient as createSSR } from '@/lib/supabase-server';

type PromptRow = {
  id: string;
  student_id: string;
  class_schedule_id: string;
  status: 'pending' | 'completed' | 'expired' | 'skipped';
  expires_at: string;
};

export async function POST() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Dev-only endpoint' }, { status: 403 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Missing Supabase env vars. Ensure NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are set.' },
      { status: 500 }
    );
  }

  // Get current user via SSR (cookie-based)
  const supabaseSSR = createSSR();
  const { data: { user } } = await supabaseSSR.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Admin client to bypass RLS for creating prompts in dev
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Find latest ended schedule for this user
  const { data: schedule, error: schedErr } = await admin
    .from('class_schedules')
    .select('id, end_time')
    .eq('student_id', user.id)
    .lt('end_time', new Date().toISOString())
    .order('end_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (schedErr) {
    return NextResponse.json({ error: 'Failed to fetch schedules', details: schedErr.message }, { status: 500 });
  }
  if (!schedule) {
    return NextResponse.json({ error: 'No ended schedules found for user' }, { status: 404 });
  }

  // If a prompt already exists for the latest schedule, try to create one for the next latest ended schedule without a prompt
  const { data: existing, error: existErr } = await admin
    .from('feedback_prompts')
    .select('id, status, expires_at, student_id, class_schedule_id')
    .eq('student_id', user.id)
    .eq('class_schedule_id', schedule.id)
    .maybeSingle();

  if (existErr) {
    return NextResponse.json({ error: 'Failed to check existing prompts', details: existErr.message }, { status: 500 });
  }
  if (existing) {
    // Look back through recent ended schedules and find one without a prompt yet
    const nowIso = new Date().toISOString();
    const { data: recentSchedules, error: recentErr } = await admin
      .from('class_schedules')
      .select('id, end_time')
      .eq('student_id', user.id)
      .lt('end_time', nowIso)
      .order('end_time', { ascending: false })
      .limit(20);

    if (recentErr) {
      return NextResponse.json(
        { error: 'Failed to fetch recent schedules', details: recentErr.message },
        { status: 500 }
      );
    }

    const scheduleIds = (recentSchedules ?? []).map((s) => s.id);
    if (scheduleIds.length === 0) {
      return NextResponse.json({ error: 'No ended schedules found for user' }, { status: 404 });
    }

    const { data: existingPrompts, error: existingPromptsErr } = await admin
      .from('feedback_prompts')
      .select('class_schedule_id')
      .eq('student_id', user.id)
      .in('class_schedule_id', scheduleIds);

    if (existingPromptsErr) {
      return NextResponse.json(
        { error: 'Failed to fetch existing prompts', details: existingPromptsErr.message },
        { status: 500 }
      );
    }

    const withPrompt = new Set((existingPrompts ?? []).map((p) => p.class_schedule_id));
    const target = (recentSchedules ?? []).find((s) => !withPrompt.has(s.id));

    if (!target) {
      return NextResponse.json(
        { message: 'All recent ended schedules already have prompts. No additional prompt can be created.' },
        { status: 409 }
      );
    }

    const expiresAtAlt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: insertedAlt, error: insertAltErr } = await admin
      .from('feedback_prompts')
      .insert({
        student_id: user.id,
        class_schedule_id: target.id,
        expires_at: expiresAtAlt,
        status: 'pending',
      })
      .select('id, student_id, class_schedule_id, status, expires_at')
      .single();

    if (insertAltErr) {
      return NextResponse.json(
        { error: 'Failed to create alternate prompt', details: insertAltErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Prompt created for next available ended schedule', prompt: insertedAlt as PromptRow },
      { status: 201 }
    );
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: inserted, error: insertErr } = await admin
    .from('feedback_prompts')
    .insert({
      student_id: user.id,
      class_schedule_id: schedule.id,
      expires_at: expiresAt,
      status: 'pending',
    })
    .select('id, student_id, class_schedule_id, status, expires_at')
    .single();

  if (insertErr) {
    return NextResponse.json({ error: 'Failed to create prompt', details: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Prompt created', prompt: inserted as PromptRow }, { status: 201 });
}
