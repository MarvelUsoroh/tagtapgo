import { NextResponse } from 'next/server';

export async function POST() {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!projectUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Missing Supabase env vars. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${projectUrl}/functions/v1/feedback-prompt-job`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
      },
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text } as { message: string };
    }

    return NextResponse.json(
      { ok: res.ok, status: res.status, data },
      { status: res.status }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: 'Failed to trigger feedback-prompt-job', details: String(err) },
      { status: 500 }
    );
  }
}
