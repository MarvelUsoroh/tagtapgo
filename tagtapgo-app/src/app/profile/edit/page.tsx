import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase-server';
import ProfileEditClient from './ProfileEditClient';

export default async function ProfileEditPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get the actual student ID from auth_user_id
  const { data: studentProfile } = await supabase
    .from('students')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  
  if (!studentProfile) {
    redirect('/login?error=no_profile');
  }
  
  const studentId = studentProfile.id;

  // Fetch the student's current profile data
  const { data: student, error } = await supabase
    .from('students')
    .select('id, full_name, avatar_url, email')
    .eq('id', studentId)
    .single();

  if (error || !student) {
    console.error('Error fetching student for edit:', error);
    redirect('/settings?error=profile_load_failed');
  }

  // Pass only plain objects to the Client Component
  const plainStudent = {
    id: student.id,
    name: student.full_name,
    avatar_url: student.avatar_url,
    email: student.email,
  };

  return <ProfileEditClient student={plainStudent} />;
}
