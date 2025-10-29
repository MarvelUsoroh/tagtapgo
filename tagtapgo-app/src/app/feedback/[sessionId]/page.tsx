import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase-server';
import FeedbackClient from './FeedbackClient';

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

  // Fetch the feedback prompt and class schedule details
  const { data: promptData, error: promptError } = await supabase
    .from('feedback_prompts')
    .select(`
      *,
      class_schedule:class_schedules(
        id,
        class:classes(
          id,
          name,
          course:courses(
            code
          )
        ),
        start_time,
        end_time
      )
    `)
    .eq('id', params.sessionId)
    .eq('student_id', user.id)
    .single();

  if (promptError || !promptData) {
    redirect('/');
  }

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

  return (
    <FeedbackClient
      promptId={promptData.id}
      classSchedule={promptData.class_schedule}
      studentId={user.id}
    />
  );
}
