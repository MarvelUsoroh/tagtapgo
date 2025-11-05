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
  await ensureStudentProfile(supabase, { id: userId, email: user.email, user_metadata: user.user_metadata });

  try {
    // Fetch all data in parallel for better performance
    const [studentData, pointsData, streakData, attendanceData, classesData, badgesCountData] = await Promise.all([
      // Student profile (allow missing without hard error)
      supabase.from('students').select('*').eq('id', userId).maybeSingle(),

      // Points (sum all points for current balance)
      supabase.from('points').select('points').eq('student_id', userId),

      // Current streak
      supabase.from('streaks').select('*').eq('student_id', userId).single(),

      // Recent attendance (last 30 days for rate calculation)
      supabase.from('attendance').select('status').eq('student_id', userId)
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),

      // Today's classes
      supabase.from('class_schedules').select(`
        *,
        class:classes(*)
      `).eq('student_id', userId)
        .gte('start_time', new Date().toISOString().split('T')[0] + 'T00:00:00')
        .lte('start_time', new Date().toISOString().split('T')[0] + 'T23:59:59')
        .order('start_time'),

      // Badges (only count unlocked achievements)
      supabase.from('student_achievements')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', userId)
        .eq('unlocked', true),
    ]);

    // Handle potential errors
    if (studentData.error) {
      console.error('Error fetching student:', studentData.error);
      // Continue without redirect; handle null student gracefully in the client
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
    const classes = classesData.data || [];

    interface ClassSchedule {
      start_time: string;
      end_time: string;
      class: {
        id: string;
        name: string;
        location: string;
      };
    }

    const activeClass = classes.find((c: ClassSchedule) => {
      const start = new Date(c.start_time);
      const end = new Date(c.end_time);
      return now >= start && now <= end;
    });

    const nextClass = classes.find((c: ClassSchedule) => {
      const start = new Date(c.start_time);
      return now < start;
    });

    // Compute today's stats (completed vs total)
    const completedToday = classes.filter((c: ClassSchedule) => new Date(c.end_time) < now).length;

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
