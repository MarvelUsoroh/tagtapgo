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
  // Check if a profile already exists
  const { data: existing, error: selectError } = await supabase
    .from('students')
    .select('id')
    .eq('id', user.id)
    .limit(1);

  if (!selectError && Array.isArray(existing) && existing.length > 0) {
    return { created: false } as const;
  }

  const emailLocal = user.email ? user.email.split('@')[0] : undefined;
  const fullNameFromMeta = (user.user_metadata?.name as string | undefined) || emailLocal || 'Student';
  let universityId = user.user_metadata?.university_id as string | undefined;
  const externalId = (user.user_metadata?.external_id as string | undefined) || emailLocal || user.id;

  // Split full name into first and last name (simple split on first space)
  const nameParts = fullNameFromMeta.split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;

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

  return { created: true } as const;
}

export default ensureStudentProfile;
