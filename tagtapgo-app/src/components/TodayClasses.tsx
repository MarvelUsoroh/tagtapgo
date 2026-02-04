'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Coins, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { cn, formatTime } from '@/lib/utils';
import { colors } from '@/lib/theme';
import ProgressBar from './ProgressBar';
import { NoClassesToday } from './EmptyState';
import { useScrollAware } from '@/hooks/useScrollAware';
import { useTickLoop } from '@/hooks/useTickLoop';

interface ClassItem {
  id: string;
  course_name: string;
  time: string | null;
  start_time: string;
  end_time: string;
  status: 'completed' | 'in_session' | 'upcoming' | 'missed' | 'ended';
  points_earned?: number;
  potential_points?: number;
}

export default function TodayClasses({ studentId }: { studentId: string }) {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeProgress, setTimeProgress] = useState(0);
  
  // Scroll-aware optimization: pause expensive timer during scroll
  const isScrolling = useScrollAware();

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    (async () => {
      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        
        // Get today's day name (Monday, Tuesday, etc.)
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayName = dayNames[new Date().getDay()];

        // First, get the student's enrolled courses
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('course_id')
          .eq('student_id', studentId);

        const enrolledCourseIds = (enrollments || []).map(e => e.course_id);

        // If no enrollments, return early
        if (enrolledCourseIds.length === 0) {
          if (!cancelled) setClasses([]);
          if (!cancelled) setLoading(false);
          return;
        }

        // Fetch today's scheduled classes for enrolled courses
        // Filter by effective_from/effective_to to get only today's specific sessions
        const { data: scheduleData } = await supabase
          .from('class_schedules')
          .select(`
            id,
            start_time,
            end_time,
            course_id,
            effective_from,
            effective_to,
            courses (
              id,
              name
            )
          `)
          .eq('day_of_week', todayName)
          .in('course_id', enrolledCourseIds)
          .lte('effective_from', today)
          .gte('effective_to', today)
          .order('start_time');

        // Fetch today's attendance to check completion status
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('id, course_id, status')
          .eq('student_id', studentId)
          .eq('date', today);

        // Create a map of course attendance
        const attendanceMap = new Map(
          (attendanceData || []).map(att => [att.course_id, att.status])
        );

        // Fetch points for these attendance records
        const attendanceIds = (attendanceData || []).map(a => a.id);
        const pointsMap = new Map<string, number>();
        
        if (attendanceIds.length > 0) {
          const { data: pointsData } = await supabase
            .from('points')
            .select('reference_id, points')
            .in('reference_id', attendanceIds);
            
          if (pointsData) {
            pointsData.forEach(p => {
              pointsMap.set(p.reference_id, p.points);
            });
          }
        }

        // Transform data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const classItems: ClassItem[] = ((scheduleData as any[]) || [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((schedule: any) => {
            const courseId = schedule.course_id;
            const attendanceStatus = attendanceMap.get(courseId);
            const attendanceRecord = (attendanceData || []).find(a => a.course_id === courseId);
            const points = attendanceRecord ? pointsMap.get(attendanceRecord.id) : 0;
            
            // Calculate potential points based on duration (2 pts/hour)
            let potentialPoints = 0;
            if (schedule.start_time && schedule.end_time) {
              const start = new Date(`1970-01-01T${schedule.start_time}`);
              const end = new Date(`1970-01-01T${schedule.end_time}`);
              const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
              potentialPoints = Math.round(durationHours * 2);
            }

            // Determine status based on time and attendance
            const now = new Date();
            const currentTimeStr = format(now, 'HH:mm:ss');
            let status: ClassItem['status'] = 'upcoming';

            if (attendanceStatus === 'present') {
              status = 'completed';
            } else if (attendanceStatus === 'absent') {
              status = 'missed';
            } else {
              // Time-based status
              if (schedule.end_time < currentTimeStr) {
                status = 'ended'; // Class is over
              } else if (schedule.start_time <= currentTimeStr && schedule.end_time >= currentTimeStr) {
                status = 'in_session'; // Class is happening now
              } else {
                status = 'upcoming'; // Class is in the future
              }
            }

            return {
              id: schedule.id,
              course_name: schedule.courses?.name || 'Unknown Course',
              time: schedule.start_time || null,
              start_time: schedule.start_time,
              end_time: schedule.end_time,
              status,
              points_earned: points || 0,
              potential_points: potentialPoints,
            };
          })
          .filter(item => item.time !== null); // Filter out items with no time

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

  // Memoized progress update function
  const updateProgress = useCallback(() => {
    if (classes.length === 0) {
      setTimeProgress(0);
      return;
    }

    const now = new Date();
    const currentTimeStr = format(now, 'HH:mm:ss');
    const todayStr = format(now, 'yyyy-MM-dd');
    
    let totalProgress = 0;

    classes.forEach(c => {
      // If class is fully in the past (time-wise)
      if (c.end_time <= currentTimeStr) {
        totalProgress += 100;
      } 
      // If class is fully in the future
      else if (c.start_time >= currentTimeStr) {
        totalProgress += 0;
      }
      // If class is active
      else {
        const start = new Date(`${todayStr}T${c.start_time}`);
        const end = new Date(`${todayStr}T${c.end_time}`);
        const total = end.getTime() - start.getTime();
        const elapsed = now.getTime() - start.getTime();
        const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
        totalProgress += pct;
      }
    });

    setTimeProgress(totalProgress / classes.length);
  }, [classes]);

  // Consolidated tick loop - pauses during scroll for smooth UX
  const tickCallbacks = useMemo(() => ({
    progress: updateProgress,
  }), [updateProgress]);

  const tickIntervals = useMemo(() => ({
    progress: 1000, // Update progress every second
  }), []);

  useTickLoop({
    callbacks: tickCallbacks,
    intervals: tickIntervals,
    isScrolling,
    minInterval: 1000,
  });

  // Run initial calculation on mount
  useEffect(() => {
    updateProgress();
  }, [updateProgress]);

  const completedCount = classes.filter((c) => c.status === 'completed').length;
  const totalCount = classes.length;

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
            value={timeProgress}
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
                classItem.status === 'completed' ? 'bg-green-50' :
                classItem.status === 'in_session' ? 'bg-green-50 border border-green-200' :
                classItem.status === 'ended' ? 'bg-gray-100' :
                'bg-white border border-gray-100' // upcoming
              )}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={cn(
                    'w-3 h-3 rounded-full',
                    classItem.status === 'completed' && 'bg-green-500',
                    classItem.status === 'in_session' && 'bg-green-500 animate-pulse',
                    classItem.status === 'upcoming' && 'bg-amber-500',
                    classItem.status === 'ended' && 'bg-gray-400',
                    classItem.status === 'missed' && 'bg-red-400'
                  )}
                  style={
                    classItem.status === 'completed' ? { backgroundColor: colors.success } :
                    classItem.status === 'in_session' ? { backgroundColor: colors.success } :
                    classItem.status === 'upcoming' ? { backgroundColor: colors.warning } :
                    undefined
                  }
                />
                <div>
                  <p className={cn(
                    "font-medium",
                    classItem.status === 'ended' ? "text-gray-500" : "text-gray-900"
                  )}>{classItem.course_name}</p>
                  <p className="text-sm" style={{ color: colors.gray[500] }}>
                    {classItem.time ? formatTime(new Date(`2024-01-01T${classItem.time}`)) : 'Time TBA'}
                    {classItem.status === 'in_session' && <span className="ml-2 text-green-600 font-medium text-xs">● Live</span>}
                    {classItem.status === 'ended' && <span className="ml-2 text-gray-400 text-xs">(Ended)</span>}
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
              {(classItem.status === 'upcoming' || classItem.status === 'in_session') && classItem.potential_points && classItem.potential_points > 0 && (
                <div className={cn(
                  "flex items-center space-x-1 text-xs font-medium px-2 py-1 rounded-full",
                  classItem.status === 'in_session' ? "text-green-700 bg-green-100" : "text-gray-400 bg-gray-100"
                )}>
                  <Coins size={12} />
                  <span>{classItem.potential_points} pts</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
