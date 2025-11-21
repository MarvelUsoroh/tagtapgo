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

    // Get user session
    const supabase = createServerClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Call Edge Function to award points
    const { error } = await supabase.functions.invoke('award-feedback-points', {
      body: { conversation_id: sessionId }
    });

    if (error) {
      console.error('Edge Function error:', error);
      return NextResponse.json(
        { error: 'Failed to award points via Edge Function' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pointsAwarded: 15, // Hardcoded in Edge Function
      message: `Successfully awarded points for Venus conversation`
    });

  } catch (error) {
    console.error('Award points API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
