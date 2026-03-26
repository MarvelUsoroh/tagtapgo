'use client';

import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { formatTime } from '@/lib/utils';
import { NoClassesToday } from './EmptyState';
import { useScrollAware } from '@/hooks/useScrollAware';
import { useTickLoop } from '@/hooks/useTickLoop';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassItem {
  id: string;
  course_name: string;
  course_code?: string;
  time: string | null;
  start_time: string;
  end_time: string;
  status: 'in_session' | 'upcoming';
  attendance_status: 'present' | 'not_tagged_in';
  points_earned?: number;
  potential_points?: number;
}

// ─── Ring constants ───────────────────────────────────────────────────────────

const RING_SIZE = 200;                            // large, full-width focal point
const STROKE = 14;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const PRE_SESSION_WINDOW_MINS = 30;

// ─── Large Centred Arc Ring ───────────────────────────────────────────────────

interface ArcRingProps {
  progress: number;        // 0–1
  centerLabel: string;     // big number e.g. "42m"
  centerSub?: string;      // small text e.g. "remaining"
  variant: 'active' | 'pre' | 'urgent';
}

function ArcRing({ progress, centerLabel, centerSub, variant }: ArcRingProps) {
  const offset     = CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, progress)));
  
  let trackColor: string;
  let arcColor: string;
  let textColor: string;
  
  if (variant === 'active') {
    trackColor = '#dcfce7'; // green-100
    arcColor = '#4ADE80';   // green-400
    textColor = '#15803d';  // green-700
  } else if (variant === 'urgent') {
    trackColor = '#fee2e2'; // red-100
    arcColor = '#ef4444';   // red-500
    textColor = '#991b1b';  // red-800
  } else {
    trackColor = '#fef3c7'; // amber-100
    arcColor = '#f59e0b';   // amber-500
    textColor = '#92400e';  // amber-800
  }

  return (
    <svg
      width={RING_SIZE}
      height={RING_SIZE}
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      aria-hidden="true"
    >
      {/* Track */}
      <circle
        cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
        fill="none" stroke={trackColor} strokeWidth={STROKE}
      />
      {/* Progress arc — starts at 12 o'clock */}
      <circle
        cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
        fill="none"
        stroke={arcColor}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />

      {/* Centre: big time label */}
      <text
        x="50%" y={centerSub ? '46%' : '54%'}
        dominantBaseline="middle" textAnchor="middle"
        fill={textColor} fontSize="34" fontWeight="800" fontFamily="inherit"
      >
        {centerLabel}
      </text>

      {/* Centre: sub label */}
      {centerSub && (
        <text
          x="50%" y="60%"
          dominantBaseline="middle" textAnchor="middle"
          fill={textColor} fontSize="13" fontWeight="500" fontFamily="inherit"
          opacity="0.7"
        >
          {centerSub}
        </text>
      )}
    </svg>
  );
}

// ─── Active / Pre-session Ring Display ───────────────────────────────────────

interface ActiveRingProps {
  classItem: ClassItem;
  now: Date;
}

function ActiveRing({ classItem, now }: ActiveRingProps) {
  const todayStr   = format(now, 'yyyy-MM-dd');
  const startDt    = new Date(`${todayStr}T${classItem.start_time}`);
  const endDt      = new Date(`${todayStr}T${classItem.end_time}`);
  const isInSession = classItem.status === 'in_session';
  const isTaggedIn = classItem.attendance_status === 'present';

  let progress = 0;
  let centerLabel = '';
  let centerSub: string | undefined;
  let variant: 'active' | 'pre' | 'urgent';
  
  // Determine variant based on session status and tag-in status
  if (isInSession && isTaggedIn) {
    variant = 'active'; // Green - tagged in and class is running
  } else if (isInSession && !isTaggedIn) {
    variant = 'urgent'; // Red - class started but not tagged in
  } else {
    variant = 'pre'; // Amber - upcoming class
  }

  if (isInSession) {
    const total   = endDt.getTime() - startDt.getTime();
    const elapsed = now.getTime() - startDt.getTime();
    progress = Math.min(1, Math.max(0, elapsed / total));

    const remainMs  = Math.max(0, endDt.getTime() - now.getTime());
    const remainMin = Math.floor(remainMs / 60000);
    const remainSec = Math.floor((remainMs % 60000) / 1000);

    if (isTaggedIn) {
      // Tagged in - show time remaining
      if (remainMin >= 60) {
        const h = Math.floor(remainMin / 60);
        const m = remainMin % 60;
        centerLabel = `${h}h${m > 0 ? ` ${m}m` : ''}`;
        centerSub   = 'remaining';
      } else if (remainMin > 0) {
        centerLabel = `${remainMin}m`;
        centerSub   = `${remainSec}s remaining`;
      } else {
        centerLabel = `${remainSec}s`;
        centerSub   = 'ending soon';
      }
    } else {
      // Not tagged in - show urgent message
      if (remainMin >= 60) {
        const h = Math.floor(remainMin / 60);
        const m = remainMin % 60;
        centerLabel = `${h}h${m > 0 ? ` ${m}m` : ''}`;
        centerSub   = 'to tag in';
      } else if (remainMin > 0) {
        centerLabel = `${remainMin}m`;
        centerSub   = 'tag in now!';
      } else {
        centerLabel = `${remainSec}s`;
        centerSub   = 'tag in now!';
      }
    }
  } else {
    // Pre-session: progress = fraction of 30-min window elapsed (fills as arrival approaches)
    const windowMs  = PRE_SESSION_WINDOW_MINS * 60 * 1000;
    const elapsed   = now.getTime() - (startDt.getTime() - windowMs);
    progress = Math.min(1, Math.max(0, elapsed / windowMs));

    const untilMs  = Math.max(0, startDt.getTime() - now.getTime());
    const untilMin = Math.floor(untilMs / 60000);
    const untilSec = Math.floor((untilMs % 60000) / 1000);

    if (untilMin >= 60) {
      const h = Math.floor(untilMin / 60);
      const m = untilMin % 60;
      centerLabel = `${h}h${m > 0 ? ` ${m}m` : ''}`;
    } else if (untilMin > 0) {
      centerLabel = `${untilMin}m`;
    } else {
      centerLabel = `${untilSec}s`;
    }
    centerSub = untilMin > 0 || untilSec > 0 ? 'until class' : 'starting now';
  }

  const startFormatted = classItem.time
    ? formatTime(new Date(`2024-01-01T${classItem.time}`))
    : 'TBA';

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Ring */}
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      >
        <ArcRing
          progress={progress}
          centerLabel={centerLabel}
          centerSub={centerSub}
          variant={variant}
        />
      </motion.div>

      {/* Course name + single subtitle line */}
      <div className="text-center px-2">
        <p className="text-base font-bold text-gray-900 leading-tight truncate max-w-[220px]">
          {classItem.course_name}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {[classItem.course_code, startFormatted].filter(Boolean).join(' · ')}
        </p>
      </div>

    </div>
  );
}

// CompactRow removed — ActiveRing is now used for all classes.

// ─── Main Component ───────────────────────────────────────────────────────────

function TodayClasses({ studentId }: { studentId: string }) {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow]         = useState(() => new Date());

  const isScrolling = useScrollAware();

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;

    (async () => {
      try {
        const today     = format(new Date(), 'yyyy-MM-dd');
        const dayNames  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayName = dayNames[new Date().getDay()];

        const { data: enrollments } = await supabase
          .from('enrollments').select('course_id').eq('student_id', studentId);

        const enrolledCourseIds = (enrollments || []).map(e => e.course_id);
        if (enrolledCourseIds.length === 0) {
          if (!cancelled) { setClasses([]); setLoading(false); }
          return;
        }

        const { data: scheduleData } = await supabase
          .from('class_schedules')
          .select(`id, start_time, end_time, course_id, effective_from, effective_to, metadata,
                   courses ( id, name, code )`)
          .eq('day_of_week', todayName)
          .in('course_id', enrolledCourseIds)
          .lte('effective_from', today)
          .gte('effective_to', today)
          .order('start_time');

        const { data: attendanceData } = await supabase
          .from('attendance').select('id, course_id, status, session_id')
          .eq('student_id', studentId).eq('date', today);

        // Map attendance by session_id for precise matching
        const attendanceBySessionMap = new Map(
          (attendanceData || []).map(att => [att.session_id, att])
        );

        const attendanceIds = (attendanceData || []).map(a => a.id);
        const pointsMap = new Map<string, number>();
        if (attendanceIds.length > 0) {
          const { data: pointsData } = await supabase
            .from('points').select('reference_id, points').in('reference_id', attendanceIds);
          (pointsData || []).forEach(p => pointsMap.set(p.reference_id, p.points));
        }

        const loadedNow      = new Date();
        const currentTimeStr = format(loadedNow, 'HH:mm:ss');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const classItems: ClassItem[] = ((scheduleData as any[]) || [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((schedule: any): ClassItem | null => {
            const courseId  = schedule.course_id;
            const sessionId = schedule.metadata?.session_id?.toString();
            
            // Match attendance by session_id from metadata
            const attRecord = sessionId ? attendanceBySessionMap.get(sessionId) : null;
            const attStatus = attRecord?.status;
            const points    = attRecord ? pointsMap.get(attRecord.id) : 0;
            const duration  = schedule.start_time && schedule.end_time
              ? (new Date(`1970-01-01T${schedule.end_time}`).getTime() -
                 new Date(`1970-01-01T${schedule.start_time}`).getTime()) / 3600000
              : 0;

            // Skip classes that have already ended
            if (schedule.end_time < currentTimeStr) {
              return null;
            }
            
            // Skip classes that are absent (missed entirely)
            if (attStatus === 'absent') {
              return null;
            }

            let status: ClassItem['status'];
            if (schedule.start_time <= currentTimeStr && schedule.end_time >= currentTimeStr) {
              status = 'in_session';
            } else {
              status = 'upcoming';
            }
            
            const attendance_status: ClassItem['attendance_status'] = 
              attStatus === 'present' ? 'present' : 'not_tagged_in';

            return {
              id: schedule.id,
              course_name: schedule.courses?.name || 'Unknown Course',
              course_code: schedule.courses?.code,
              time: schedule.start_time || null,
              start_time: schedule.start_time,
              end_time: schedule.end_time,
              status,
              attendance_status,
              points_earned: points || 0,
              potential_points: Math.round(duration * 2),
            };
          })
          .filter((item): item is ClassItem => item !== null && item.time !== null);

        if (!cancelled) setClasses(classItems);
      } catch (error) {
        console.error('Error fetching classes:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [studentId]);

  // ── Live tick ─────────────────────────────────────────────────────────────
  const tickNow      = useCallback(() => setNow(new Date()), []);
  const tickCallbacks = useMemo(() => ({ tick: tickNow }),  [tickNow]);
  const tickIntervals  = useMemo(() => ({ tick: 1000 }),   []);
  useTickLoop({ callbacks: tickCallbacks, intervals: tickIntervals, isScrolling, minInterval: 1000 });

  // ── Realtime attendance updates ───────────────────────────────────────────
  useEffect(() => {
    if (!studentId) return;

    const channel = supabase
      .channel(`user:${studentId}:attendance`, {
        config: { private: true }
      })
      .on('broadcast', { event: 'attendance_insert' }, (payload) => {
        // New attendance record - update class status
        const attendance = payload.payload.new;
        setClasses(prev => prev.map(c => {
          // Match by course_id and session_id from metadata
          const sessionId = c.id; // class_schedule id
          if (attendance.course_id === c.course_id) {
            return {
              ...c,
              attendance_status: attendance.status === 'present' ? 'present' : 'not_tagged_in'
            };
          }
          return c;
        }));
      })
      .on('broadcast', { event: 'attendance_update' }, (payload) => {
        // Updated attendance record - update class status
        const attendance = payload.payload.new;
        setClasses(prev => prev.map(c => {
          if (attendance.course_id === c.course_id) {
            return {
              ...c,
              attendance_status: attendance.status === 'present' ? 'present' : 'not_tagged_in'
            };
          }
          return c;
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId]);

  // All classes rendered with ActiveRing — no selection needed

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-md p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="flex justify-center">
            <div className="h-52 w-52 bg-gray-200 rounded-full" />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-md p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-900">Today&apos;s Classes</h2>
        {classes.length > 0 && (
          <span className="text-sm font-medium text-gray-400">
            {classes.length} {classes.length === 1 ? 'class' : 'classes'}
          </span>
        )}
      </div>

      {classes.length === 0 ? (
        <NoClassesToday />
      ) : (
        <div className="space-y-6">
          {classes.map((classItem, index) => (
            <motion.div
              key={classItem.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              {index > 0 && <div className="border-t border-gray-100 mb-6" />}
              <div className="flex justify-center">
                <ActiveRing classItem={classItem} now={now} />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default memo(TodayClasses);
