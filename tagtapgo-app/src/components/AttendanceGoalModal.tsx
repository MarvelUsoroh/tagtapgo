'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Target, Calendar, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { colors } from '@/lib/theme';
import AttendanceGoalProgress from './AttendanceGoalProgress';
import { supabase } from '@/lib/supabase';

interface AttendanceGoalModalProps {
  studentId?: string;
  isOpen: boolean;
  onClose: () => void;
  currentGoal?: {
    type: 'weekly' | 'monthly';
    target_percentage: number;
  };
  currentProgress?: {
    current: number;
    status: 'on_track' | 'behind' | 'achieved';
  };
  onSave?: () => void;
}

export default function AttendanceGoalModal({
  isOpen,
  onClose,
  currentGoal,
  currentProgress,
  onSave,
}: AttendanceGoalModalProps) {
  const [goalType, setGoalType] = useState<'weekly' | 'monthly'>(
    currentGoal?.type || 'monthly'
  );
  const [targetPercentage, setTargetPercentage] = useState(
    currentGoal?.target_percentage || 90
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update state when currentGoal changes
  useEffect(() => {
    if (currentGoal) {
      setGoalType(currentGoal.type);
      setTargetPercentage(currentGoal.target_percentage);
    }
  }, [currentGoal]);

  // Calculate preview text
  const getPreviewText = () => {
    if (goalType === 'weekly') {
      const classesNeeded = Math.ceil((targetPercentage / 100) * 5);
      return `Attend ${classesNeeded} out of 5 classes per week`;
    } else {
      const classesNeeded = Math.ceil((targetPercentage / 100) * 20);
      return `Attend ${classesNeeded} out of 20 classes per month`;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/attendance-goal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            type: goalType,
            target_percentage: targetPercentage,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update goal');
      }

      // Success! Call onSave callback and close modal
      if (onSave) {
        onSave();
      }
      onClose();
    } catch (err) {
      console.error('[Goal Modal] Error saving goal:', err);
      setError(err instanceof Error ? err.message : 'Failed to save goal');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-4"
          >
            <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg mx-auto max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm px-6 py-4 flex items-center justify-between rounded-t-3xl sm:rounded-t-none">
                <div className="flex items-center gap-2">
                  <Target size={24} style={{ color: colors.primary.DEFAULT }} />
                  <h2 className="text-xl font-bold text-gray-900">
                    Customize Your Goal
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={24} className="text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Current Progress (if available) */}
                {currentProgress && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Current Progress
                    </p>
                    <AttendanceGoalProgress
                      current={currentProgress.current}
                      target={currentGoal?.target_percentage || 90}
                      status={currentProgress.status}
                      animated={false}
                    />
                  </div>
                )}

                {/* Goal Type Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Goal Type
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setGoalType('weekly')}
                      className={cn(
                        'flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all',
                        goalType === 'weekly'
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                      style={{
                        borderColor:
                          goalType === 'weekly' ? colors.primary.DEFAULT : undefined,
                      }}
                    >
                      <Calendar size={20} />
                      <span className="font-medium">Weekly</span>
                    </button>
                    <button
                      onClick={() => setGoalType('monthly')}
                      className={cn(
                        'flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all',
                        goalType === 'monthly'
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                      style={{
                        borderColor:
                          goalType === 'monthly' ? colors.primary.DEFAULT : undefined,
                      }}
                    >
                      <CalendarDays size={20} />
                      <span className="font-medium">Monthly</span>
                    </button>
                  </div>
                </div>

                {/* Target Percentage Slider */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Target Attendance: {targetPercentage}%
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    step="5"
                    value={targetPercentage}
                    onChange={(e) => setTargetPercentage(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                    style={{
                      accentColor: colors.primary.DEFAULT,
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    What this means:
                  </p>
                  <p className="text-sm text-blue-700">{getPreviewText()}</p>
                </div>

                {/* Error message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    disabled={saving}
                    className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 px-4 py-3 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                    style={{
                      backgroundColor: colors.primary.DEFAULT,
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Goal'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
