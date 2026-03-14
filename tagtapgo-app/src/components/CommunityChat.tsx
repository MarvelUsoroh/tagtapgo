'use client';
// @ts-nocheck - Supabase join type inference limitation with !foreign_key syntax

/**
 * CommunityChat Component
 * Real-time chat with #course-tag targeting and threaded replies
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { IoChatbubble, IoSearch, IoArrowBack, IoChevronDown } from 'react-icons/io5';
import { format, isToday, isYesterday } from 'date-fns';
import { useStore } from '@/store/useStore';
import MessageItem from './MessageItem';
import ChatInput from './ChatInput';

interface Course {
  id: string;
  code: string | null;
  shortName: string | null;
  name: string;
}

interface User {
  id: string;
  universityId: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

interface Author {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface Reaction {
  emoji: string;
  count: number;
  reacted: boolean;
}

export interface Message {
  id: string;
  content: string;
  author: Author;
  course?: { id: string; code: string | null; short_name: string | null; name: string } | null;
  parentId: string | null;
  replyCount: number;
  reactions: Reaction[];
  attachments: { path: string; type: string; name: string; size: number }[];
  createdAt: string;
  isOptimistic?: boolean;
}

interface CommunityChatProps {
  currentUser: User;
  universityName: string;
  universityAbbrev: string;
  enrolledCourses: Course[];
}

export default function CommunityChat({
  currentUser,
  universityAbbrev,
  enrolledCourses,
}: CommunityChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [threadMessage, setThreadMessage] = useState<Message | null>(null);
  const [threadReplies, setThreadReplies] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 50;
  const [showSearch, setShowSearch] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const threadInputRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const isNearBottomRef = useRef(true);
  const supabase = createClient();
  const toast = useToast();
  const router = useRouter();

  // Track scroll position to show/hide scroll-to-bottom button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const nearBottom = scrollHeight - scrollTop - clientHeight < 100;
      isNearBottomRef.current = nearBottom;
      setShowScrollButton(!nearBottom);
      if (nearBottom) setNewMessageCount(0);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [loading]);

  // Keyboard detection for mobile
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleViewportResize = () => {
      const viewport = window.visualViewport!;
      const windowHeight = window.innerHeight;
      const viewportHeight = viewport.height;
      const calculatedKeyboardHeight = windowHeight - viewportHeight;

      if (calculatedKeyboardHeight > 100) {
        setKeyboardHeight(calculatedKeyboardHeight);
        setTimeout(() => {
          // Scroll the active input into view (thread input takes priority)
          if (threadMessage && threadInputRef.current) {
            threadInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
          } else {
            inputContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }
        }, 100);
      } else {
        setKeyboardHeight(0);
      }
    };

    window.visualViewport.addEventListener('resize', handleViewportResize);
    window.visualViewport.addEventListener('scroll', handleViewportResize);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
      window.visualViewport?.removeEventListener('scroll', handleViewportResize);
    };
  }, [threadMessage]);

  // Fetch messages
  const fetchMessages = useCallback(async (beforeTimestamp?: string) => {
    if (!beforeTimestamp) setLoading(true);
    try {
      let query = supabase
        .from('chat_messages')
        .select(`
          id,
          content,
          course_id,
          parent_id,
          attachments,
          created_at,
          author:students!author_id(id, first_name, last_name, full_name, avatar_url),
          course:courses!course_id(id, code, short_name, name)
        `)
        .eq('university_id', currentUser.universityId)
        .is('deleted_at', null)
        .is('parent_id', null) // Only top-level messages
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (beforeTimestamp) {
        query = query.lt('created_at', beforeTimestamp);
      }

      if (selectedCourse) {
        query = query.eq('course_id', selectedCourse.id);
      }

      // Filtering is done client-side via filteredMessages

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Fetch reply counts
      const messageIds = (data || []).map(m => m.id);
      const { data: replyCounts } = await supabase
        .from('chat_messages')
        .select('parent_id')
        .in('parent_id', messageIds)
        .is('deleted_at', null);

      const replyCountMap: Record<string, number> = {};
      (replyCounts || []).forEach(r => {
        replyCountMap[r.parent_id] = (replyCountMap[r.parent_id] || 0) + 1;
      });

      // Fetch reactions
      const { data: reactions } = await supabase
        .from('chat_reactions')
        .select('message_id, emoji, user_id')
        .in('message_id', messageIds);

      const reactionMap: Record<string, Record<string, { count: number; reacted: boolean }>> = {};
      (reactions || []).forEach(r => {
        if (!reactionMap[r.message_id]) reactionMap[r.message_id] = {};
        if (!reactionMap[r.message_id][r.emoji]) {
          reactionMap[r.message_id][r.emoji] = { count: 0, reacted: false };
        }
        reactionMap[r.message_id][r.emoji].count++;
        if (r.user_id === currentUser.id) {
          reactionMap[r.message_id][r.emoji].reacted = true;
        }
      });

      /* eslint-disable @typescript-eslint/no-explicit-any */
      const formattedMessages: Message[] = (data as any[] || []).map((m: any) => {
        // Supabase may return relations as arrays - unwrap if needed
        const author = Array.isArray(m.author) ? m.author[0] : m.author;
        const course = Array.isArray(m.course) ? m.course[0] : m.course;
        return {
          id: m.id,
          content: m.content,
          author: author || null,
          course: course || null,
          parentId: m.parent_id,
          replyCount: replyCountMap[m.id] || 0,
          reactions: Object.entries(reactionMap[m.id] || {}).map(([emoji, data]: [string, any]) => ({
            emoji,
            count: data.count,
            reacted: data.reacted,
          })),
          attachments: m.attachments || [],
          createdAt: m.created_at,
        };
      });
      /* eslint-enable @typescript-eslint/no-explicit-any */



      setHasMore(formattedMessages.length === PAGE_SIZE);

      if (beforeTimestamp) {
        setMessages(prev => [...formattedMessages.reverse(), ...prev]);
        setLoadingMore(false);
      } else {
        setMessages(formattedMessages.reverse());
        setLoading(false);
        setTimeout(scrollToBottom, 100);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
      toast.error('Failed to load messages');
      setLoading(false);
      setLoadingMore(false);
    }
  }, [supabase, currentUser.universityId, currentUser.id, selectedCourse, toast]);

  const loadMoreMessages = async () => {
    if (messages.length > 0 && !loadingMore) {
      setLoadingMore(true);
      await fetchMessages(messages[0].createdAt);
    }
  };

  // Focus search input when search opens
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Client-side live filter — instant, no network call
  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(m =>
      m.content.toLowerCase().includes(q) ||
      (m.author?.full_name || '').toLowerCase().includes(q) ||
      (m.course?.code || '').toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  const { setUnreadChatMentions } = useStore();

  // Initial fetch and clear unread mentions & notifications
  useEffect(() => {
    fetchMessages();

    const markMentionsAsRead = async () => {
      try {
        // Mark chat mentions as read
        await supabase
          .from('chat_mentions')
          .update({ read: true })
          .eq('mentioned_user_id', currentUser.id)
          .eq('read', false);
        
        // Clear global store badge count
        setUnreadChatMentions(0);

        // Also mark any community-chat notifications as read so the badge clears
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('student_id', currentUser.id)
          .eq('read', false)
          .like('type', '%chat%');
      } catch (err) {
        console.error('Failed to mark mentions/notifications as read', err);
      }
    };
    
    markMentionsAsRead();
  }, [fetchMessages, currentUser.id, supabase, setUnreadChatMentions]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('community-chat')
      // 1. New Messages
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `university_id=eq.${currentUser.universityId}` },
        async (payload) => {
          // Fetch the full message with author
          const { data: newMsg } = await supabase
            .from('chat_messages')
            .select(`
              id, content, course_id, parent_id, attachments, created_at,
              author:students!author_id(id, first_name, last_name, full_name, avatar_url),
              course:courses!course_id(id, code, short_name, name)
            `)
            .eq('id', payload.new.id)
            .single();

          /* eslint-disable @typescript-eslint/no-explicit-any */
          const msg = newMsg as any;
          if (!msg) return;

          // Unwrap arrays if Supabase returns them
          const author = Array.isArray(msg?.author) ? msg.author[0] : msg?.author;
          const course = Array.isArray(msg?.course) ? msg.course[0] : msg?.course;
          
          const newMessageObj = {
            id: msg.id,
            content: msg.content,
            author: author || null,
            course: course || null,
            parentId: msg.parent_id,
            replyCount: 0,
            reactions: [],
            attachments: msg.attachments || [],
            createdAt: msg.created_at,
          };
          
          if (!msg.parent_id) {
            setMessages(prev => {
              const existingIdx = prev.findIndex(m => m.id === msg.id);
              if (existingIdx >= 0) {
                const newArr = [...prev];
                newArr[existingIdx] = newMessageObj;
                return newArr;
              }
              // Only auto-scroll if user is near the bottom and it's a new message
              if (isNearBottomRef.current) setTimeout(scrollToBottom, 50);
              else setNewMessageCount(n => n + 1);
              return [...prev, newMessageObj];
            });
          } else {
            // Increment reply count on the parent message in real-time
            setMessages(prev => prev.map(m =>
              m.id === msg.parent_id
                ? { ...m, replyCount: m.replyCount + 1 }
                : m
            ));

            // Add to thread replies if viewing that thread
            if (threadMessage?.id === msg.parent_id) {
              setThreadReplies(prev => {
                const existingIdx = prev.findIndex(m => m.id === msg.id);
                if (existingIdx >= 0) {
                  const newArr = [...prev];
                  newArr[existingIdx] = newMessageObj;
                  return newArr;
                }
                return [...prev, newMessageObj];
              });
            }
          }
          /* eslint-enable @typescript-eslint/no-explicit-any */
        }
      )
      // 2. Message Updates / Soft Deletes
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `university_id=eq.${currentUser.universityId}` },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const msg = payload.new as any;
          if (msg.deleted_at) {
            // Remove deleted messages
            setMessages(prev => prev.filter(m => m.id !== msg.id));
            setThreadReplies(prev => prev.filter(m => m.id !== msg.id));
          } else {
             // Handle edits if any
             setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: msg.content } : m));
             setThreadReplies(prev => prev.map(m => m.id === msg.id ? { ...m, content: msg.content } : m));
          }
        }
      )
      // 3. New Reactions
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_reactions' },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const reaction = payload.new as any;
          if (reaction.user_id === currentUser.id) return; // Handled optimistically
          
          const updateFn = (prev: Message[]) => prev.map(m => {
            if (m.id !== reaction.message_id) return m;
            const newReactions = [...m.reactions];
            const existingIdx = newReactions.findIndex(r => r.emoji === reaction.emoji);
            if (existingIdx >= 0) {
              newReactions[existingIdx] = { ...newReactions[existingIdx], count: newReactions[existingIdx].count + 1 };
            } else {
              newReactions.push({ emoji: reaction.emoji, count: 1, reacted: false });
            }
            return { ...m, reactions: newReactions };
          });

          setMessages(updateFn);
          setThreadReplies(updateFn);
        }
      )
      // 4. Deleted Reactions
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_reactions' },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const reaction = payload.old as any;
          if (!reaction.message_id || !reaction.emoji) return; // Depends on REPLICA IDENTITY FULL
          
          const updateFn = (prev: Message[]) => prev.map(m => {
            if (m.id !== reaction.message_id) return m;
            const newReactions = [...m.reactions];
            const existingIdx = newReactions.findIndex(r => r.emoji === reaction.emoji);
            if (existingIdx >= 0) {
              const r = { ...newReactions[existingIdx] };
              r.count = Math.max(0, r.count - 1);
              if (r.count === 0 && !r.reacted) newReactions.splice(existingIdx, 1);
              else newReactions[existingIdx] = r;
            }
            return { ...m, reactions: newReactions };
          });

          setMessages(updateFn);
          setThreadReplies(updateFn);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUser.universityId, currentUser.id, threadMessage?.id]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!loading) scrollToBottom();
  }, [loading, messages.length]);

  // Open thread
  const openThread = async (message: Message) => {
    setThreadMessage(message);
    
    // Fetch thread replies
    const { data: replies } = await supabase
      .from('chat_messages')
      .select(`
        id, content, course_id, parent_id, attachments, created_at,
        author:students!author_id(id, first_name, last_name, full_name, avatar_url),
        course:courses!course_id(id, code, short_name, name)
      `)
      .eq('parent_id', message.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    /* eslint-disable @typescript-eslint/no-explicit-any */
    setThreadReplies((replies as any[] || []).map((r: any) => {
      // Unwrap arrays if Supabase returns them
      const author = Array.isArray(r.author) ? r.author[0] : r.author;
      const course = Array.isArray(r.course) ? r.course[0] : r.course;
      return {
        id: r.id,
        content: r.content,
        author: author || null,
        course: course || null,
        parentId: r.parent_id,
        replyCount: 0,
        reactions: [],
        attachments: r.attachments || [],
        createdAt: r.created_at,
      };
    }));
    /* eslint-enable @typescript-eslint/no-explicit-any */
  };

  // Format date divider label
  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  // Check if a date divider should be shown before a message
  const shouldShowDateDivider = (index: number) => {
    if (index === 0) return true;
    const current = new Date(filteredMessages[index].createdAt).toDateString();
    const previous = new Date(filteredMessages[index - 1].createdAt).toDateString();
    return current !== previous;
  };

  // Toggle reaction
  const toggleReaction = async (messageId: string, emoji: string) => {
    // Optimistically update local state instantly to avoid scroll/refresh jank
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      
      const newReactions = [...m.reactions];
      const existingIdx = newReactions.findIndex(r => r.emoji === emoji);
      
      if (existingIdx >= 0) {
        const r = { ...newReactions[existingIdx] }; // clone to avoid mutation
        if (r.reacted) {
          // Remove reaction
          r.count -= 1;
          r.reacted = false;
        } else {
          // Add reaction
          r.count += 1;
          r.reacted = true;
        }
        if (r.count <= 0) {
           newReactions.splice(existingIdx, 1);
        } else {
           newReactions[existingIdx] = r;
        }
      } else {
        // Add completely new reaction
        newReactions.push({ emoji, count: 1, reacted: true });
      }
      
      return { ...m, reactions: newReactions };
    }));

    // Also update thread replies if the message is in the thread
    setThreadReplies(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      
      const newReactions = [...m.reactions];
      const existingIdx = newReactions.findIndex(r => r.emoji === emoji);
      
      if (existingIdx >= 0) {
        const r = { ...newReactions[existingIdx] }; // clone to avoid mutation
        if (r.reacted) {
          // Remove reaction
          r.count -= 1;
          r.reacted = false;
        } else {
          // Add reaction
          r.count += 1;
          r.reacted = true;
        }
        if (r.count <= 0) {
           newReactions.splice(existingIdx, 1);
        } else {
           newReactions[existingIdx] = r;
        }
      } else {
        // Add completely new reaction
        newReactions.push({ emoji, count: 1, reacted: true });
      }
      
      return { ...m, reactions: newReactions };
    }));

    // Perform DB update in background
    // Check both messages and threadReplies for existing reaction
    const allMessages = [...messages, ...threadReplies];
    const existingReaction = allMessages.find(m => m.id === messageId)?.reactions.find(r => r.emoji === emoji && r.reacted);

    if (existingReaction) {
      await supabase
        .from('chat_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', currentUser.id)
        .eq('emoji', emoji);
    } else {
      await supabase
        .from('chat_reactions')
        .insert({ message_id: messageId, user_id: currentUser.id, emoji });
    }
    
    // Note: No fetchMessages() here. Local state handles the immediate feedback,
    // and the Realtime subscription (if hooked up to chat_reactions) handles syncing with other users.
  };

  return (
    <div 
      className="fixed inset-0 flex flex-col bg-gray-50 overscroll-contain touch-none"
      style={{
        height: keyboardHeight > 0 
          ? `${window.visualViewport?.height ?? (window.innerHeight - keyboardHeight)}px`
          : '100dvh',
        overscrollBehavior: 'contain',
      }}
    >
      {/* Header — morphs into search bar when active */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-gray-100 px-4 py-2.5 flex items-center gap-3 sticky top-0 z-10 min-h-[52px]">
        {showSearch ? (
          /* Search mode: full-width input */
          <>
            <button
              onClick={() => { setShowSearch(false); setSearchQuery(''); }}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
            >
              <IoArrowBack size={20} className="text-gray-900" />
            </button>
            <div className="flex-1 relative">
              <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && (setShowSearch(false), setSearchQuery(''))}
                className="w-full pl-9 pr-8 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {searchQuery && (
              <span className="text-xs text-gray-500 flex-shrink-0 whitespace-nowrap">
                {filteredMessages.length} result{filteredMessages.length !== 1 ? 's' : ''}
              </span>
            )}
          </>
        ) : (
          /* Normal mode: title + search icon */
          <>
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
            >
              <IoArrowBack size={20} className="text-gray-900" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-gray-900 text-base leading-tight">{universityAbbrev}</h1>
              <p className="text-xs text-gray-500">Community</p>
            </div>
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
            >
              <IoSearch className="w-5 h-5 text-gray-600" />
            </button>
          </>
        )}
      </header>


      {/* Course filter — X-style underline tabs */}
      <div className="bg-white border-b border-gray-100 overflow-x-auto scrollbar-hide">
        <div className="flex min-w-max">
          <button
            onClick={() => setSelectedCourse(null)}
            className={`px-5 py-3 text-sm font-medium whitespace-nowrap relative transition-colors ${
              !selectedCourse
                ? 'text-gray-900'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            For You
            {!selectedCourse && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500 rounded-full" />
            )}
          </button>
          {enrolledCourses.map((course) => (
            <button
              key={course.id}
              onClick={() => setSelectedCourse(course)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap relative transition-colors ${
                selectedCourse?.id === course.id
                  ? 'text-gray-900'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              #{course.code || course.shortName || course.name}
              {selectedCourse?.id === course.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto overscroll-contain touch-pan-y relative bg-white">
        <div className="max-w-2xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <IoChatbubble className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No messages yet</p>
            <p className="text-gray-400 text-sm mt-1">Be the first to start the conversation!</p>
          </div>
        ) : filteredMessages.length === 0 && searchQuery ? (
          <div className="text-center py-12 px-6">
            <IoSearch className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No results for &ldquo;{searchQuery}&rdquo;</p>
            <p className="text-gray-400 text-sm mt-1">Try a different search term</p>
          </div>
        ) : (
          <>
            {hasMore && !searchQuery && (
              <div className="flex justify-center py-3 border-b border-gray-100">
                <button
                  onClick={loadMoreMessages}
                  disabled={loadingMore}
                  className="text-green-600 text-sm font-medium hover:text-green-700 disabled:opacity-50 transition-colors"
                >
                  {loadingMore ? 'Loading...' : 'Show earlier posts'}
                </button>
              </div>
            )}
            {filteredMessages.map((message, index) => (
              <div key={message.id}>
                {/* X-style date divider */}
                {shouldShowDateDivider(index) && (
                  <div className="flex items-center justify-center py-3">
                    <span className="text-xs text-gray-400 font-medium bg-white px-3">
                      {getDateLabel(message.createdAt)}
                    </span>
                  </div>
                )}
                <MessageItem
                  message={message}
                  currentUserId={currentUser.id}
                  onOpenThread={() => openThread(message)}
                  onToggleReaction={(emoji) => toggleReaction(message.id, emoji)}
                  onMessageEdited={(id, content) => setMessages(prev => prev.map(m => m.id === id ? { ...m, content } : m))}
                  onMessageDeleted={(id) => setMessages(prev => prev.filter(m => m.id !== id))}
                  searchQuery={searchQuery}
                />
              </div>
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
        </div>

        {/* Scroll to bottom FAB */}
        {showScrollButton && (
          <button
            onClick={() => {
              scrollToBottom();
              setNewMessageCount(0);
            }}
            className="sticky bottom-4 left-1/2 -translate-x-1/2 bg-green-500 text-white shadow-lg rounded-full px-4 py-2 flex items-center gap-2 text-sm font-medium hover:bg-green-600 transition-all z-20 mx-auto w-fit"
          >
            <IoChevronDown className="w-4 h-4" />
            {newMessageCount > 0 ? (
              <span>{newMessageCount} new {newMessageCount === 1 ? 'post' : 'posts'}</span>
            ) : (
              <span>Jump to latest</span>
            )}
          </button>
        )}
      </div>

      {/* Chat input */}
      <div 
        ref={inputContainerRef}
        className="flex-none z-10 bg-white border-t border-gray-100"
        style={{
          paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), 12px) + 8px)'
        }}
      >
        <div className="max-w-2xl mx-auto w-full">
          <ChatInput
            currentUser={currentUser}
            enrolledCourses={enrolledCourses}
            selectedCourse={selectedCourse}
            parentId={null}
            onSend={(msg) => {
              if (msg) {
                setMessages(prev => [...prev, msg]);
                setTimeout(scrollToBottom, 50);
              } else {
                fetchMessages();
              }
            }}
          />
        </div>
      </div>

      {/* Thread panel */}
      {threadMessage && (
        <div 
          className="fixed inset-0 bg-black/30 z-50 flex justify-end"
          onClick={() => setThreadMessage(null)}
        >
          <div 
            className="w-full max-w-md bg-white flex flex-col animate-slide-in-right"
            style={{
              height: keyboardHeight > 0 
                ? `${window.visualViewport?.height ?? (window.innerHeight - keyboardHeight)}px`
                : '100dvh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
              <button
                onClick={() => setThreadMessage(null)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <IoArrowBack className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h2 className="font-semibold text-gray-900">Thread</h2>
                <p className="text-xs text-gray-500">{threadReplies.length} replies</p>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 overscroll-contain touch-pan-y">
              {/* Original message */}
              <MessageItem
                message={threadMessage}
                currentUserId={currentUser.id}
                onToggleReaction={(emoji) => toggleReaction(threadMessage.id, emoji)}
                onMessageEdited={(id, content) => {
                  setMessages(prev => prev.map(m => m.id === id ? { ...m, content } : m));
                  setThreadMessage(prev => prev?.id === id ? { ...prev, content } : prev);
                }}
                onMessageDeleted={(id) => {
                  setMessages(prev => prev.filter(m => m.id !== id));
                  setThreadMessage(null);
                }}
                isThreadParent
              />
              
              <div className="border-t my-4" />
              
              {/* Thread replies */}
              {threadReplies.map((reply) => (
                <MessageItem
                  key={reply.id}
                  message={reply}
                  currentUserId={currentUser.id}
                  onToggleReaction={(emoji) => toggleReaction(reply.id, emoji)}
                  onMessageEdited={(id, content) => setThreadReplies(prev => prev.map(m => m.id === id ? { ...m, content } : m))}
                  onMessageDeleted={(id) => setThreadReplies(prev => prev.filter(m => m.id !== id))}
                />
              ))}
            </div>

            <div 
              ref={threadInputRef}
              className="flex-none bg-white border-t border-gray-100"
              style={{
                paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), 12px) + 8px)'
              }}
            >
              <ChatInput
                currentUser={currentUser}
                enrolledCourses={enrolledCourses}
                selectedCourse={threadMessage.course ? {
                  id: threadMessage.course.id,
                  code: threadMessage.course.code,
                  shortName: threadMessage.course.short_name,
                  name: threadMessage.course.name,
                } : null}
                parentId={threadMessage.id}
                onSend={(msg) => {
                  if (msg) {
                    setThreadReplies(prev => [...prev, msg]);
                  } else {
                    // Fallback to fetch just the thread if msg is undefined
                    fetchMessages();
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
