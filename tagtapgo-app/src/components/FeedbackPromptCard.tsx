'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Clock, ChevronRight } from 'lucide-react';
import { cn, formatTime } from '@/lib/utils';
import { colors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

interface FeedbackPrompt {
  id: string;
  class_schedule_id: string;
  expires_at: string;
  status: string;
  class_schedule: {
    id: string;
    class: {
      id: string;
      name: string;
      course: {
        code: string;
      };
    };
    start_time: string;
    end_time: string;
  };
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
          class_schedule:class_schedules!inner(
            id,
            class:classes!inner(
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
        <h3 className="font-semibold text-gray-900">Pending Feedback</h3>
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
          You have {totalPrompts} pending feedback {totalPrompts === 1 ? 'item' : 'items'}
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
                    {prompt.class_schedule.class.course?.code
                      ? `${prompt.class_schedule.class.course.code}: `
                      : ''}
                    {prompt.class_schedule.class.name}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {new Date(prompt.class_schedule.start_time).toLocaleDateString(
                      'en-US',
                      {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      }
                    )}{' '}
                    • {formatTime(prompt.class_schedule.start_time)}
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock size={14} />
                      <span>{timeRemaining[prompt.id] || 'Loading...'}</span>
                    </div>
                    <div className="text-xs font-semibold text-primary">
                      💎 Earn 5-10 pts
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
                View all pending feedback
                <ChevronRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </AnimatePresence>

      <p className="text-xs text-gray-500 mt-3 text-center">
        Share your thoughts and earn bonus points
      </p>
    </motion.div>
  );
}
