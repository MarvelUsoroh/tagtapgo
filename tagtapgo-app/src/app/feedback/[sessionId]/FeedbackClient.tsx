'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Star, MessageSquare, Send, X } from 'lucide-react';
import { cn, formatTime } from '@/lib/utils';
import { colors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

interface ClassSchedule {
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
}

interface FeedbackClientProps {
  promptId: string;
  classSchedule: ClassSchedule;
  studentId: string;
}

export default function FeedbackClient({
  promptId,
  classSchedule,
  studentId,
}: FeedbackClientProps) {
  const router = useRouter();
  const [contentQuality, setContentQuality] = useState(0);
  const [clarity, setClarity] = useState(0);
  const [pace, setPace] = useState(0);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStarClick = (
    rating: number,
    setter: (value: number) => void
  ) => {
    setter(rating);
  };

  const handleSubmit = async () => {
    // Validate ratings
    if (contentQuality === 0 || clarity === 0 || pace === 0) {
      setError('Please rate all three categories');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Call the submit-feedback Edge Function
      const { data, error: submitError } = await supabase.functions.invoke(
        'submit-feedback',
        {
          body: {
            student_id: studentId,
            class_id: classSchedule.class.id,
            class_schedule_id: classSchedule.id,
            prompt_id: promptId,
            content_quality: contentQuality,
            clarity: clarity,
            pace: pace,
            comment: comment.trim() || null,
            is_anonymous: isAnonymous,
          },
        }
      );

      if (submitError) {
        throw submitError;
      }

      // Show success and redirect
      const pointsEarned = data?.points_earned || (comment.trim() ? 10 : 5);
      router.push(`/?feedback=success&points=${pointsEarned}`);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      setError('Failed to submit feedback. Please try again.');
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    router.push('/');
  };

  const pointsIncentive = comment.trim() ? 10 : 5;

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {classSchedule.class.course?.code
                  ? `${classSchedule.class.course.code}: `
                  : ''}
                {classSchedule.class.name}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {new Date(classSchedule.start_time).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}{' '}
                • {formatTime(classSchedule.start_time)} -{' '}
                {formatTime(classSchedule.end_time)}
              </p>
            </div>
            <button
              onClick={handleSkip}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close"
            >
              <X size={24} className="text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-md p-6"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            How was today&apos;s lecture?
          </h2>
          <p className="text-gray-600 mb-6">
            Your feedback helps improve the course quality
          </p>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Rating Categories */}
          <div className="space-y-6 mb-6">
            {/* Content Quality */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">📚</span>
                <h3 className="text-lg font-semibold text-gray-900">
                  Content Quality
                </h3>
              </div>
              <StarRating
                rating={contentQuality}
                onChange={(rating) => handleStarClick(rating, setContentQuality)}
              />
            </div>

            {/* Clarity */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🎯</span>
                <h3 className="text-lg font-semibold text-gray-900">
                  Clarity
                </h3>
              </div>
              <StarRating
                rating={clarity}
                onChange={(rating) => handleStarClick(rating, setClarity)}
              />
            </div>

            {/* Pace */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">⚡</span>
                <h3 className="text-lg font-semibold text-gray-900">Pace</h3>
              </div>
              <StarRating
                rating={pace}
                onChange={(rating) => handleStarClick(rating, setPace)}
              />
            </div>
          </div>

          {/* Comment */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={20} className="text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                What did you learn today?
              </h3>
              <span className="text-sm text-gray-500">(optional)</span>
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your thoughts..."
              rows={4}
              className={cn(
                'w-full px-4 py-3 border border-gray-300 rounded-lg',
                'focus:ring-2 focus:ring-primary focus:border-transparent',
                'resize-none transition-all'
              )}
              style={{
                '--tw-ring-color': colors.primary.DEFAULT,
              } as React.CSSProperties}
            />
            <p className="text-sm text-gray-500 mt-2">
              💎 Earn +5 bonus points for adding a comment
            </p>
          </div>

          {/* Anonymous Toggle */}
          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                style={{
                  accentColor: colors.primary.DEFAULT,
                }}
              />
              <span className="text-gray-700">
                Submit anonymously (recommended)
              </span>
            </label>
          </div>

          {/* Points Incentive */}
          <div
            className="mb-6 p-4 rounded-lg"
            style={{ backgroundColor: colors.primary.light + '20' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">
                  Earn {pointsIncentive} points
                </p>
                <p className="text-sm text-gray-600">
                  {comment.trim()
                    ? '5 pts for ratings + 5 pts for comment'
                    : '5 pts for ratings only'}
                </p>
              </div>
              <div className="text-3xl">💎</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              disabled={submitting}
              className={cn(
                'flex-1 px-6 py-3 rounded-lg font-semibold',
                'bg-gray-100 text-gray-700',
                'hover:bg-gray-200 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Skip
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || contentQuality === 0 || clarity === 0 || pace === 0}
              className={cn(
                'flex-1 px-6 py-3 rounded-lg font-semibold',
                'text-white flex items-center justify-center gap-2',
                'transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                'hover:shadow-lg'
              )}
              style={{
                backgroundColor: colors.primary.DEFAULT,
              }}
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send size={20} />
                  Submit Feedback
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// Star Rating Component
function StarRating({
  rating,
  onChange,
}: {
  rating: number;
  onChange: (rating: number) => void;
}) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange(star)}
          className="focus:outline-none focus:ring-2 focus:ring-primary rounded-full p-1 transition-transform hover:scale-110"
          aria-label={`Rate ${star} stars`}
        >
          <Star
            size={40}
            className={cn(
              'transition-all',
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-none text-gray-300'
            )}
          />
        </button>
      ))}
    </div>
  );
}
