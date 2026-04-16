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
  // Check if a profile already exists by auth_user_id or Email
  // We check email too because the sync job might have created the student profile
  // before the user signed up via invitation.
  let query = supabase
    .from('students')
    .select('id, metadata')
    .limit(1);
    
  if (user.email) {
    query = query.or(`auth_user_id.eq.${user.id},email.eq.${user.email}`);
  } else {
    query = query.eq('auth_user_id', user.id);
  }

  const { data: existing, error: selectError } = await query;

  // If profile exists, we no longer trigger enrollment manually. Moodle sync handles it.
  if (!selectError && Array.isArray(existing) && existing.length > 0) {
    // Return early, the profile exists.
    return { created: false, enrolled: true } as const;
  }

  // If we get here, it means no profile exists (length == 0).
  // In the pre-populated Moodle sync model, we DO NOT allow open registrations.
  // The user MUST exist in the 'students' table first.

  return { created: false, error: new Error('Your email is not registered for the TagTapGo Pilot. Please use your official university email or contact support.') } as const;
}

export default ensureStudentProfile;
