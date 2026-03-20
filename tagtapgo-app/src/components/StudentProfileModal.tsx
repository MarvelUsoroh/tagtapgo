'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Avatar } from '@/components/ui/Avatar';
import { IoClose, IoSchool, IoFlame, IoStar, IoCalendarOutline } from 'react-icons/io5';
import { getInitials, formatNumber } from '@/lib/utils';
import { format } from 'date-fns';

interface StudentProfileModalProps {
  studentId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

interface ProfileData {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string;
  major: string;
  grade_level: string;
  year: number | null;
  created_at: string;
}

interface StudentStats {
  points: number;
  current_streak: number;
}

export function StudentProfileModal({ studentId, isOpen, onClose }: StudentProfileModalProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !studentId) return;

    async function fetchProfile() {
      setLoading(true);
      setProfile(null);
      setStats(null);

      const [{ data: profileData }, { data: leaderData }] = await Promise.all([
        supabase
          .from('students')
          .select('id, full_name, username, avatar_url, major, grade_level, year, created_at')
          .eq('id', studentId)
          .single(),
        supabase
          .from('leaderboards')
          .select('points, current_streak')
          .eq('student_id', studentId)
          .eq('leaderboard_type', 'overall')
          .eq('period', 'all_time')
          .maybeSingle(),
      ]);

      if (profileData) setProfile(profileData as unknown as ProfileData);
      if (leaderData) {
        setStats({
          points: leaderData.points ?? 0,
          current_streak: leaderData.current_streak ?? 0,
        });
      }

      setLoading(false);
    }

    fetchProfile();
  }, [studentId, isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const joinedDate = profile?.created_at
    ? format(new Date(profile.created_at), 'MMM yyyy')
    : null;

  const yearLabel = profile?.year
    ? `Year ${profile.year}`
    : profile?.grade_level || null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet — slides up on mobile, scales in on desktop */}
      <div className="relative bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden animate-slide-up sm:animate-scale-in">

        {/* Green header strip */}
        <div className="bg-green-500 px-5 pt-5 pb-10">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="bg-white/20 hover:bg-white/30 text-white rounded-full p-1.5 transition-colors"
              aria-label="Close"
            >
              <IoClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 pb-6">
          {/* Avatar — overlaps the green header */}
          <div className="-mt-8 mb-3 flex items-end gap-3">
            <div className="ring-4 ring-white rounded-full flex-shrink-0">
              {loading ? (
                <div className="w-16 h-16 rounded-full bg-gray-200 animate-pulse" />
              ) : (
                <Avatar
                  src={profile?.avatar_url}
                  alt={profile?.full_name || 'Student'}
                  size="lg"
                  className={!profile?.avatar_url ? 'bg-green-500' : undefined}
                  fallbackIcon={
                    <span className="text-white font-bold text-base">
                      {getInitials(profile?.full_name || 'S')}
                    </span>
                  }
                />
              )}
            </div>
          </div>

          {/* Name & username */}
          {loading ? (
            <div className="animate-pulse space-y-1.5 mb-4">
              <div className="h-5 w-40 bg-gray-200 rounded" />
              <div className="h-3.5 w-24 bg-gray-200 rounded" />
            </div>
          ) : profile ? (
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900 leading-snug">
                {profile.full_name || 'Anonymous Student'}
              </h2>
              {profile.username && (
                <p className="text-sm text-gray-500 mt-0.5">@{profile.username}</p>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm mb-4">Could not load profile.</p>
          )}

          {/* Info cards */}
          {loading ? (
            <div className="space-y-2">
              <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
              <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
            </div>
          ) : profile && (
            <div className="space-y-2">
              {/* Degree / major */}
              {profile.major && (
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3.5 py-2.5">
                  <IoSchool className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <div className="text-sm min-w-0">
                    <span className="font-semibold text-gray-900 block truncate">
                      {profile.major}
                    </span>
                    {yearLabel && (
                      <span className="text-gray-500 text-xs">{yearLabel}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Stats row: points + streak */}
              {stats && (stats.points > 0 || stats.current_streak > 0) && (
                <div className="flex gap-2">
                  {stats.points > 0 && (
                    <div className="flex-1 flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3.5 py-2.5">
                      <IoStar className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <div className="text-sm">
                        <span className="font-bold text-green-700">{formatNumber(stats.points)}</span>
                        <span className="block text-xs text-green-600/70">points</span>
                      </div>
                    </div>
                  )}
                  {stats.current_streak > 0 && (
                    <div className="flex-1 flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5">
                      <IoFlame className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <div className="text-sm">
                        <span className="font-bold text-amber-700">{stats.current_streak}d</span>
                        <span className="block text-xs text-amber-600/70">streak</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Joined date */}
              {joinedDate && (
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3.5 py-2.5">
                  <IoCalendarOutline className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-500">
                    Member since <span className="font-semibold text-gray-700">{joinedDate}</span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}