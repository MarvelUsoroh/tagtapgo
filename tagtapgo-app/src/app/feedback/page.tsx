import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createServerClient } from '@/lib/supabase-server';
import BottomNav from '@/components/BottomNav';
import { colors } from '@/lib/theme';

export const dynamic = 'force-dynamic';

type PromptRow = {
  id: string;
  expires_at: string;
  prompt_sent_at: string | null;
  class_schedule: {
    id: string;
    class: {
      id: string;
      section: string;
      course?: { code?: string; name?: string } | null;
    };
    start_time: string;
    end_time: string;
  } | {
    id: string;
    class: {
      id: string;
      section: string;
      course?: { code?: string; name?: string } | null;
    };
    start_time: string;
    end_time: string;
  }[];
};

export default async function FeedbackListPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Error messages for different scenarios
  const errorMessages: Record<string, string> = {
    session_not_found: 'Feedback session not found or you don\'t have access to it.',
    session_expired: 'This feedback session has expired.',
    already_completed: 'You\'ve already completed this feedback session.',
    not_yet_available: 'This feedback session is not yet available.',
  };

  const errorMessage = searchParams.error ? errorMessages[searchParams.error] : null;

  const { data, error } = await supabase
    .from('feedback_prompts')
    .select(`
      id,
      expires_at,
      prompt_sent_at,
      status,
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
    .eq('student_id', user.id)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true });

  if (error) {
    // On error, fallback to dashboard
    redirect('/');
  }

  const prompts: PromptRow[] = (data || []) as unknown as PromptRow[];

  // Auto-redirect if there's only one pending feedback
  if (prompts.length === 1 && !searchParams.error) {
    redirect(`/feedback/${prompts[0].id}`);
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header with Back Button */}
      <header className="sticky top-0 z-10 bg-white border-b" style={{ borderColor: colors.gray[200] }}>
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-6 h-6" style={{ color: colors.gray[700] }} />
            </Link>
            <div>
              <h1 className="text-xl font-bold" style={{ color: colors.gray[900] }}>
                Pending Feedback
              </h1>
              <p className="text-sm" style={{ color: colors.gray[600] }}>
                {prompts.length} {prompts.length === 1 ? 'class' : 'classes'} waiting for your feedback
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Error Message */}
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-medium" style={{ color: colors.danger }}>
              {errorMessage}
            </p>
          </div>
        )}

        {prompts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg font-medium mb-2" style={{ color: colors.gray[600] }}>
              No pending feedback right now
            </p>
            <p className="text-sm" style={{ color: colors.gray[500] }}>
              Check back after your classes
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {prompts.map((prompt) => {
              // Handle both single object and array responses from Supabase
              const classSchedule = Array.isArray(prompt.class_schedule) 
                ? prompt.class_schedule[0] 
                : prompt.class_schedule;
              
              return (
              <li key={prompt.id} className="bg-white rounded-xl shadow-sm border p-4" style={{ borderColor: colors.gray[200] }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ color: colors.gray[900] }}>
                      {classSchedule?.class?.course?.code
                        ? `${classSchedule.class.course.code}: `
                        : ''}
                      {classSchedule?.class?.course?.name ?? 'Class'}
                    </p>
                    {(() => {
                      // Use prompt_sent_at for the date label
                      const classDateRaw = prompt.prompt_sent_at || prompt.expires_at;
                      const date = classDateRaw ? new Date(classDateRaw) : null;
                      const dateLabel = !date || Number.isNaN(date.getTime())
                        ? 'Date TBA'
                        : date.toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          });
                      
                      // start_time is a TIME string like "09:00:00", format it directly
                      let timeLabel = 'Time TBA';
                      if (classSchedule?.start_time) {
                        const timeStr = classSchedule.start_time;
                        const [hours, minutes] = timeStr.split(':');
                        const hour = parseInt(hours, 10);
                        const min = parseInt(minutes, 10);
                        const period = hour >= 12 ? 'PM' : 'AM';
                        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                        timeLabel = `${displayHour}:${min.toString().padStart(2, '0')} ${period}`;
                      }

                      return (
                        <p className="text-sm mt-1" style={{ color: colors.gray[600] }}>
                          {dateLabel} • {timeLabel}
                        </p>
                      );
                    })()}
                    {(() => {
                      const expires = new Date(prompt.expires_at);
                      const label = Number.isNaN(expires.getTime())
                        ? 'Unknown'
                        : expires.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          });

                      return (
                        <p className="text-xs mt-2" style={{ color: colors.gray[500] }}>
                          Expires {label}
                        </p>
                      );
                    })()}
                  </div>
                  <Link
                    href={`/feedback/${prompt.id}`}
                    className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity flex-shrink-0"
                    style={{ 
                      backgroundColor: colors.primary.DEFAULT,
                      minHeight: '44px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    Give Feedback
                  </Link>
                </div>
              </li>
            );
            })}
          </ul>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
