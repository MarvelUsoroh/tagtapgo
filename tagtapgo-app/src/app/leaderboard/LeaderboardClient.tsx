/**
 * Leaderboard Client Component
 * Handles tab switching and real-time updates
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Medal, Award, TrendingUp, ChevronDown, Trophy, Flame } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { LEADERBOARD_CONFIG } from '@/lib/constants';
import { cn, formatNumber, getInitials } from '@/lib/utils';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';

type LeaderboardType = 'class' | 'year' | 'school';
type TimePeriod = 'weekly' | 'monthly' | 'all_time';

interface LeaderboardEntry {
  id: string;
  student_id: string;
  leaderboard_type: 'class' | 'year' | 'school' | 'friend';
  period: 'weekly' | 'monthly' | 'all_time';
  course_id?: string | null;
  primary_course_id?: string | null; // New field for class leaderboard grouping
  rank: number;
  points: number;
  current_streak: number;
  longest_streak: number;
  score: number;
  period_start: string;
  period_end?: string;
  updated_at: string;
  student_name: string;
  student_avatar_url?: string | null;
}

interface Props {
  initialLeaderboard: LeaderboardEntry[];
  initialUserRank: number | null;
  currentStudentId: string;
}

export default function LeaderboardClient({
  initialLeaderboard,
  initialUserRank,
  currentStudentId,
}: Props) {
  const [activeTab, setActiveTab] = useState<LeaderboardType>('school');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all_time');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(initialLeaderboard);
  const [userRank, setUserRank] = useState<number | null>(initialUserRank);
  const [loading, setLoading] = useState(false);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [userPrimaryClass, setUserPrimaryClass] = useState<string | null>(null);
  const [className, setClassName] = useState<string>('Class');

  // Get user's primary class for the current period
  const getUserPrimaryClass = useCallback(async (period: TimePeriod): Promise<string | null> => {
    try {
      // Calculate period boundaries (use UTC to match backend)
      let periodStart: string | undefined;

      if (period === 'weekly') {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        monday.setHours(0, 0, 0, 0);
        periodStart = monday.toISOString().split('T')[0];
      } else if (period === 'monthly') {
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
        periodStart = monthStart.toISOString().split('T')[0];
      }

      // Get user's class leaderboard entry to find their primary class
      let query = supabase
        .from('leaderboards')
        .select('primary_course_id')
        .eq('leaderboard_type', 'class')
        .eq('period', period)
        .eq('student_id', currentStudentId);

      if (periodStart) {
        query = query.eq('period_start', periodStart);
      }

      const { data, error } = await query
        .order('period_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching class leaderboard entry:', error);
        return null;
      }

      if (!data) {
        console.log('No class leaderboard entry found for user', { period, periodStart, currentStudentId });
        return null;
      }

      return data.primary_course_id;
    } catch (error) {
      console.error('Error getting user primary class:', error);
      return null;
    }
  }, [currentStudentId]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);

      // Calculate period start based on timePeriod (use UTC to match backend)
      let periodStart: string | undefined;
      const now = new Date();
      
      if (timePeriod === 'weekly') {
        const dayOfWeek = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        monday.setHours(0, 0, 0, 0);
        periodStart = monday.toISOString().split('T')[0];
      } else if (timePeriod === 'monthly') {
        // Use UTC to avoid timezone issues
        const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
        periodStart = monthStart.toISOString().split('T')[0];
      }
      // For 'all_time', don't filter by period_start

      // For class leaderboards, get user's primary class first
      let primaryClassId: string | null = null;
      if (activeTab === 'class') {
        primaryClassId = await getUserPrimaryClass(timePeriod);
        setUserPrimaryClass(primaryClassId);
        
        if (!primaryClassId) {
          // User has no primary class, show empty state
          setLeaderboard([]);
          setUserRank(null);
          setClassName('Class');
          return;
        }
      }

      // Build query based on leaderboard type
      let query = supabase
        .from('leaderboards')
        .select('id, student_id, leaderboard_type, period, course_id, primary_course_id, rank, points, current_streak, longest_streak, score, period_start, period_end, updated_at, student_name, student_avatar_url')
        .eq('leaderboard_type', activeTab)
        .eq('period', timePeriod);

      // Add period_start filter for weekly and monthly
      if (periodStart) {
        query = query.eq('period_start', periodStart);
      }

      // For class leaderboards, filter by user's primary class
      if (activeTab === 'class' && primaryClassId) {
        query = query.eq('primary_course_id', primaryClassId);
      }

      const { data, error } = await query
        .order('rank')
        .limit(LEADERBOARD_CONFIG.ITEMS_PER_PAGE);

      if (error) throw error;

      if (data && Array.isArray(data)) {
        const leaderboardData = data as unknown as LeaderboardEntry[];
        setLeaderboard(leaderboardData);

        // Find user's rank
        const userEntry = leaderboardData.find((entry) => entry.student_id === currentStudentId);
        setUserRank(userEntry?.rank || null);

        // Set class name for class leaderboards by fetching course separately
        if (activeTab === 'class' && primaryClassId) {
          const { data: courseData } = await supabase
            .from('courses')
            .select('name')
            .eq('id', primaryClassId)
            .single();
          
          setClassName(courseData?.name || 'Class');
        } else {
          setClassName('Class');
        }
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, timePeriod, currentStudentId, getUserPrimaryClass]);

  useEffect(() => {
    fetchLeaderboard();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('leaderboard-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leaderboards',
          filter: `leaderboard_type=eq.${activeTab}`,
        },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, fetchLeaderboard]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown size={24} style={{ color: colors.rank.gold }} />;
      case 2:
        return <Medal size={24} style={{ color: colors.rank.silver }} />;
      case 3:
        return <Award size={24} style={{ color: colors.rank.bronze }} />;
      default:
        return null;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return colors.rank.gold;
      case 2:
        return colors.rank.silver;
      case 3:
        return colors.rank.bronze;
      default:
        return colors.gray[600];
    }
  };

  const periodLabels: Record<TimePeriod, string> = {
    weekly: 'This Week',
    monthly: 'This Month',
    all_time: 'All Time',
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ paddingBottom: 'var(--bottom-nav-height)' }}>
      {/* Header */}
      <PageHeader
        title="Leaderboard"
        subtitle="Compete with your peers"
        icon={Trophy}
        variant="white"
        actions={
          <div className="relative">
            <button
              onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm"
              style={{
                backgroundColor: colors.gray[100],
                color: colors.gray[700],
                minHeight: '44px',
              }}
            >
              <span>{periodLabels[timePeriod]}</span>
              <ChevronDown size={16} />
            </button>

            <AnimatePresence>
              {showPeriodDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-10"
                  style={{ borderColor: colors.gray[200] }}
                >
                  {(Object.keys(periodLabels) as TimePeriod[]).map((period) => (
                    <button
                      key={period}
                      onClick={() => {
                        setTimePeriod(period);
                        setShowPeriodDropdown(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                      style={{
                        backgroundColor: timePeriod === period ? colors.primary.DEFAULT + '10' : 'transparent',
                        color: timePeriod === period ? colors.primary.DEFAULT : colors.gray[700],
                        minHeight: '44px',
                      }}
                    >
                      {periodLabels[period]}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        }
      >
        {/* User's Rank Card */}
        {userRank && (
          <div
            className="p-4 rounded-xl flex items-center justify-between"
            style={{ backgroundColor: colors.primary.DEFAULT + '10' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
                style={{ backgroundColor: colors.primary.DEFAULT }}
              >
                {userRank}
              </div>
              <div>
                <p className="font-medium" style={{ color: colors.gray[900] }}>
                  Your Rank
                </p>
                <p className="text-sm" style={{ color: colors.gray[600] }}>
                  Keep climbing!
                </p>
              </div>
            </div>
            <TrendingUp size={24} style={{ color: colors.success }} />
          </div>
        )}
      </PageHeader>

      {/* Tabs */}
      <div className="bg-white border-b" style={{ borderColor: colors.gray[200] }}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-1">
            {(['school', 'year', 'class'] as LeaderboardType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 py-3 font-medium text-sm transition-all',
                  'min-h-[44px]'
                )}
                style={{
                  color: activeTab === tab ? colors.primary.DEFAULT : colors.gray[600],
                  borderBottom: activeTab === tab ? `2px solid ${colors.primary.DEFAULT}` : '2px solid transparent',
                }}
              >
                {tab === 'class' ? className : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Leaderboard List */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-12">
            <Trophy size={48} style={{ color: colors.gray[300] }} className="mx-auto mb-4" />
            <p className="text-lg font-medium mb-2" style={{ color: colors.gray[600] }}>
              {activeTab === 'class' && !userPrimaryClass 
                ? 'No class data available'
                : 'No leaderboard data yet'
              }
            </p>
            <p className="text-sm" style={{ color: colors.gray[500] }}>
              {activeTab === 'class' && !userPrimaryClass
                ? 'Attend classes to join the class leaderboard'
                : 'Start earning points to appear on the leaderboard'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={cn(
                  'bg-white rounded-xl p-4 flex items-center gap-4',
                  entry.student_id === currentStudentId && 'ring-2 ring-primary',
                  entry.rank <= 3 && 'shadow-md'
                )}
              >
                {/* Rank */}
                <div className="flex-shrink-0 w-12 text-center">
                  {getRankIcon(entry.rank) || (
                    <span
                      className="text-xl font-bold"
                      style={{ color: getRankColor(entry.rank) }}
                    >
                      {entry.rank}
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: colors.primary.DEFAULT }}
                >
                  {entry.student_avatar_url ? (
                    <Image
                      src={entry.student_avatar_url}
                      alt={entry.student_name}
                      width={40}
                      height={40}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    getInitials(entry.student_name || 'Student')
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p
                    className="font-medium truncate"
                    style={{ color: colors.gray[900] }}
                  >
                    {entry.student_name || 'Student'}
                    {entry.student_id === currentStudentId && (
                      <span
                        className="ml-2 text-xs font-normal"
                        style={{ color: colors.primary.DEFAULT }}
                      >
                        (You)
                      </span>
                    )}
                  </p>
                </div>

                {/* Score & Streak */}
                <div className="text-right">
                  <div className="flex flex-col items-end gap-1">
                    <p
                      className="text-lg font-bold"
                      style={{ color: getRankColor(entry.rank) }}
                    >
                      {formatNumber(entry.score || ((entry.current_streak || 0) * 100 + entry.points))}
                    </p>
                    <p className="text-xs" style={{ color: colors.gray[500] }}>
                      score
                    </p>
                    <div className="flex items-center gap-1 text-xs" style={{ color: colors.warning }}>
                      <Flame size={12} />
                      <span>{entry.current_streak || 0} day streak</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
