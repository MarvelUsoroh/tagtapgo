/**
 * Dashboard Client Component
 * Handles interactivity and real-time updates
 */

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, useMotionValue, animate } from 'framer-motion';
import { Icon } from '@/components/icons';
import { supabase } from '@/lib/supabase';
import type { Student, Streak } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { useDataRefresh } from '@/hooks/useDataRefresh';
import { useScrollAware } from '@/hooks/useScrollAware';
import { useTickLoop } from '@/hooks/useTickLoop';
import { Container } from '@/components/layout/Container';
import { StatCard } from '@/components/dashboard/StatCard';
import { FloatingActionButton } from '@/components/ui/FloatingActionButton';
import TodayClasses from '@/components/TodayClasses';
import RecentAchievements from '@/components/RecentAchievements';
import LeaderboardPreview from '@/components/LeaderboardPreview';
import NotificationPermissionPrompt from '@/components/NotificationPermissionPrompt';
import NotificationBell from '@/components/NotificationBell';
import NotificationsPanel from '@/components/NotificationsPanel';
import Toast, { ToastType } from '@/components/Toast';
import dynamic from 'next/dynamic';
const FeedbackPromptCard = dynamic(() => import('@/components/FeedbackPromptCard'), { ssr: false });
import { colors } from '@/lib/theme';

interface Class {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  location: string;
}

interface Props {
  student: Student | null;
  totalPoints: number;
  currentStreak: Streak | null;
  attendanceRate: number;
  todayClasses: Class[];
  todayCompleted: number;
  badgesCount: number;
  activeClass?: Class | null;
  nextClass?: Class | null;
}

export default function DashboardClient({
  student,
  totalPoints: initialPoints,
  currentStreak: initialStreak,
  attendanceRate,
  todayClasses,
  todayCompleted: initialTodayCompleted,
  badgesCount: initialBadgesCount,
  activeClass,
  nextClass,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = useStore();
  const { refreshGamification } = useDataRefresh();
  
  // Scroll-aware optimization: pause expensive timers during scroll
  const isScrolling = useScrollAware();
  
  // Sync initial SSR data to global store on mount
  useEffect(() => {
    store.setTotalPoints(initialPoints);
    store.setCurrentStreak(initialStreak?.current_streak || 0);
    store.setBadgesCount(initialBadgesCount);
    store.setAttendanceRate(attendanceRate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPoints, initialStreak, initialBadgesCount, attendanceRate]);
  
  // Use store values (synced across app)
  const totalPoints = store.totalPoints;
  const badgesCount = store.badgesCount;
  
  // Memoize sorted classes to avoid recalculation
  const sortedClasses = useMemo(() => 
    [...todayClasses].sort((a, b) => 
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    ), 
    [todayClasses]
  );

  // Memoize active and next class calculations
  const { activeClass: memoizedActiveClass, nextClass: memoizedNextClass } = useMemo(() => {
    const now = new Date();
    
    const active = sortedClasses.find((c) => {
      const start = new Date(c.start_time);
      const end = new Date(c.end_time);
      return now >= start && now <= end;
    });

    const next = sortedClasses.find((c) => {
      const start = new Date(c.start_time);
      return now < start;
    });

    return { activeClass: active, nextClass: next };
  }, [sortedClasses]);

  // Use memoized values or props (props take precedence for SSR data)
  const displayActiveClass = activeClass || memoizedActiveClass || null;
  const displayNextClass = nextClass || memoizedNextClass || null;
  
  // Local UI state
  const [countdown, setCountdown] = useState<string>('');
  const [streakAtRisk, setStreakAtRisk] = useState(false);
  const [currentStreak, setCurrentStreak] = useState<Streak | null>(initialStreak);
  const freezeCount = currentStreak?.freeze_count || 0;
  const [todayCompleted, setTodayCompleted] = useState<number>(initialTodayCompleted);
  
  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  
  // Notifications panel state
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  
  // Count-up animation for points (SSR-safe: render plain number, animate on client)
  const pointsMotion = useMotionValue(initialPoints);
  const [displayPoints, setDisplayPoints] = useState<number>(initialPoints);

  // Handle URL query parameters and show toast notifications
  useEffect(() => {
    const feedback = searchParams.get('feedback');
    
    if (feedback) {
      let message = '';
      let type: ToastType = 'info';
      
      switch (feedback) {
        case 'success':
          message = 'Feedback submitted! Thank you for sharing your thoughts';
          type = 'success';
          break;
        case 'already-submitted':
          message = 'You already submitted feedback for this class';
          type = 'warning';
          break;
        case 'expired':
          message = 'This feedback prompt has expired';
          type = 'error';
          break;
        default:
          message = 'Unknown feedback status';
          type = 'info';
      }
      
      // Show toast
      setToast({ message, type });
      
      // Clean up URL by removing query parameters
      router.replace('/', { scroll: false });
    }
  }, [searchParams, router]);

  // Animate points count-up when totalPoints changes
  useEffect(() => {
    const controls = animate(pointsMotion, totalPoints, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate: (v) => setDisplayPoints(Math.round(v as number)),
    });
    return controls.stop;
  }, [totalPoints, pointsMotion]);

  // Real-time updates - consolidated into single channel
  useEffect(() => {
    if (!student?.id) return;

    const fetchUnreadMentions = async () => {
      // Force fresh fetch bypassing any Next.js caching that might cause stale results
      const { count } = await supabase
        .from('chat_mentions')
        .select('*', { count: 'exact', head: true })
        .eq('mentioned_user_id', student.id)
        .eq('read', false);
      
      store.setUnreadChatMentions(typeof count === 'number' ? count : 0);
    };

    // Fetch initial chat mentions count
    fetchUnreadMentions();

    // Refresh count when tab becomes visible again to catch missed realtime events
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUnreadMentions();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const channel = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'points',
        filter: `student_id=eq.${student.id}`,
      }, (payload: { new: { points: number; transaction_type: string } }) => {
        const newPoints = payload.new.points;
        store.setTotalPoints(store.totalPoints + newPoints);
        
        // Show toast notification
        const transactionType = payload.new.transaction_type;
        const message = transactionType === 'attendance' 
          ? `+${newPoints} points for attending class!`
          : `+${newPoints} points earned!`;
        
        setToast({ message, type: 'success' });
        
        // Trigger debounced refresh
        refreshGamification();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'streaks',
        filter: `student_id=eq.${student.id}`,
      }, (payload: { new: Streak }) => {
        setCurrentStreak(payload.new);
        store.setCurrentStreak(payload.new.current_streak);
        
        // Show toast if streak increased
        if (payload.new.current_streak > (currentStreak?.current_streak || 0)) {
          setToast({ 
            message: `Streak updated to ${payload.new.current_streak} days!`, 
            type: 'success' 
          });
        }
        
        // Trigger debounced refresh
        refreshGamification();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'student_achievements',
        filter: `student_id=eq.${student.id}`,
      }, async (payload: { new: { achievement_id: string } }) => {
        // Fetch achievement details
        const { data: achievement } = await supabase
          .from('achievements')
          .select('*')
          .eq('id', payload.new.achievement_id)
          .single();
        
        if (achievement) {
          setToast({ 
            message: `Achievement unlocked: ${achievement.name}!`, 
            type: 'success' 
          });
        }
        // Increment badge count in store
        store.setBadgesCount(store.badgesCount + 1);
        
        // Trigger debounced refresh
        refreshGamification();
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'student_achievements',
        filter: `student_id=eq.${student.id}`,
      }, () => {
        // Decrement badge count when achievement is removed (cleanup/correction)
        store.setBadgesCount(Math.max(0, store.badgesCount - 1));
        
        // Trigger debounced refresh
        refreshGamification();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'attendance',
        filter: `student_id=eq.${student.id}`,
      }, async () => {
        // Recalculate attendance rate
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase
          .from('attendance')
          .select('status')
          .eq('student_id', student.id)
          .gte('date', since);
        if (data && data.length > 0) {
          const present = data.filter(a => a.status === 'present').length;
          const newRate = Math.round((present / data.length) * 100);
          store.setAttendanceRate(newRate);
        }
        
        // Trigger debounced refresh
        refreshGamification();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_mentions',
        filter: `mentioned_user_id=eq.${student.id}`,
      }, (payload) => {
        console.log('[REALTIME] chat_mentions INSERT payload:', payload);
        if (payload.new && payload.new.read === false) {
          store.setUnreadChatMentions(store.unreadChatMentions + 1);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_mentions',
        filter: `mentioned_user_id=eq.${student.id}`,
      }, (payload) => {
        console.log('[REALTIME] chat_mentions UPDATE payload:', payload);
        // Fallback: just refetch since replica identity might not give us payload.old
        fetchUnreadMentions();
      })
      .subscribe();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [student?.id, currentStreak, store, refreshGamification]);

  // Memoized timer callbacks to avoid recreation on each render
  const computeCompleted = useCallback(() => {
    const now = new Date();
    const completed = todayClasses.filter(c => new Date(c.end_time) < now).length;
    setTodayCompleted(completed);
  }, [todayClasses]);

  const updateCountdown = useCallback(() => {
    if (!displayNextClass) {
      setCountdown('');
      return;
    }

    const now = new Date();
    const classTime = new Date(displayNextClass.start_time);
    const diff = classTime.getTime() - now.getTime();

    if (diff <= 0) {
      setCountdown('');
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const newCountdown = hours > 0 
      ? `${hours}h ${minutes}m`
      : minutes > 0 
        ? `${minutes}m ${seconds}s`
        : `${seconds}s`;

    // Only update state if countdown actually changed
    setCountdown(prev => prev !== newCountdown ? newCountdown : prev);
  }, [displayNextClass]);

  // Consolidated tick loop - pauses during scroll for smooth UX
  const tickCallbacks = useMemo(() => ({
    countdown: updateCountdown,
    completed: computeCompleted,
  }), [updateCountdown, computeCompleted]);

  const tickIntervals = useMemo(() => ({
    countdown: 1000,    // Update countdown every second
    completed: 60000,   // Update completed count every minute
  }), []);

  useTickLoop({
    callbacks: tickCallbacks,
    intervals: tickIntervals,
    isScrolling,
    minInterval: 1000,
  });

  // Run initial calculations on mount
  useEffect(() => {
    computeCompleted();
    updateCountdown();
  }, [computeCompleted, updateCountdown]);

  // Check if streak is at risk
  useEffect(() => {
    if (currentStreak?.last_attendance_date) {
      const lastAttendance = new Date(currentStreak.last_attendance_date);
      const now = new Date();
      const hoursSinceLastAttendance = (now.getTime() - lastAttendance.getTime()) / (1000 * 60 * 60);
      setStreakAtRisk(hoursSinceLastAttendance > 24 && hoursSinceLastAttendance < 48);
    }
  }, [currentStreak]);

  return (
    <div className="min-h-screen bg-white">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      {/* Header Section with Points & Streak */}
      <div className="bg-white border-b border-gray-100">
        <Container>
          <div className="py-6">
            {/* Greeting */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Hi, {student?.first_name || student?.full_name?.split(' ')[0] || 'Student'}!
                </h1>
                <p className="text-sm text-gray-600 mt-1">Keep up the great work!</p>
              </div>
              {student && (
                <NotificationBell
                  studentId={student.id}
                  onClick={() => setNotificationsPanelOpen(true)}
                />
              )}
            </div>

            {/* Points & Streak Cards */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Points Display */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white border border-gray-200 rounded-xl p-4"
              >
                <div className="flex items-center space-x-2 mb-2">
                  <Icon name="cash" size="md" color={colors.rank.gold} />
                  <span className="text-xs text-gray-600 uppercase font-medium">Points</span>
                </div>
                <motion.div className="text-3xl font-bold text-gray-900">
                  {displayPoints}
                </motion.div>
                {totalPoints > 0 && (
                  <div className="flex items-center space-x-1 mt-1">
                    <Icon name="trendingUp" size="sm" color={colors.success} />
                    <span className="text-xs text-gray-600">Growing!</span>
                  </div>
                )}
              </motion.div>

              {/* Streak Display */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white border border-gray-200 rounded-xl p-4"
              >
                <div className="flex items-center space-x-2 mb-2">
                  <Icon name="flame" size="md" color={colors.rank.gold} />
                  <span className="text-xs text-gray-600 uppercase font-medium">Streak</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {currentStreak?.current_streak || 0}
                </div>
                
                {streakAtRisk ? (
                  <div className="flex items-center space-x-1 mt-1">
                    <Icon name="alertCircle" size="sm" color={colors.warning} />
                    <span className="text-xs text-gray-600">At risk!</span>
                  </div>
                ) : freezeCount > 0 ? (
                  <div className="flex items-center space-x-1 mt-1">
                    <Icon name="snow" size="sm" color={colors.info} />
                    <span className="text-xs text-gray-600">{freezeCount} freeze{freezeCount !== 1 ? 's' : ''}</span>
                  </div>
                ) : (
                  <div className="text-xs text-gray-600 mt-1">Keep it up!</div>
                )}
              </motion.div>
            </div>

            {/* Next Class Countdown */}
            {displayNextClass && countdown && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-white border border-gray-200 rounded-xl p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-gray-100 p-2 rounded-lg">
                      <Icon name="time" size="lg" color={colors.primary.DEFAULT} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{displayNextClass.name}</p>
                      <p className="text-xs text-gray-600">{displayNextClass.location}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">{countdown}</div>
                    <div className="text-xs text-gray-600">until class</div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </Container>
      </div>

      {/* Content */}
      <Container>
        <div className="py-4 pb-32 space-y-4">
          {/* Active Class Status */}
          {displayActiveClass && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl p-6 border-2"
              style={{ borderColor: colors.primary.DEFAULT }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="p-3 rounded-lg flex-shrink-0" style={{ backgroundColor: `${colors.primary.DEFAULT}15` }}>
                    <Icon name="flash" size="lg" color={colors.primary.DEFAULT} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{displayActiveClass.name}</p>
                    <p className="text-sm text-gray-600 truncate">{displayActiveClass.location}</p>
                  </div>
                </div>
                <div className="text-left sm:text-right flex-shrink-0 ml-[3.25rem] sm:ml-0">
                  <div className="text-xs text-gray-500 uppercase">Class Active</div>
                  <div className="text-sm font-semibold" style={{ color: colors.primary.DEFAULT }}>
                    In Progress
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Icon name="time" size="sm" color={colors.info} />
                  <p className="text-sm text-blue-800">
                    Attendance will be recorded automatically when synced from your university system
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon="calendar"
              value={`${todayCompleted}/${todayClasses.length}`}
              label="Today"
            />
            <StatCard
              icon="trophy"
              value={badgesCount}
              label="Badges"
            />
          </div>

          {/* Today's Classes */}
          <TodayClasses studentId={student?.id || ''} />

          {/* Feedback Prompts */}
          <FeedbackPromptCard studentId={student?.id || ''} maxPrompts={3} />

          {/* Recent Achievements */}
          <RecentAchievements studentId={student?.id || ''} />

          {/* Leaderboard Preview */}
          <LeaderboardPreview studentId={student?.id || ''} />
        </div>
      </Container>

      {/* Notification Permission Prompt */}
      {student && <NotificationPermissionPrompt studentId={student.id} />}

      {/* Notifications Panel */}
      {student && (
        <NotificationsPanel
          studentId={student.id}
          isOpen={notificationsPanelOpen}
          onClose={() => setNotificationsPanelOpen(false)}
        />
      )}

      {/* Floating Action Button for Community Chat */}
      <FloatingActionButton
        icon="chatFilled"
        onClick={() => router.push('/community')}
        label="Open Community Chat"
        position="bottom-right"
        badgeCount={store.unreadChatMentions}
      />
    </div>
  );
}
