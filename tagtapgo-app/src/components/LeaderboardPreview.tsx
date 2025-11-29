'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Crown, Medal, Award, TrendingUp, Flame } from 'lucide-react';
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
  1: Crown,
  2: Medal,
  3: Award,
};

const rankColors = {
  1: 'text-gold',
  2: 'text-silver',
  3: 'text-bronze',
};

export default function LeaderboardPreview({
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
          <TrendingUp size={48} className="mx-auto mb-2 opacity-50" />
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
          const Icon = rankIcons[entry.rank as keyof typeof rankIcons] || Award;
          const isCurrentUser = entry.student_id === studentId;

          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                'flex items-center justify-between p-3 rounded-lg transition-all',
                isCurrentUser
                  ? 'bg-primary/10 border-2 border-primary/30'
                  : 'bg-gray-50 hover:bg-gray-100'
              )}
            >
              <div className="flex items-center space-x-3">
                {/* Rank Icon */}
                <div className="flex items-center justify-center w-8 h-8">
                  <Icon
                    size={20}
                    className={rankColors[entry.rank as keyof typeof rankColors] || 'text-gray-400'}
                  />
                </div>

                {/* Student Info */}
                <div>
                  <p
                    className={cn(
                      'font-medium',
                      isCurrentUser ? 'text-primary' : 'text-gray-900'
                    )}
                  >
                    {getFirstName(entry.student_name)}
                    {isCurrentUser && ' (You)'}
                  </p>
                  <p className="text-sm text-gray-500">Rank #{entry.rank}</p>
                </div>
              </div>

              {/* Score & Streak */}
              <div className="text-right">
                <div className="flex flex-col items-end gap-1">
                  <p className="font-bold text-gray-900">
                    {formatNumber(entry.score || ((entry.current_streak || 0) * 100 + entry.points))}
                  </p>
                  <p className="text-xs text-gray-500">score</p>
                  <div className="flex items-center gap-1 text-xs text-orange-600">
                    <Flame size={10} />
                    <span>{entry.current_streak || 0}</span>
                  </div>
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
                <p className="text-sm text-gray-600">Keep climbing! 🚀</p>
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
