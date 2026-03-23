/**
 * LeaderboardList Component
 * Displays a list of leaderboard entries with loading and empty states
 */

'use client';

import React from 'react';
import { LeaderboardItem } from './LeaderboardItem';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { IoTrophy } from 'react-icons/io5';

interface LeaderboardEntry {
  id: string;
  student_id: string;
  rank: number;
  score: number;
  current_streak: number;
  student_name: string;
  students?: { avatar_url: string | null } | null;
}

interface LeaderboardListProps {
  entries: LeaderboardEntry[];
  currentStudentId: string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export const LeaderboardList: React.FC<LeaderboardListProps> = ({
  entries,
  currentStudentId,
  loading = false,
  emptyTitle = 'No leaderboard data yet',
  emptyDescription = 'Start earning points to appear on the leaderboard',
}) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-4 flex items-center gap-4">
            <Skeleton variant="circular" width={48} height={48} />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" width="60%" height={20} />
              <Skeleton variant="text" width="40%" height={16} />
            </div>
            <Skeleton variant="text" width={60} height={24} />
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<IoTrophy size={48} />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, index) => (
        <LeaderboardItem
          key={entry.id}
          rank={entry.rank}
          studentName={entry.student_name}
          studentAvatarUrl={entry.students?.avatar_url || null}
          score={entry.score}
          currentStreak={entry.current_streak}
          isCurrentUser={entry.student_id === currentStudentId}
          index={index}
        />
      ))}
    </div>
  );
};
