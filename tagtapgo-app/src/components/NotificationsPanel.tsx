'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoClose, IoNotifications, IoTrophy, IoTrendingUp, IoFlame, IoCalendar } from 'react-icons/io5';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { formatDistanceToNow } from 'date-fns';
import { useStore } from '@/store/useStore';
import { useDataRefresh } from '@/hooks/useDataRefresh';

interface Notification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  created_at: string;
  read: boolean;
}

interface NotificationsPanelProps {
  studentId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationsPanel({ studentId, isOpen, onClose }: NotificationsPanelProps) {
  const { setUnreadCount } = useStore();
  const { refreshGamification } = useDataRefresh();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && studentId) {
      fetchNotifications().then(() => {
        // Auto-mark all as read when the panel is opened
        supabase
          .from('notifications')
          .update({ read: true })
          .eq('student_id', studentId)
          .eq('read', false)
          .then(() => {
            setUnreadCount(0);
            setTotalUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
          });
      });
      
      // Subscribe to real-time updates via broadcast
      const channel = supabase
        .channel(`user:${studentId}:notifications-panel`, {
          config: { private: true }
        })
        .on('broadcast', { event: 'notifications_insert' }, () => {
          fetchNotifications();
        })
        .on('broadcast', { event: 'notifications_update' }, () => {
          fetchNotifications();
        })
        .on('broadcast', { event: 'notifications_delete' }, () => {
          fetchNotifications();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, studentId]);

  const fetchNotifications = async () => {
    setLoading(true);
    
    // Fetch recent notifications (limited to 20)
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Fetch total unread count (all notifications, not just recent 20)
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('read', false);

    if (data && !error) {
      setNotifications(data);
    }
    
    const unreadCount = count || 0;
    setTotalUnreadCount(unreadCount);
    setUnreadCount(unreadCount); // Update global store
    setLoading(false);
  };

  const markAsRead = async (notificationId: string) => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    
    const newUnreadCount = Math.max(0, totalUnreadCount - 1);
    setTotalUnreadCount(newUnreadCount);
    setUnreadCount(newUnreadCount); // Update global store immediately
    
    // Background sync
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
    
    // Trigger server-side refresh
    refreshGamification();
  };

  const markAllAsRead = async () => {
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setTotalUnreadCount(0);
    setUnreadCount(0); // Update global store immediately
    
    // Background sync
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('student_id', studentId)
      .eq('read', false);
    
    // Trigger server-side refresh
    refreshGamification();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'achievement':
      case 'achievement_unlocked':
        return <IoTrophy size={20} style={{ color: colors.rank.gold }} />;
      case 'rank':
        return <IoTrendingUp size={20} style={{ color: colors.primary.DEFAULT }} />;
      case 'streak':
        return <IoFlame size={20} style={{ color: colors.warning }} />;

      case 'perfect_week':
      case 'perfect_month':
        return <IoCalendar size={20} style={{ color: colors.success }} />;
      default:
        return <IoNotifications size={20} style={{ color: colors.gray[600] }} />;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    // Determine URL based on notification type
    let url = '/';
    
    if (notification.data?.url && typeof notification.data.url === 'string') {
      url = notification.data.url;
    } else {
      // Default URLs based on notification type
      switch (notification.notification_type) {
        case 'achievement':
        case 'achievement_unlocked':
          url = '/achievements';
          break;
        case 'rank':
          url = '/leaderboard';
          break;
        case 'streak':
          url = '/';
          break;
        case 'perfect_week':
        case 'perfect_month':
          url = '/profile';
          break;
        default:
          url = '/';
      }
    }
    
    // Navigate to URL
    window.location.href = url;
  };

  // Use total unread count from database, not just from the 20 displayed
  const unreadCount = totalUnreadCount;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: colors.gray[200] }}>
              <div>
                <h2 className="text-xl font-bold" style={{ color: colors.gray[900] }}>
                  Notifications
                </h2>
                {unreadCount > 0 && (
                  <p className="text-sm" style={{ color: colors.gray[600] }}>
                    {unreadCount} unread {unreadCount > 20 && '(showing 20 most recent)'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                    style={{ color: colors.primary.DEFAULT }}
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <IoClose size={24} style={{ color: colors.gray[600] }} />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: colors.primary.DEFAULT }} />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <IoNotifications size={48} style={{ color: colors.gray[300] }} className="mb-4" />
                  <p className="text-lg font-semibold" style={{ color: colors.gray[900] }}>
                    No notifications yet
                  </p>
                  <p className="text-sm" style={{ color: colors.gray[600] }}>
                    We&apos;ll notify you about achievements, streaks, and more!
                  </p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: colors.gray[200] }}>
                  {notifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 cursor-pointer transition-colors ${
                        notification.read ? 'bg-white' : 'bg-blue-50'
                      } hover:bg-gray-50`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 mt-1">
                          <div className={`p-2 rounded-lg ${
                            notification.read ? 'bg-gray-100' : 'bg-white'
                          }`}>
                            {getNotificationIcon(notification.notification_type)}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-sm" style={{ color: colors.gray[900] }}>
                              {notification.title}
                            </h3>
                            {!notification.read && (
                              <div className="flex-shrink-0 w-2 h-2 rounded-full mt-1" style={{ backgroundColor: colors.primary.DEFAULT }} />
                            )}
                          </div>
                          <p className="text-sm mt-1" style={{ color: colors.gray[600] }}>
                            {notification.message}
                          </p>
                          <p className="text-xs mt-2" style={{ color: colors.gray[500] }}>
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
