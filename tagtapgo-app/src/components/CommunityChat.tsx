'use client';
// @ts-nocheck - Supabase join type inference limitation with !foreign_key syntax

/**
 * CommunityChat Component
 * Real-time chat with #course-tag targeting and threaded replies
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { MessageCircle, Hash, Search, ArrowLeft, ChevronDown } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
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

      if (searchQuery.trim()) {
        query = query.textSearch('search_vector', searchQuery.trim());
      }

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
  }, [supabase, currentUser.universityId, currentUser.id, selectedCourse, searchQuery, toast]);

  const loadMoreMessages = async () => {
    if (messages.length > 0 && !loadingMore) {
      setLoadingMore(true);
      await fetchMessages(messages[0].createdAt);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('community-chat')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `university_id=eq.${currentUser.universityId}`,
        },
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
          // Unwrap arrays if Supabase returns them
          const author = Array.isArray(msg?.author) ? msg.author[0] : msg?.author;
          const course = Array.isArray(msg?.course) ? msg.course[0] : msg?.course;
          
          if (msg && !msg.parent_id) {
            setMessages(prev => [...prev, {
              id: msg.id,
              content: msg.content,
              author: author || null,
              course: course || null,
              parentId: msg.parent_id,
              replyCount: 0,
              reactions: [],
              attachments: msg.attachments || [],
              createdAt: msg.created_at,
            }]);
            // Only auto-scroll if user is near the bottom
            if (isNearBottomRef.current) {
              scrollToBottom();
            } else {
              setNewMessageCount(prev => prev + 1);
            }
          } else if (msg && msg.parent_id) {
            // Increment reply count on the parent message in real-time
            setMessages(prev => prev.map(m =>
              m.id === msg.parent_id
                ? { ...m, replyCount: m.replyCount + 1 }
                : m
            ));

            // Add to thread replies if viewing that thread
            if (threadMessage?.id === msg.parent_id) {
              setThreadReplies(prev => [...prev, {
                id: msg.id,
                content: msg.content,
                author: author || null,
                course: course || null,
                parentId: msg.parent_id,
                replyCount: 0,
                reactions: [],
                attachments: msg.attachments || [],
                createdAt: msg.created_at,
              }]);
            }
          }
          /* eslint-enable @typescript-eslint/no-explicit-any */
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUser.universityId, threadMessage?.id]);

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
    const current = new Date(messages[index].createdAt).toDateString();
    const previous = new Date(messages[index - 1].createdAt).toDateString();
    return current !== previous;
  };

  // Toggle reaction
  const toggleReaction = async (messageId: string, emoji: string) => {
    const message = messages.find(m => m.id === messageId);
    const existingReaction = message?.reactions.find(r => r.emoji === emoji && r.reacted);

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

    // Refetch to update counts
    fetchMessages();
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
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">{universityAbbrev}</span>
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">{universityAbbrev}</h1>
            <p className="text-xs text-gray-500">Community Feed</p>
          </div>
        </div>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <Search className="w-5 h-5 text-gray-600" />
        </button>
      </header>

      {/* Search bar */}
      {showSearch && (
        <div className="bg-white border-b px-4 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchMessages()}
              autoFocus
              className="w-full pl-9 pr-8 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  fetchMessages();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
              >
                <span className="sr-only">Clear search</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Course filter tabs */}
      <div className="bg-white border-b px-2 py-2 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedCourse(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              !selectedCourse
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {enrolledCourses.map((course) => (
            <button
              key={course.id}
              onClick={() => setSelectedCourse(course)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                selectedCourse?.id === course.id
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Hash className="w-3 h-3" />
              {course.code || course.shortName || course.name}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 overscroll-contain touch-pan-y relative">
        <div className="max-w-2xl mx-auto space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No messages yet</p>
            <p className="text-gray-400 text-sm mt-1">Be the first to start the conversation!</p>
          </div>
        ) : (
          <>
            {hasMore && messages.length > 0 && (
              <div className="flex justify-center pb-4">
                <button
                  onClick={loadMoreMessages}
                  disabled={loadingMore}
                  className="bg-white border text-gray-600 px-4 py-2 rounded-full text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {loadingMore ? 'Loading...' : 'Load Previous Messages'}
                </button>
              </div>
            )}
            {messages.map((message, index) => (
              <div key={message.id}>
                {/* Date divider */}
                {shouldShowDateDivider(index) && (
                  <div className="flex items-center gap-3 py-2 mb-2">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 font-medium px-2">
                      {getDateLabel(message.createdAt)}
                    </span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                )}
                <MessageItem
                  message={message}
                  currentUserId={currentUser.id}
                  onOpenThread={() => openThread(message)}
                  onToggleReaction={(emoji) => toggleReaction(message.id, emoji)}
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
            className="sticky bottom-4 left-1/2 -translate-x-1/2 bg-white shadow-lg border border-gray-200 rounded-full px-4 py-2 flex items-center gap-2 text-sm text-gray-600 hover:bg-gray-50 transition-all z-20 mx-auto w-fit"
          >
            <ChevronDown className="w-4 h-4" />
            {newMessageCount > 0 ? (
              <span className="flex items-center gap-1.5">
                {newMessageCount} new {newMessageCount === 1 ? 'message' : 'messages'}
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              </span>
            ) : (
              'Scroll to bottom'
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
            onMessageSent={fetchMessages}
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
                <ArrowLeft className="w-5 h-5 text-gray-600" />
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
                onMessageSent={() => { /* Let realtime handle the new reply */ }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
