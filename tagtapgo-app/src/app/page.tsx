/**
 * Dashboard Server Component
 * Fetches data server-side to eliminate flash bug
 */

// Force dynamic rendering to ensure fresh data for authenticated users
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase-server';
import { ensureStudentProfile } from '@/lib/ensure-student';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  // Create server-side Supabase client and verify user via SSR
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }
  const userId = user.id;
  // Ensure the student profile exists for this authenticated user (SSO/email agnostic)
  const ensureResult = await ensureStudentProfile(supabase, { id: userId, email: user.email, user_metadata: user.user_metadata });
  
  if (ensureResult.error) {
    await supabase.auth.signOut();
    redirect('/login?error=not_invited');
  }

  // Resolve the correct Student ID. 
  // Query by auth_user_id first (most reliable), then fall back to email if needed.
  let studentId = userId;
  
  const { data: studentProfile } = await supabase
    .from('students')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (studentProfile) {
    studentId = studentProfile.id;
  }

  try {
    // Fetch all data in parallel for better performance
    const [studentData, pointsData, streakData, attendanceData, classesData, badgesCountData] = await Promise.all([
      // Student profile (allow missing without hard error)
      supabase.from('students').select('*').eq('id', studentId).maybeSingle(),

      // Points (sum all points for current balance)
      supabase.from('points').select('points').eq('student_id', studentId),

      // Current streak
      supabase.from('streaks').select('*').eq('student_id', studentId).single(),

      // Recent attendance (last 30 days for rate calculation)
      supabase.from('attendance').select('status').eq('student_id', studentId)
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),

      // Get enrolled course IDs first
      supabase.from('enrollments')
        .select('course_id')
        .eq('student_id', studentId)
        .eq('status', 'active'),

      // Badges (only count unlocked achievements)
      supabase.from('student_achievements')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', studentId)
        .eq('unlocked', true),
    ]);

    // Handle potential errors
    if (studentData.error) {
      console.error('Error fetching student:', studentData.error);
      // Continue without redirect; handle null student gracefully in the client
    }

    // Process enrollments to get course IDs
    type EnrollmentRow = { course_id: string };
    const enrolledCourseIds = (classesData.data || []).map((e: EnrollmentRow) => e.course_id);

    // Fetch Today's Classes based on enrolled courses
    // We do this in a second step because class_schedules is normalized (per course, not per student)
    type ClassSchedule = {
      class: {
        id: string;
        name: string;
        location: string;
      };
      start_time: string;
      end_time: string;
    };

    let todayClasses: ClassSchedule[] = [];
    
    if (enrolledCourseIds.length > 0) {
      const { data: schedules } = await supabase
        .from('class_schedules')
        .select(`
          *,
          class:classes(*)
        `)
        .in('course_id', enrolledCourseIds)
        .gte('start_time', new Date().toISOString().split('T')[0] + 'T00:00:00')
        .lte('start_time', new Date().toISOString().split('T')[0] + 'T23:59:59')
        .order('start_time');
        
      todayClasses = schedules || [];
    }

    // Calculate derived data
    const totalPoints = pointsData.data?.reduce((sum, p) => sum + p.points, 0) || 0;

    let attendanceRate = 0;
    if (attendanceData.data && attendanceData.data.length > 0) {
      const present = attendanceData.data.filter(a => a.status === 'present').length;
      attendanceRate = Math.round((present / attendanceData.data.length) * 100);
    }

    // Determine active and next class
    const now = new Date();
    const classes = todayClasses.map((c) => ({
      id: c.class.id,
      name: c.class.name,
      location: c.class.location,
      start_time: c.start_time,
      end_time: c.end_time,
    }));

    const activeClass = classes.find((c) => {
      const start = new Date(c.start_time);
      const end = new Date(c.end_time);
      return now >= start && now <= end;
    });

    const nextClass = classes.find((c) => {
      const start = new Date(c.start_time);
      return now < start;
    });

    // Compute today's stats (completed vs total)
    const completedToday = classes.filter((c) => new Date(c.end_time) < now).length;

    // Pass all data to client component
    return (
      <DashboardClient
        student={studentData.data || null}
        totalPoints={totalPoints}
        currentStreak={streakData.data}
        attendanceRate={attendanceRate}
        todayClasses={classes}
        todayCompleted={completedToday}
        badgesCount={badgesCountData.count || 0}
        activeClass={activeClass || null}
        nextClass={nextClass || null}
      />
    );

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    redirect('/login?error=data_fetch_failed');
  }
}
