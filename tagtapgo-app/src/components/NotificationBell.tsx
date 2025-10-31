'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { motion } from 'framer-motion';

interface NotificationBellProps {
  studentId: string;
  onClick: () => void;
  variant?: 'white' | 'gradient';
}

export default function NotificationBell({ studentId, onClick, variant = 'white' }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!studentId) return;

    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', studentId)
        .eq('read', false);

      setUnreadCount(count || 0);
    };

    // Fetch initial unread count
    fetchUnreadCount();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('notifications-bell')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `student_id=eq.${studentId}`,
      }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId]);

  const isGradient = variant === 'gradient';

  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-lg transition-colors"
      style={{
        backgroundColor: isGradient ? 'rgba(255, 255, 255, 0.1)' : colors.gray[100],
      }}
    >
      <Bell
        size={24}
        style={{
          color: isGradient ? 'white' : colors.gray[700],
        }}
      />
      {unreadCount > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: colors.danger }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </motion.div>
      )}
    </button>
  );
}
