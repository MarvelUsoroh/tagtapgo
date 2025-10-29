'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Coins, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { cn, formatTime, calculatePercentage } from '@/lib/utils';
import { colors } from '@/lib/theme';
import ProgressBar from './ProgressBar';
import { NoClassesToday } from './EmptyState';

interface ClassItem {
  id: string;
  course_name: string;
  time: string;
  status: 'completed' | 'upcoming' | 'missed';
  points_earned?: number;
}

type AttendanceRow = {
  id: string;
  time?: string | null;
  status?: 'present' | 'absent' | 'late' | string | null;
  courses?: {
    name?: string | null;
    schedule?: unknown;
  } | null;
};

export default function TodayClasses({ studentId }: { studentId: string }) {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    (async () => {
      try {
        const today = format(new Date(), 'yyyy-MM-dd');

        // Fetch today's attendance
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select(`
            *,
            courses (
              name,
              schedule
            )
          `)
          .eq('student_id', studentId)
          .eq('date', today);

        // Transform data
        const classItems: ClassItem[] = ((attendanceData as AttendanceRow[] | null) || []).map((att) => ({
          id: att.id,
          course_name: att.courses?.name || 'Unknown Course',
          time: att.time || '09:00',
          status: att.status === 'present' ? 'completed' : 'missed',
          points_earned: att.status === 'present' ? 10 : 0,
        }));

        if (!cancelled) setClasses(classItems);
      } catch (error) {
        console.error('Error fetching classes:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  // Calculate progress
  const completedCount = classes.filter((c) => c.status === 'completed').length;
  const totalCount = classes.length;
  const progressPercentage = calculatePercentage(completedCount, totalCount);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-md p-6"
    >
      <div className="flex items-center justify-between mb-4">
  <h2 className="text-lg font-bold text-gray-900">Today&apos;s Classes</h2>
        {classes.length > 0 && (
          <span className="text-sm font-medium" style={{ color: colors.gray[600] }}>
            {completedCount}/{totalCount}
          </span>
        )}
      </div>

      {/* Progress Bar */}
      {classes.length > 0 && (
        <div className="mb-4">
          <ProgressBar
            value={progressPercentage}
            color="primary"
            height="md"
            animate={true}
            duration={0.8}
          />
        </div>
      )}
      
      {classes.length === 0 ? (
        <NoClassesToday />
      ) : (
        <div className="space-y-2">
          {classes.map((classItem, index) => (
            <motion.div
              key={classItem.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                'flex items-center justify-between p-3 rounded-lg transition-colors',
                classItem.status === 'completed' 
                  ? 'bg-green-50' 
                  : 'bg-gray-50'
              )}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={cn(
                    'w-3 h-3 rounded-full',
                    classItem.status === 'completed' && 'bg-green-500',
                    classItem.status === 'upcoming' && 'bg-amber-500',
                    classItem.status === 'missed' && 'bg-gray-300'
                  )}
                  style={
                    classItem.status === 'completed'
                      ? { backgroundColor: colors.success }
                      : classItem.status === 'upcoming'
                      ? { backgroundColor: colors.warning }
                      : undefined
                  }
                />
                <div>
                  <p className="font-medium text-gray-900">{classItem.course_name}</p>
                  <p className="text-sm" style={{ color: colors.gray[500] }}>
                    {formatTime(new Date(`2024-01-01T${classItem.time}`))}
                  </p>
                </div>
              </div>
              {classItem.status === 'completed' && (
                <div className="flex items-center space-x-2">
                  <div
                    className="flex items-center justify-center w-6 h-6 rounded-full"
                    style={{ backgroundColor: colors.success }}
                  >
                    <Check size={16} className="text-white" />
                  </div>
                  <div className="flex items-center space-x-1 font-semibold" style={{ color: colors.success }}>
                    <Coins size={14} />
                    <span>{classItem.points_earned}</span>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
