import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase-server';
import FeedbackClient from './FeedbackClient';

// Disable caching for this page to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FeedbackPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch the feedback prompt
  const { data: promptData, error: promptError } = await supabase
    .from('feedback_prompts')
    .select('*')
    .eq('id', params.sessionId)
    .eq('student_id', user.id)
    .single();

  if (promptError || !promptData) {
    console.error('Feedback prompt error:', promptError);
    redirect('/');
  }

  // Fetch class schedule details separately
  const { data: classSchedule, error: scheduleError } = await supabase
    .from('class_schedules')
    .select(`
      id,
      start_time,
      end_time,
      day_of_week,
      location,
      class_id,
      course_id
    `)
    .eq('id', promptData.class_schedule_id)
    .single();

  if (scheduleError || !classSchedule) {
    console.error('Class schedule error:', scheduleError);
    redirect('/');
  }

  // Fetch class details
  const { data: classData } = await supabase
    .from('classes')
    .select('id, section, course_id')
    .eq('id', classSchedule.class_id)
    .single();

  // Fetch course details
  const { data: courseData } = await supabase
    .from('courses')
    .select('id, code, name')
    .eq('id', classSchedule.course_id)
    .single();

  // Combine the data - use course name as class name
  const enrichedSchedule = {
    ...classSchedule,
    class: {
      id: classData?.id || '',
      name: courseData?.name || 'Unknown Course',
      course: {
        code: courseData?.code || ''
      }
    }
  };

  // Check if prompt is already completed
  if (promptData.status === 'completed') {
    redirect('/?feedback=already-submitted');
  }

  // Check if feedback already submitted (double-check in case status wasn't updated)
  const { data: existingFeedback } = await supabase
    .from('class_feedback')
    .select('id')
    .eq('student_id', user.id)
    .eq('class_schedule_id', promptData.class_schedule_id)
    .single();

  if (existingFeedback) {
    // Update prompt status if it wasn't updated
    await supabase
      .from('feedback_prompts')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', params.sessionId);
    
    redirect('/?feedback=already-submitted');
  }

  // Check if prompt expired
  if (new Date(promptData.expires_at) < new Date()) {
    redirect('/?feedback=expired');
  }

  // Extract timestamp fields with a precise type to avoid any-casts
  const { prompt_sent_at, expires_at } = promptData as {
    prompt_sent_at?: string | null;
    expires_at?: string | null;
  };

  return (
    <FeedbackClient
      promptId={promptData.id}
      classSchedule={enrichedSchedule}
      studentId={user.id}
      sessionDateIso={prompt_sent_at ?? expires_at}
    />
  );
}
