import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// GET /api/universities/search?name=...&country=...
// Proxies the Hipo Universities API on the server and maps results to internal universities by domain.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name')?.trim();
    const country = searchParams.get('country')?.trim();

    if (!name || name.length < 2) {
      return NextResponse.json({ ok: true, results: [] });
    }

    const hipoUrl = `https://universities.hipolabs.com/search?name=${encodeURIComponent(name)}${country ? `&country=${encodeURIComponent(country)}` : ''}`;

    const hipoRes = await fetch(hipoUrl, { next: { revalidate: 60 } });
    if (!hipoRes.ok) {
      // If Hipo fails, still respond gracefully
      return NextResponse.json({ ok: true, results: [] });
    }
    const hipoData: Array<{ name: string; country: string; web_pages?: string[]; domains?: string[] }> = await hipoRes.json();

    // Collect candidate domains from Hipo results for internal mapping
    const domains = Array.from(
      new Set(
        (hipoData || []).flatMap((r) => (r.domains || []).map((d) => d.toLowerCase()))
      )
    ).slice(0, 200); // safety cap

    const internalByDomain: Record<string, { id: string; name: string; domain: string }> = {};
    if (domains.length > 0) {
      const admin = createAdminClient();
      if (admin) {
        const { data } = await admin
          .from('universities')
          .select('id, name, domain')
          .in('domain', domains);
        for (const row of data ?? []) {
          const d = (row as { domain?: unknown }).domain;
          if (typeof d === 'string' && d) {
            const id = String((row as { id?: unknown }).id ?? '');
            const name = String((row as { name?: unknown }).name ?? '');
            internalByDomain[d.toLowerCase()] = { id, name, domain: d };
          }
        }
      }
    }

    const results = (hipoData || []).map((r) => {
      const match = (r.domains || []).map((d) => d.toLowerCase()).map((d) => internalByDomain[d]).find(Boolean) || null;
      return {
        name: r.name,
        country: r.country,
        domains: r.domains || [],
        match, // { id, name, domain } | null
      };
    });

    return NextResponse.json({ ok: true, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown_error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
