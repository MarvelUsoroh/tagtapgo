/**
 * Dashboard Client Component
 * Handles interactivity and real-time updates
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, useMotionValue, animate } from 'framer-motion';
import { Flame, Coins, Trophy, Target, TrendingUp, Calendar, Zap, Clock, AlertCircle, Snowflake } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Student, Streak } from '@/lib/supabase';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import TodayClasses from '@/components/TodayClasses';
import RecentAchievements from '@/components/RecentAchievements';
import LeaderboardPreview from '@/components/LeaderboardPreview';
import NotificationPermissionPrompt from '@/components/NotificationPermissionPrompt';
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
  
  // Use initial data immediately (no loading state needed!)
  const [totalPoints, setTotalPoints] = useState(initialPoints);
  const [currentStreak, setCurrentStreak] = useState(initialStreak);
  const [countdown, setCountdown] = useState<string>('');
  const [streakAtRisk, setStreakAtRisk] = useState(false);
  const freezeCount = initialStreak?.freeze_count || 0;
  const [badgesCount, setBadgesCount] = useState<number>(initialBadgesCount);
  const [todayCompleted, setTodayCompleted] = useState<number>(initialTodayCompleted);
  const [attRate, setAttRate] = useState<number>(attendanceRate);
  
  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  
  // Count-up animation for points (SSR-safe: render plain number, animate on client)
  const pointsMotion = useMotionValue(initialPoints);
  const [displayPoints, setDisplayPoints] = useState<number>(initialPoints);

  // Handle URL query parameters and show toast notifications
  useEffect(() => {
    const feedback = searchParams.get('feedback');
    const points = searchParams.get('points');
    
    if (feedback) {
      let message = '';
      let type: ToastType = 'info';
      
      switch (feedback) {
        case 'success':
          message = `Feedback submitted! You earned ${points || '5-10'} points 💎`;
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

  // Real-time updates for points
  useEffect(() => {
    if (!student?.id) return;

    const pointsChannel = supabase
      .channel('points-updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'points',
        filter: `student_id=eq.${student.id}`,
      }, (payload: { new: { points: number; transaction_type: string } }) => {
        const newPoints = payload.new.points;
        setTotalPoints(prev => prev + newPoints);
        
        // Show toast notification
        const transactionType = payload.new.transaction_type;
        const message = transactionType === 'attendance' 
          ? `+${newPoints} points for attending class!`
          : `+${newPoints} points earned!`;
        
        setToast({ message, type: 'success' });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(pointsChannel);
    };
  }, [student?.id]);

  // Real-time updates for streaks
  useEffect(() => {
    if (!student?.id) return;

    const streaksChannel = supabase
      .channel('streaks-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'streaks',
        filter: `student_id=eq.${student.id}`,
      }, (payload: { new: Streak }) => {
        setCurrentStreak(payload.new);
        
        // Show toast if streak increased
        if (payload.new.current_streak > (currentStreak?.current_streak || 0)) {
          setToast({ 
            message: `🔥 Streak updated to ${payload.new.current_streak} days!`, 
            type: 'success' 
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(streaksChannel);
    };
  }, [student?.id, currentStreak]);

  // Real-time updates for achievements
  useEffect(() => {
    if (!student?.id) return;

    const achievementsChannel = supabase
      .channel('achievements-updates')
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
            message: `🏆 Achievement unlocked: ${achievement.name}!`, 
            type: 'success' 
          });
        }
        // Increment badge count
        setBadgesCount((c) => c + 1);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(achievementsChannel);
    };
  }, [student?.id]);

  // Recompute today's completed classes as time passes
  useEffect(() => {
    const computeCompleted = () => {
      const now = new Date();
      const completed = todayClasses.filter(c => new Date(c.end_time) < now).length;
      setTodayCompleted(completed);
    };
    computeCompleted();
    const interval = setInterval(computeCompleted, 60000); // every minute
    return () => clearInterval(interval);
  }, [todayClasses]);

  // Realtime attendance changes -> recompute 30-day attendance rate
  useEffect(() => {
    if (!student?.id) return;

    const recalc = async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', student.id)
        .gte('date', since);
      if (data && data.length > 0) {
        const present = data.filter(a => a.status === 'present').length;
        setAttRate(Math.round((present / data.length) * 100));
      }
    };

    const attendanceChannel = supabase
      .channel('attendance-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `student_id=eq.${student.id}` }, () => {
        recalc();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(attendanceChannel);
    };
  }, [student?.id]);

  // Countdown timer for next class
  useEffect(() => {
    if (!nextClass) return;

    const updateCountdown = () => {
      const now = new Date();
      const classTime = new Date(nextClass.start_time);
      const diff = classTime.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown('');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setCountdown(`${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [nextClass]);

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
    <div className="min-h-screen bg-gray-50" style={{ paddingBottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))' }}>
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      {/* Header */}
      <PageHeader
        title={`Hi, ${student?.first_name || student?.full_name?.split(' ')[0] || 'Student'}! 👋`}
        subtitle="Keep up the great work!"
        variant="gradient"
      >
        {/* Points & Streak */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Points Display */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl p-4"
          >
            <div className="flex items-center space-x-2 mb-2">
              <Coins size={20} style={{ color: colors.rank.gold }} />
              <span className="text-xs text-white/80 uppercase">Points</span>
            </div>
            <motion.div className="text-3xl font-bold text-white">
              {displayPoints}
            </motion.div>
            {totalPoints > 0 && (
              <div className="flex items-center space-x-1 mt-1">
                <TrendingUp size={14} style={{ color: colors.success }} />
                <span className="text-xs text-white/80">Growing!</span>
              </div>
            )}
          </motion.div>

          {/* Streak Display */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl p-4"
          >
            <div className="flex items-center space-x-2 mb-2">
              <Flame size={20} style={{ color: colors.rank.gold }} />
              <span className="text-xs text-white/80 uppercase">Streak</span>
            </div>
            <div className="text-3xl font-bold">{currentStreak?.current_streak || 0} 🔥</div>
            
            {streakAtRisk ? (
              <div className="flex items-center space-x-1 mt-1">
                <AlertCircle size={14} style={{ color: colors.warning }} />
                <span className="text-xs text-white/80">At risk!</span>
              </div>
            ) : freezeCount > 0 ? (
              <div className="flex items-center space-x-1 mt-1">
                <Snowflake size={14} className="text-blue-300" />
                <span className="text-xs text-white/80">{freezeCount} freeze{freezeCount !== 1 ? 's' : ''}</span>
              </div>
            ) : (
              <div className="text-xs text-white/80 mt-1">Keep it up!</div>
            )}
          </motion.div>
        </div>

        {/* Next Class Countdown */}
        {nextClass && countdown && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Clock size={20} />
                </div>
                <div>
                  <p className="font-semibold">{nextClass.name}</p>
                  <p className="text-xs text-white/80">{nextClass.location}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{countdown}</div>
                <div className="text-xs text-white/80">until class</div>
              </div>
            </div>
          </motion.div>
        )}
      </PageHeader>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Active Class Status */}
        {activeClass && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl p-6 shadow-lg border-2"
            style={{ borderColor: colors.primary.DEFAULT }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-primary/10 p-3 rounded-lg">
                  <Zap size={24} style={{ color: colors.primary.DEFAULT }} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{activeClass.name}</p>
                  <p className="text-sm text-gray-600">{activeClass.location}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500 uppercase">Class Active</div>
                <div className="text-sm font-semibold" style={{ color: colors.primary.DEFAULT }}>
                  In Progress
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Clock size={16} className="text-blue-600" />
                <p className="text-sm text-blue-800">
                  Attendance will be recorded automatically when synced from your university system
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={Calendar}
            value={`${todayCompleted}/${todayClasses.length}`}
            label="Today"
            color="primary"
          />
          <StatCard
            icon={Trophy}
            value={badgesCount}
            label="Badges"
            color="gold"
          />
          <StatCard
            icon={Target}
            value={`${attRate}%`}
            label="Goal"
            color="success"
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

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Notification Permission Prompt */}
      {student && <NotificationPermissionPrompt studentId={student.id} />}
    </div>
  );
}
