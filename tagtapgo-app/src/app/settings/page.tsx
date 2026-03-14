/**
 * Settings Server Component
 * Fetches user data server-side
 */

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase-server';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  // Create server-side Supabase client and verify user via SSR
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch student data
  const { data: studentData } = await supabase
    .from('students')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!studentData) {
    redirect('/login?error=student_not_found');
  }

  return (
    <SettingsClient
      studentId={user.id}
      studentName={studentData.full_name || 'Student'}
      studentEmail={user.email || ''}
    />
  );
}
