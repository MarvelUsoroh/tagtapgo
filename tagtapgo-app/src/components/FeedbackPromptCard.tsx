'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Clock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { colors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

interface FeedbackPrompt {
  id: string;
  class_schedule_id: string;
  expires_at: string;
  status: string;
  prompt_sent_at: string | null;
  created_at?: string | null;
  class_schedule: {
    id: string;
    day_of_week: string;
    class: {
      id: string;
      section: string;
      course: {
        code: string;
        name: string;
      };
    };
    start_time: string | null;
    end_time: string | null;
  } | {
    id: string;
    day_of_week: string;
    class: {
      id: string;
      section: string;
      course: {
        code: string;
        name: string;
      };
    };
    start_time: string | null;
    end_time: string | null;
  }[];
}

interface FeedbackPromptCardProps {
  studentId: string;
  maxPrompts?: number;
}

export default function FeedbackPromptCard({
  studentId,
  maxPrompts = 3,
}: FeedbackPromptCardProps) {
  const router = useRouter();
  const [prompts, setPrompts] = useState<FeedbackPrompt[]>([]);
  const [totalPrompts, setTotalPrompts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<Record<string, string>>({});

  // Fetch pending feedback prompts
  const fetchPrompts = useCallback(async () => {
    try {
      // First get total count
      const { count } = await supabase
        .from('feedback_prompts')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', studentId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

      setTotalPrompts(count || 0);

      // Then get limited results for display
      const { data, error } = await supabase
        .from('feedback_prompts')
        .select(`
          id,
          class_schedule_id,
          expires_at,
          status,
          prompt_sent_at,
          created_at,
          class_schedule:class_schedules(
            id,
            day_of_week,
            class:classes(
              id,
              section,
              course:courses(
                code,
                name
              )
            ),
            start_time,
            end_time
          )
        `)
        .eq('student_id', studentId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: true })
        .limit(maxPrompts);

      if (error) throw error;

      // Type assertion needed due to Supabase nested query structure
      const rows = (data as unknown as FeedbackPrompt[]) || [];
      setPrompts(rows);
    } catch (error) {
      console.error('Failed to fetch feedback prompts:', error);
    } finally {
      setLoading(false);
    }
  }, [studentId, maxPrompts]);

  // Calculate time remaining for each prompt
  const updateTimeRemaining = useCallback(() => {
    const newTimeRemaining: Record<string, string> = {};

    prompts.forEach((prompt) => {
      const expiresAt = new Date(prompt.expires_at);
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();

      if (diffMs <= 0) {
        newTimeRemaining[prompt.id] = 'Expired';
      } else {
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
          newTimeRemaining[prompt.id] = `${hours}h ${minutes}m left`;
        } else {
          newTimeRemaining[prompt.id] = `${minutes}m left`;
        }
      }
    });

    setTimeRemaining(newTimeRemaining);
  }, [prompts]);

  // Initial fetch
  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  // Update time remaining every minute
  useEffect(() => {
    if (prompts.length > 0) {
      updateTimeRemaining();
      const interval = setInterval(updateTimeRemaining, 60000); // Update every minute
      return () => clearInterval(interval);
    }
  }, [prompts, updateTimeRemaining]);

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('feedback-prompts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feedback_prompts',
          filter: `student_id=eq.${studentId}`,
        },
        () => {
          fetchPrompts();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'feedback_prompts',
          filter: `student_id=eq.${studentId}`,
        },
        () => {
          fetchPrompts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId, fetchPrompts]);

  const handlePromptClick = (promptId: string) => {
    router.push(`/feedback/${promptId}`);
  };

  const getClassSchedule = useCallback((prompt: FeedbackPrompt) => {
    // Handle both single object and array responses from Supabase
    return Array.isArray(prompt.class_schedule) 
      ? prompt.class_schedule[0] 
      : prompt.class_schedule;
  }, []);

  const getClassDateLabel = useCallback((prompt: FeedbackPrompt) => {
    // Use prompt_sent_at (or expires_at) for the date label; start_time is TIME-only
    const raw = prompt.prompt_sent_at || prompt.expires_at;
    if (!raw) return 'Date TBA';

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return 'Date TBA';
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  const getClassTimeLabel = useCallback((prompt: FeedbackPrompt) => {
    // start_time is a TIME string like "09:00:00", format it directly
    const schedule = getClassSchedule(prompt);
    const timeStr = schedule?.start_time;
    if (!timeStr) return 'Time TBA';
    
    try {
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours, 10);
      const min = parseInt(minutes, 10);
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}:${min.toString().padStart(2, '0')} ${period}`;
    } catch {
      return 'Time TBA';
    }
  }, [getClassSchedule]);

  // Don't render if loading or no prompts
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (prompts.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-md p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare size={20} style={{ color: colors.primary.DEFAULT }} />
        <h3 className="font-semibold text-gray-900">Class Review</h3>
        <span
          className="ml-auto text-xs font-semibold px-3 py-2 rounded-full"
          style={{
            backgroundColor: colors.primary.light + '40',
            color: colors.primary.dark,
          }}
        >
          {totalPrompts} {totalPrompts === 1 ? 'class' : 'classes'}
        </span>
        <span className="sr-only" aria-live="polite">
          You have {totalPrompts} pending reviews {totalPrompts === 1 ? 'item' : 'items'}
        </span>
      </div>

      <AnimatePresence mode="popLayout">
        <div className="space-y-2">
          {prompts.map((prompt, index) => (
            <motion.button
              key={prompt.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => handlePromptClick(prompt.id)}
              className={cn(
                'w-full p-3 rounded-lg border-2 transition-all',
                'hover:shadow-md hover:scale-[1.02]',
                'focus:outline-none focus:ring-2 focus:ring-primary',
                'text-left'
              )}
              style={{
                borderColor: colors.primary.light,
                backgroundColor: colors.primary.light + '10',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {(() => {
                      const schedule = getClassSchedule(prompt);
                      const courseCode = schedule?.class?.course?.code;
                      const courseName = schedule?.class?.course?.name || 'Class';
                      
                      // If the name already starts with the code (e.g. "CS101 - Intro"), don't prepend it again
                      if (courseCode && courseName.startsWith(courseCode)) {
                        return courseName;
                      }
                      
                      return courseCode ? `${courseCode}: ${courseName}` : courseName;
                    })()}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {getClassDateLabel(prompt)} • {getClassTimeLabel(prompt)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock size={14} />
                      <span>{timeRemaining[prompt.id] || 'Loading...'}</span>
                    </div>
                  </div>
                </div>
                <ChevronRight
                  size={20}
                  className="flex-shrink-0 text-gray-400"
                />
              </div>
            </motion.button>
          ))}
          {totalPrompts > maxPrompts && (
            <div className="pt-1">
              <Link
                href="/feedback"
                className="text-sm font-medium hover:underline inline-flex items-center gap-1"
                style={{ color: colors.primary.DEFAULT }}
                aria-label={`View all ${totalPrompts} pending feedback items`}
              >
                View all pending reviews
                <ChevronRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </AnimatePresence>


    </motion.div>
  );
}
