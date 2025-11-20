import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase-server';
import VenusChatContainer from '@/components/chat/VenusChatContainer';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: {
    sessionId: string;
  };
}

export default async function FeedbackPage({ params }: PageProps) {
  const supabase = createServerClient();
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Fetch and validate the feedback prompt
  const { data: prompt, error } = await supabase
    .from('feedback_prompts')
    .select(`
      id,
      status,
      expires_at,
      prompt_sent_at,
      class_schedule:class_schedules(
        id,
        class:classes(
          id,
          section,
          course:courses(code, name)
        ),
        start_time,
        end_time
      )
    `)
    .eq('id', params.sessionId)
    .eq('student_id', user.id)
    .single();

  // Handle errors or invalid sessions
  if (error || !prompt) {
    redirect('/feedback?error=session_not_found');
  }

  // Check if session is expired
  const now = new Date();
  const expiresAt = new Date(prompt.expires_at);
  if (now > expiresAt) {
    redirect('/feedback?error=session_expired');
  }

  // Check if session is already completed
  if (prompt.status === 'completed') {
    redirect('/feedback?error=already_completed');
  }

  // Check if session is not yet available (before 15min window)
  // Assuming prompt_sent_at indicates when the 15-min window started
  if (prompt.prompt_sent_at) {
    const promptSentAt = new Date(prompt.prompt_sent_at);
    if (now < promptSentAt) {
      redirect('/feedback?error=not_yet_available');
    }
  }

  // Extract course and class information
  // Handle both single object and array responses from Supabase
  // Extract course and class information
  // Handle both single object and array responses from Supabase
  const classSchedule = Array.isArray(prompt.class_schedule) 
    ? prompt.class_schedule[0] 
    : prompt.class_schedule;

  if (!classSchedule) {
    redirect('/feedback?error=schedule_not_found');
  }

  const classInfoRaw = classSchedule?.class;
  const classInfo = Array.isArray(classInfoRaw) ? classInfoRaw[0] : classInfoRaw;
  const courseInfo = classInfo?.course;
  const courseData = Array.isArray(courseInfo) ? courseInfo[0] : courseInfo;
  
  const courseCode = courseData?.code || '';
  const courseName = courseData?.name || 'Class';
  const section = classInfo?.section || '';
  const displayName = courseCode 
    ? `${courseCode}${section ? ` (${section})` : ''}: ${courseName}` 
    : courseName;
  
  // For topic, use the course name
  const topic = courseName || 'Today\'s Lecture';

  return (
    <VenusChatContainer 
      sessionId={params.sessionId}
      classScheduleId={classSchedule.id}
      courseName={displayName}
      topic={topic}
    />
  );
}
