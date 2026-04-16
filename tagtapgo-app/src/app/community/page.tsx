/**
 * Community Chat Page (Server Component)
 * University-scoped chat with #course-tags for targeted visibility
 */

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase-server';
import CommunityChat from '@/components/CommunityChat';

export default async function CommunityPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get student profile with university info
  const { data: student } = await supabase
    .from('students')
    .select('id, university_id, first_name, last_name, full_name, avatar_url')
    .eq('auth_user_id', user.id)
    .single();

  if (!student) {
    redirect('/login?error=no_profile');
  }

  // Get enrolled courses for #tag autocomplete
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select(`
      course:courses(id, code, short_name, name)
    `)
    .eq('student_id', student.id)
    .eq('status', 'active');

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const courses = (enrollments || [])
    .map((e: any) => e.course)
    .filter(Boolean)
    .map((c: any) => ({
      id: c.id as string,
      code: c.code as string | null,
      shortName: c.short_name as string | null,
      name: c.name as string,
    }));
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Get university name
  const { data: university } = await supabase
    .from('universities')
    .select('id, name')
    .eq('id', student.university_id)
    .single();

  // Generate abbreviation from university name (e.g., "Demo University" -> "DU")
  const universityAbbrev = university?.name
    ? university.name
        .split(' ')
        .filter((word: string) => word.length > 2 || word.toUpperCase() === word) // Skip small words like "of", "the" unless acronym
        .map((word: string) => word[0].toUpperCase())
        .join('')
    : 'C';

  return (
    <CommunityChat
      currentUser={{
        id: student.id,
        universityId: student.university_id,
        firstName: student.first_name,
        lastName: student.last_name,
        fullName: student.full_name,
        avatarUrl: student.avatar_url,
      }}
      universityName={university?.name || 'Community'}
      universityAbbrev={universityAbbrev}
      enrolledCourses={courses}
    />
  );
}
