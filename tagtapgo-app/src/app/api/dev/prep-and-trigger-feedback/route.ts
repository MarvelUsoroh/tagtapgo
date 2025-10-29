import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient as createSSR } from '@/lib/supabase-server';

export async function POST() {
  // Dev-only guard
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

  // Get current user via SSR
  const supabaseSSR = createSSR();
  const { data: { user } } = await supabaseSSR.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1) Pick latest schedule for this user
    const { data: schedule, error: schedErr } = await admin
      .from('class_schedules')
      .select('id, class_id, student_id, end_time')
      .eq('student_id', user.id)
      .order('end_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (schedErr) {
      return NextResponse.json({ error: 'Failed to fetch schedules', details: schedErr.message }, { status: 500 });
    }
    if (!schedule) {
      return NextResponse.json({ error: 'No schedules found for user' }, { status: 404 });
    }

    // 2) Get course_id from class
    const { data: cls, error: classErr } = await admin
      .from('classes')
      .select('id, course_id, name')
      .eq('id', schedule.class_id)
      .single();

    if (classErr || !cls) {
      return NextResponse.json({ error: 'Failed to fetch class', details: classErr?.message || 'Not found' }, { status: 500 });
    }

    // 3) Clear any existing prompt for this schedule+student
    const { error: delErr } = await admin
      .from('feedback_prompts')
      .delete()
      .eq('student_id', user.id)
      .eq('class_schedule_id', schedule.id);

    if (delErr) {
      return NextResponse.json({ error: 'Failed to clear existing prompts', details: delErr.message }, { status: 500 });
    }

    // 4) Backdate schedule into 15–20 min window: end_time = now - 17m, start_time = end - 30m
    const end = new Date(Date.now() - 17 * 60 * 1000);
    const start = new Date(end.getTime() - 30 * 60 * 1000);

    const { data: updated, error: updErr } = await admin
      .from('class_schedules')
      .update({ end_time: end.toISOString(), start_time: start.toISOString() })
      .eq('id', schedule.id)
      .select('id, end_time, start_time')
      .single();

    if (updErr) {
      return NextResponse.json({ error: 'Failed to update schedule times', details: updErr.message }, { status: 500 });
    }

    // 5) Ensure attendance = present for (end_time::date)
    const dateStr = end.toISOString().slice(0, 10); // YYYY-MM-DD in UTC
    const { error: attErr } = await admin
      .from('attendance')
      .upsert(
        [{
          student_id: user.id,
          course_id: cls.course_id,
          date: dateStr,
          status: 'present',
          source: 'manual',
        }],
        { onConflict: 'student_id,course_id,date' }
      );

    if (attErr) {
      return NextResponse.json({ error: 'Failed to upsert attendance', details: attErr.message }, { status: 500 });
    }

    // 6) Trigger the feedback-prompt-job function
    const res = await fetch(`${supabaseUrl}/functions/v1/feedback-prompt-job`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
      },
    });

    const text = await res.text();
    let jobData: unknown;
    try {
      jobData = JSON.parse(text);
    } catch {
      jobData = { message: text } as { message: string };
    }

    return NextResponse.json({
      scheduleId: schedule.id,
      updated,
      job: { ok: res.ok, status: res.status, data: jobData },
    }, { status: res.ok ? 200 : res.status });
  } catch (err: unknown) {
    return NextResponse.json({ error: 'Unexpected error', details: String(err) }, { status: 500 });
  }
}
