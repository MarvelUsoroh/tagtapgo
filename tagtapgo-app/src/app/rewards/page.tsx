/**
 * Rewards Server Component
 * Fetches rewards catalog and redemption history server-side
 */

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase-server';
import RewardsClient from './RewardsClient';

export default async function RewardsPage() {
  // Create server-side Supabase client and verify user via SSR
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }
  const userId = user.id;
  
  // Get the actual student ID from auth_user_id
  const { data: studentProfile } = await supabase
    .from('students')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  
  if (!studentProfile) {
    redirect('/login?error=no_profile');
  }
  
  const studentId = studentProfile.id;
  
  try {
    // Fetch all data in parallel
    const [rewardsData, redemptionsData, pointsData] = await Promise.all([
      // Active rewards with stock
      supabase.from('rewards').select('*')
        .eq('active', true)
        .gt('stock', 0)
        .order('points_cost', { ascending: true }),
      
      // User's redemption history
      supabase.from('redemptions').select('*, reward:rewards(*)')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false }),
      
      // User's total points
      supabase.from('points').select('points').eq('student_id', studentId),
    ]);
    
    // Handle errors
    if (rewardsData.error) {
      console.error('Error fetching rewards:', rewardsData.error);
      throw rewardsData.error;
    }
    
    // Calculate total points
    const totalPoints = pointsData.data?.reduce((sum, p) => sum + p.points, 0) || 0;
    
    // Pass to client component
    return (
      <RewardsClient
        rewards={rewardsData.data || []}
        redemptions={redemptionsData.data || []}
        totalPoints={totalPoints}
        studentId={studentId}
      />
    );
    
  } catch (error) {
    console.error('Error fetching rewards data:', error);
    redirect('/login?error=data_fetch_failed');
  }
}
