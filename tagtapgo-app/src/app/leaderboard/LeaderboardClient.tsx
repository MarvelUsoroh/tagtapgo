/**
 * Leaderboard Client Component
 * Handles tab switching and real-time updates
 */

'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/icons';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { LEADERBOARD_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Container } from '@/components/layout/Container';
import { LeaderboardList } from '@/components/leaderboard/LeaderboardList';

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
  students?: { avatar_url: string | null } | null;
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
  const [classCode, setClassCode] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPeriodDropdown(false);
      }
    };

    if (showPeriodDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPeriodDropdown]);

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
        .select('id, student_id, leaderboard_type, period, course_id, primary_course_id, rank, points, current_streak, longest_streak, score, period_start, period_end, updated_at, student_name, students(avatar_url)')
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
            .select('name, code')
            .eq('id', primaryClassId)
            .single();
          
          setClassName(courseData?.name || 'Class');
          setClassCode(courseData?.code || null);
        } else {
          setClassName('Class');
          setClassCode(null);
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

  const periodLabels: Record<TimePeriod, string> = {
    weekly: 'This Week',
    monthly: 'This Month',
    all_time: 'All Time',
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <Container>
          <div className="py-6">
            {/* Title and Period Selector */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Leaderboard</h1>
                <p className="text-sm text-gray-600 mt-1">Compete with your peers</p>
              </div>
              
              {/* Period Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-gray-100 text-gray-700"
                  style={{ minHeight: '44px' }}
                >
                  <span>{periodLabels[timePeriod]}</span>
                  <Icon name="arrowForward" size="sm" className="rotate-90" />
                </button>

                <AnimatePresence>
                  {showPeriodDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10"
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
                            backgroundColor: timePeriod === period ? `${colors.primary.DEFAULT}10` : 'transparent',
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
            </div>

            {/* User's Rank Card */}
            {userRank && (
              <div
                className="p-4 rounded-xl flex items-center justify-between"
                style={{ backgroundColor: `${colors.primary.DEFAULT}10` }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
                    style={{ backgroundColor: colors.primary.DEFAULT }}
                  >
                    {userRank}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Your Rank</p>
                    <p className="text-sm text-gray-600">Keep climbing!</p>
                  </div>
                </div>
                <Icon name="trendingUp" size="lg" color={colors.success} />
              </div>
            )}
          </div>
        </Container>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <Container>
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
                {tab === 'class' ? (
                  <>
                    <span className="sm:hidden">{classCode || 'Class'}</span>
                    <span className="hidden sm:inline">{className}</span>
                  </>
                ) : (
                  tab.charAt(0).toUpperCase() + tab.slice(1)
                )}
              </button>
            ))}
          </div>
        </Container>
      </div>

      {/* Leaderboard List */}
      <Container>
        <div className="py-4 pb-32">
          <LeaderboardList
            entries={leaderboard}
            currentStudentId={currentStudentId}
            loading={loading}
            emptyTitle={
              activeTab === 'class' && !userPrimaryClass 
                ? 'No class data available'
                : 'No leaderboard data yet'
            }
            emptyDescription={
              activeTab === 'class' && !userPrimaryClass
                ? 'Attend classes to join the class leaderboard'
                : 'Start earning points to appear on the leaderboard'
            }
          />
        </div>
      </Container>
    </div>
  );
}
