import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, points } = await request.json();

    // Validate input
    if (!sessionId || !points || typeof points !== 'number') {
      return NextResponse.json(
        { error: 'Invalid sessionId or points' },
        { status: 400 }
      );
    }

    // Get user from auth
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get student profile
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    // Award points
    const { data: pointsData, error: pointsError } = await supabase
      .from('points')
      .insert({
        student_id: student.id,
        points: points,
        transaction_type: 'feedback',
        description: `Venus AI conversation completed`,
        metadata: { sessionId }
      })
      .select()
      .single();

    if (pointsError) {
      console.error('Points award error:', pointsError);
      return NextResponse.json(
        { error: 'Failed to award points' },
        { status: 500 }
      );
    }

    // Update student's total points
    const { error: updateError } = await supabase.rpc('update_student_points', {
      student_id: student.id,
      points_to_add: points
    });

    if (updateError) {
      console.error('Update total points error:', updateError);
      // Don't fail the request - points were awarded
    }

    // Check for achievements (optional)
    try {
      await supabase.rpc('check_feedback_achievements', {
        student_id: student.id
      });
    } catch (achievementError) {
      console.error('Achievement check error:', achievementError);
      // Don't fail the request
    }

    return NextResponse.json({
      success: true,
      pointsAwarded: points,
      transactionId: pointsData.id,
      message: `Successfully awarded ${points} points for Venus conversation`
    });

  } catch (error) {
    console.error('Award points API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
