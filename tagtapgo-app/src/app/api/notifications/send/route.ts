import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * API Route: Send Push Notification
 * POST /api/notifications/send
 * 
 * This endpoint would be called by backend services or Supabase Edge Functions
 * to send push notifications to students.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, type, title, message, data } = body;

    if (!studentId || !type || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if student has notifications enabled for this type
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('settings')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    const preferences = student.settings?.notifications || {};
    if (preferences[type] === false) {
      return NextResponse.json(
        { message: 'Notifications disabled for this type' },
        { status: 200 }
      );
    }

    // Get student's push subscription
    const { data: subscription, error: subError } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('student_id', studentId)
      .single();

    if (subError || !subscription) {
      return NextResponse.json(
        { error: 'No push subscription found' },
        { status: 404 }
      );
    }

    // Store notification in database
    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        student_id: studentId,
        notification_type: type,
        title,
        message,
        data: data || {},
        read: false,
        created_at: new Date().toISOString(),
      });

    if (notifError) {
      console.error('Failed to create notification:', notifError);
      return NextResponse.json(
        { error: 'Failed to create notification' },
        { status: 500 }
      );
    }

    // In production, you would use a push service like web-push here
    // to actually send the notification to the client
    // For now, we'll just return success
    
    return NextResponse.json({
      success: true,
      message: 'Notification sent',
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
