'use client';

import { useEffect, useState, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { IoTrophy, IoMedal, IoRibbon, IoTrendingUp, IoFlame, IoRocket } from 'react-icons/io5';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
// import { colors } from '@/lib/theme';
import { cn, formatNumber } from '@/lib/utils';

// Extract first name from full name
const getFirstName = (fullName: string | undefined | null): string => {
  if (!fullName || !fullName.trim()) return 'Student';
  return fullName.trim().split(' ')[0];
};

interface LeaderboardEntry {
  id: string;
  student_id: string;
  rank: number;
  points: number;
  current_streak?: number;
  longest_streak?: number;
  score?: number;
  student_name?: string;
  student_avatar_url?: string | null;
}

interface LeaderboardPreviewProps {
  studentId: string;
  type?: 'class' | 'year' | 'school';
  period?: 'weekly' | 'monthly' | 'all_time';
}

const rankIcons = {
  1: IoTrophy,
  2: IoMedal,
  3: IoRibbon,
};

const rankColors = {
  1: 'text-gold',
  2: 'text-silver',
  3: 'text-bronze',
};

function LeaderboardPreview({
  studentId,
  type = 'school',
  period = 'all_time',
}: LeaderboardPreviewProps) {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      // Calculate period start based on period type
      let periodStart: string | undefined;
      const now = new Date();

      if (period === 'weekly') {
        const dayOfWeek = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        monday.setHours(0, 0, 0, 0);
        periodStart = monday.toISOString().split('T')[0];
      } else if (period === 'monthly') {
        // Use UTC to avoid timezone issues
        const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
        periodStart = monthStart.toISOString().split('T')[0];
      }
      // For 'all_time', don't filter by period_start

      // Build query for top 3
      let topQuery = supabase
        .from('leaderboards')
        .select('id, student_id, rank, points, current_streak, longest_streak, score, student_name, student_avatar_url')
        .eq('leaderboard_type', type)
        .eq('period', period);

      if (periodStart) {
        topQuery = topQuery.eq('period_start', periodStart);
      }

      const { data: topData } = await topQuery
        .order('rank')
        .limit(3);

      // Build query for user's rank
      let userQuery = supabase
        .from('leaderboards')
        .select('rank')
        .eq('student_id', studentId)
        .eq('leaderboard_type', type)
        .eq('period', period);

      if (periodStart) {
        userQuery = userQuery.eq('period_start', periodStart);
      }

      const { data: userRankData } = await userQuery.maybeSingle();

      if (topData) {
        setLeaderboard(topData as LeaderboardEntry[]);
      }

      if (userRankData) {
        setUserRank(userRankData.rank);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }, [studentId, type, period]);

  useEffect(() => {
    if (studentId) {
      fetchLeaderboard();
    }
  }, [studentId, fetchLeaderboard]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-2">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-md p-6"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-4">Leaderboard</h2>
        <div className="text-center py-8 text-gray-500">
          <IoTrendingUp size={48} className="mx-auto mb-2 opacity-50" />
          <p>No leaderboard data yet</p>
          <p className="text-sm">Keep attending classes to climb the ranks!</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-md p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Leaderboard</h2>
        <button
          onClick={() => router.push('/leaderboard')}
          className="text-primary text-sm font-medium hover:text-primary-dark transition-colors"
        >
          View All
        </button>
      </div>

      <div className="space-y-3">
        {leaderboard.map((entry, index) => {
          const Icon = rankIcons[entry.rank as keyof typeof rankIcons] || IoRibbon;
          const isCurrentUser = entry.student_id === studentId;
          const maxScore = Math.max(...leaderboard.map(e => e.score || ((e.current_streak || 0) * 100 + e.points)));
          const entryScore = entry.score || ((entry.current_streak || 0) * 100 + entry.points);
          const barWidthPercent = maxScore > 0 ? Math.max(15, (entryScore / maxScore) * 100) : 15;

          const getBarColor = () => {
            switch (entry.rank) {
              case 1:
                return '#FFD700';
              case 2:
                return '#C0C0C0';
              case 3:
                return '#CD7F32';
              default:
                return '#6366f1';
            }
          };

          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                'bg-white rounded-lg overflow-hidden',
                isCurrentUser && 'ring-2 ring-primary'
              )}
            >
              {/* Header */}
              <div className="p-3 flex items-center space-x-3">
                {/* Rank Icon */}
                <div className="flex items-center justify-center w-8 h-8 flex-shrink-0">
                  <Icon
                    size={20}
                    className={rankColors[entry.rank as keyof typeof rankColors] || 'text-gray-400'}
                  />
                </div>

                {/* Student Info */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'font-semibold truncate',
                      isCurrentUser ? 'text-primary' : 'text-gray-900'
                    )}
                  >
                    {getFirstName(entry.student_name)}
                    {isCurrentUser && ' (You)'}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-orange-600">
                    <IoFlame size={12} />
                    <span>{entry.current_streak || 0} day{(entry.current_streak || 0) !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                {/* Score */}
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-gray-900">
                    {formatNumber(entryScore)}
                  </p>
                  <p className="text-xs text-gray-500">pts</p>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="px-3 pb-3">
                <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidthPercent}%` }}
                    transition={{ duration: 0.8, delay: index * 0.1 + 0.2, ease: 'easeOut' }}
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      backgroundColor: getBarColor(),
                    }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* User's Rank if not in top 3 */}
        {userRank && userRank > 3 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 p-3 bg-primary/10 border-2 border-primary/30 rounded-lg"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-primary">Your Rank</p>
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <p>Keep climbing!</p>
                  <IoRocket className="h-4 w-4" />
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">#{userRank}</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default memo(LeaderboardPreview);
