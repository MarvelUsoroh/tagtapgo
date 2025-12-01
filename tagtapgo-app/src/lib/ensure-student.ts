/**
 * ensure-student (server-side)
 * Ensures a student profile exists for the authenticated user.
 * Safe to call on every SSR request for the dashboard.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown> | null;
};

export async function ensureStudentProfile(supabase: SupabaseClient, user: AuthUser) {
  // Check if a profile already exists by ID or Email
  // We check email too because the sync job might have created the student profile
  // with a different ID (Moodle UUID) before the user signed up.
  let query = supabase
    .from('students')
    .select('id')
    .limit(1);
    
  if (user.email) {
    query = query.or(`id.eq.${user.id},email.eq.${user.email}`);
  } else {
    query = query.eq('id', user.id);
  }

  const { data: existing, error: selectError } = await query;

  if (!selectError && Array.isArray(existing) && existing.length > 0) {
    return { created: false } as const;
  }

  const emailLocal = user.email ? user.email.split('@')[0] : undefined;
  const fullNameFromMeta = (user.user_metadata?.name as string | undefined) || emailLocal || 'Student';
  let universityId = user.user_metadata?.university_id as string | undefined;
  const externalId = (user.user_metadata?.external_id as string | undefined) || emailLocal || user.id;

  // Extract name parts from metadata if available (from new signup flow)
  const firstNameMeta = user.user_metadata?.first_name as string | undefined;
  const lastNameMeta = user.user_metadata?.last_name as string | undefined;

  let firstName: string | undefined;
  let lastName: string | undefined;

  if (firstNameMeta && lastNameMeta) {
    firstName = firstNameMeta;
    lastName = lastNameMeta;
  } else {
    // Fallback: Split full name into first and last name (simple split on first space)
    const nameParts = fullNameFromMeta.split(' ');
    firstName = nameParts[0];
    lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;
  }

  // Helper: basic UUID v4 format check
  const isUuid = (v?: string) => !!v && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);

  // If university_id is missing or not a UUID (e.g., dev placeholder like "uni-001"), try to infer from email domain
  if (!isUuid(universityId) && user.email && user.email.includes('@')) {
    const domain = user.email.split('@')[1].toLowerCase();
    const { data: uniByDomain } = await supabase
      .from('universities')
      .select('id, domain')
      .eq('domain', domain)
      .maybeSingle();
    if (uniByDomain?.id) {
      universityId = uniByDomain.id as string;
    }
  }

  // If we don't have a university_id, skip creating the profile to avoid FK constraint failures.
  if (!universityId) {
    return { created: false, reason: 'missing_university_id' } as const;
  }

  const { error: upsertError } = await supabase
    .from('students')
    .upsert(
      {
        id: user.id,
        university_id: universityId,
        external_id: externalId,
        email: user.email,
        first_name: firstName,
        last_name: lastName,
        // Note: full_name is a GENERATED ALWAYS column, don't insert it
        settings: {},
      },
      { onConflict: 'id' }
    );

  if (upsertError) {
    // Swallow insert errors to avoid hard-failing dashboard; caller may handle gracefully
    return { created: false, error: upsertError } as const;
  }

  try {
    // Fire-and-forget call to backend edge function to enrol the
    // student into the demo Moodle course for the MVP.
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const functionUrl = baseUrl
      ? `${baseUrl}/functions/v1/enrol-student-in-demo-course`
      : undefined;

    if (functionUrl) {
      fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: user.id }),
      }).catch(() => {
        // Ignore enrolment failures in ensure path; dashboard should still load.
      });
    }
  } catch {
    // Ignore errors – enrolment is best-effort.
  }

  return { created: true } as const;
}

export default ensureStudentProfile;
