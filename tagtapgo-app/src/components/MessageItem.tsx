'use client';
/* eslint-disable @next/next/no-img-element */

/**
 * MessageItem Component
 * Twitter/X-style single-column feed post layout.
 * All posts are left-aligned regardless of author.
 */

import { formatDistanceToNow } from 'date-fns';
import { IoChatbubble, IoHappy, IoEllipsisHorizontal, IoPencil, IoTrash, IoCheckmark, IoClose } from 'react-icons/io5';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Avatar } from '@/components/ui/Avatar';
import type { Message } from './CommunityChat';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '🙏', '👀'];

/**
 * Renders message content with @mentions and #tags highlighted
 * Also highlights the current search query if provided
 */
function RichContent({ text, searchQuery }: { text: string; searchQuery?: string }) {
  const parts = useMemo(() => {
    // Matches @"Full Name" OR @username OR #tag
    const regex = /(@"[^"]+")|(@\w+)|(#\w+)/g;
    const baseParts: { type: 'text' | 'mention' | 'tag'; value: string }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        baseParts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
      }
      if (match[1] || match[2]) baseParts.push({ type: 'mention', value: match[1] || match[2] });
      else if (match[3]) baseParts.push({ type: 'tag', value: match[3] });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      baseParts.push({ type: 'text', value: text.slice(lastIndex) });
    }

    if (!searchQuery) return baseParts;

    const finalParts: { type: 'text' | 'mention' | 'tag' | 'highlight'; value: string }[] = [];
    // Escape regex characters in search query
    const safeQuery = searchQuery.replace(/[.*?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(`(${safeQuery})`, 'gi');

    for (const part of baseParts) {
      if (part.type !== 'text') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        finalParts.push(part as any);
        continue;
      }
      
      const subParts = part.value.split(searchRegex);
      for (let i = 0; i < subParts.length; i++) {
        if (!subParts[i]) continue;
        if (i % 2 === 1) {
          finalParts.push({ type: 'highlight', value: subParts[i] });
        } else {
          finalParts.push({ type: 'text', value: subParts[i] });
        }
      }
    }

    return finalParts;
  }, [text, searchQuery]);

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'highlight') {
          return <mark key={i} className="bg-yellow-200 text-gray-900 rounded-sm px-0.5">{part.value}</mark>;
        }
        if (part.type === 'mention') {
          // Strip quotes if they exist, e.g. @"John Doe" -> @John Doe
          const displayName = part.value.startsWith('@"') 
            ? '@' + part.value.slice(2, -1) 
            : part.value;
          return <span key={i} className="text-green-600 font-medium hover:underline cursor-pointer">{displayName}</span>;
        }
        if (part.type === 'tag') {
          return <span key={i} className="text-green-600 font-medium hover:underline cursor-pointer">{part.value}</span>;
        }
        return <span key={i}>{part.value}</span>;
      })}
    </>
  );
}

interface MessageItemProps {
  message: Message;
  currentUserId: string;
  onOpenThread?: () => void;
  onToggleReaction: (emoji: string) => void;
  onMessageEdited?: (messageId: string, newContent: string) => void;
  onMessageDeleted?: (messageId: string) => void;
  isThreadParent?: boolean;
  searchQuery?: string;
}

export default function MessageItem({
  message,
  currentUserId,
  onOpenThread,
  onToggleReaction,
  onMessageEdited,
  onMessageDeleted,
  isThreadParent = false,
  searchQuery,
}: MessageItemProps) {
  const toast = useToast();
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showMessageMenu, setShowMessageMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const reactionPickerRef = useRef<HTMLDivElement>(null);
  const messageMenuRef = useRef<HTMLDivElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createClient();
  const isOwnMessage = message.author?.id === currentUserId;
  // 15-minute edit window
  const canEdit = isOwnMessage && (Date.now() - new Date(message.createdAt).getTime()) < 15 * 60 * 1000;

  // Close emoji picker when clicking outside
  useEffect(() => {
    if (!showReactionPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target as Node)) {
        setShowReactionPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showReactionPicker]);

  // Close message menu when clicking outside
  useEffect(() => {
    if (!showMessageMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (messageMenuRef.current && !messageMenuRef.current.contains(e.target as Node)) {
        setShowMessageMenu(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMessageMenu]);

  // Auto-focus edit textarea
  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus();
      editTextareaRef.current.selectionStart = editTextareaRef.current.value.length;
    }
  }, [isEditing]);

  const handleSaveEdit = useCallback(async () => {
    const trimmed = editContent.trim();
    if (!trimmed || trimmed === message.content) {
      setIsEditing(false);
      return;
    }
    setIsSavingEdit(true);
    const { error } = await supabase
      .from('chat_messages')
      .update({ content: trimmed })
      .eq('id', message.id);
    setIsSavingEdit(false);
    if (!error) {
      setIsEditing(false);
      onMessageEdited?.(message.id, trimmed);
    }
  }, [editContent, message.content, message.id, supabase, onMessageEdited]);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(true);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(false);
    setShowMessageMenu(false);
  };

  const executeDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    const { data, error } = await supabase
      .from('chat_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', message.id)
      .select();
    setIsDeleting(false);
    
    if (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete message: ' + error.message);
      return;
    }
    
    if (!data || data.length === 0) {
      console.error('Delete error: No rows affected');
      toast.error('Could not delete message (access denied or already deleted)');
      return;
    }

    setShowMessageMenu(false);
    onMessageDeleted?.(message.id);
  }, [message.id, supabase, onMessageDeleted, toast]);

  // Generate signed URLs for private bucket attachments
  useEffect(() => {
    const generateSignedUrls = async () => {
      if (message.attachments.length === 0) return;
      const urls: Record<string, string> = {};
      for (const att of message.attachments) {
        if (!att.path || signedUrls[att.path]) continue;
        const { data, error } = await supabase.storage
          .from('chat-attachments')
          .createSignedUrl(att.path, 3600);
        if (!error && data?.signedUrl) urls[att.path] = data.signedUrl;
      }
      if (Object.keys(urls).length > 0) setSignedUrls(prev => ({ ...prev, ...urls }));
    };
    generateSignedUrls();
  }, [message.attachments]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get author display name
  const authorName = message.author?.full_name ||
    `${message.author?.first_name || ''} ${message.author?.last_name || ''}`.trim() ||
    'Unknown';

  // Get initials for avatar fallback
  const initials = authorName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Format time — short X-style
  const timeAgo = formatDistanceToNow(new Date(message.createdAt), { addSuffix: false });

  // Smart picker positioning
  const [pickerPosition, setPickerPosition] = useState<'left' | 'right'>('left');

  // Sync menus context - close others when opening one
  useEffect(() => {
    const handleCloseOthers = (e: CustomEvent) => {
      if (e.detail !== message.id) {
        setShowReactionPicker(false);
        setShowMessageMenu(false);
        setConfirmDelete(false);
      }
    };
    window.addEventListener('chat-close-menus', handleCloseOthers as EventListener);
    return () => window.removeEventListener('chat-close-menus', handleCloseOthers as EventListener);
  }, [message.id]);

  const notifyMenusActivity = () => {
    window.dispatchEvent(new CustomEvent('chat-close-menus', { detail: message.id }));
  };

  const handleOpenPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    notifyMenusActivity();
    if (!reactionPickerRef.current) return;
    const rect = reactionPickerRef.current.getBoundingClientRect();
    const spaceOnRight = window.innerWidth - rect.left;
    if (spaceOnRight < 220) {
      setPickerPosition('right');
    } else {
      setPickerPosition('left');
    }
    setShowReactionPicker(!showReactionPicker);
  };

  // Long press logic for mobile
  const touchStartRef = useRef<{ x: number, y: number } | null>(null);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (showReactionPicker) return; // Prevent triggering if already open
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      // Find a safe position
      setPickerPosition('left');
      notifyMenusActivity();
      setShowReactionPicker(true);
      if (window.navigator?.vibrate) window.navigator.vibrate(50);
    }, 500); // 500ms long press
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartRef.current.y);
    if (dx > 10 || dy > 10) {
       if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
       touchStartRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchStartRef.current = null;
  };

  return (
    <article 
      className={`flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${isThreadParent ? 'bg-gray-50' : ''} ${message.isOptimistic ? 'opacity-60 transition-opacity duration-300' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Avatar column */}
      <div className="flex-shrink-0 pt-0.5">
      <div className="flex-shrink-0 pt-0.5 relative">
        <Avatar
          src={message.author?.avatar_url || undefined}
          alt={authorName}
          size="md"
          fallbackIcon={<span className="text-white text-sm font-bold">{initials}</span>}
          className={isOwnMessage && !message.author?.avatar_url ? 'bg-green-500' : 'bg-gray-500'}
        />
        {/* Thread connector line for parent posts */}
        {isThreadParent && (
          <div className="w-0.5 bg-gray-200 absolute left-1/2 -translate-x-1/2 top-11 bottom-[-14px]" />
        )}
      </div>
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <span className="font-bold text-gray-900 text-sm leading-tight">
            {authorName}
          </span>
          {isOwnMessage && (
            <span className="text-xs text-gray-400 font-normal">You</span>
          )}
          {message.course && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium border border-green-100">
              #{message.course.code || message.course.short_name || message.course.name}
            </span>
          )}
          <span className="text-gray-400 text-xs">· {timeAgo}</span>

          {/* ⋯ context menu for own messages */}
          {isOwnMessage && (
            <div className="relative ml-auto" ref={messageMenuRef}>
              <button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (!showMessageMenu) notifyMenusActivity();
                  setShowMessageMenu(v => !v); 
                  setConfirmDelete(false); 
                }}
                className="p-1 rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                aria-label="Message options"
              >
                <IoEllipsisHorizontal className="w-4 h-4" />
              </button>

              {showMessageMenu && (
                <div className="absolute right-0 top-7 z-30 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden min-w-[220px] py-1">
                  {/* Edit */}
                  {canEdit && !confirmDelete && (
                    <button
                      onClick={() => { setIsEditing(true); setEditContent(message.content); setShowMessageMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <IoPencil className="w-4 h-4 text-gray-400" />
                      Edit Message
                    </button>
                  )}
                  {/* Delete Option or Confirm Yes/No */}
                  {confirmDelete ? (
                    <div className="p-4 px-5">
                      <p className="font-bold text-gray-900 mb-1 text-base">Delete message?</p>
                      <p className="text-sm text-gray-500 mb-4 leading-snug">This can&apos;t be undone and it will be removed for everyone.</p>
                      <button
                        onClick={executeDelete}
                        disabled={isDeleting}
                        className="w-full bg-red-600 text-white font-bold py-2.5 rounded-full mb-2 hover:bg-red-700 active:bg-red-800 transition-colors disabled:opacity-50 text-sm"
                      >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </button>
                      <button
                        onClick={cancelDelete}
                        disabled={isDeleting}
                        className="w-full bg-white border border-gray-300 text-gray-900 font-bold py-2.5 rounded-full hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleDeleteClick}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <IoTrash className="w-4 h-4" />
                      Delete Message
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Message text — or inline edit textarea */}
        {isEditing ? (
          <div className="mb-2">
            <textarea
              ref={editTextareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                if (e.key === 'Escape') { setIsEditing(false); }
              }}
              className="w-full text-sm text-gray-900 border border-green-400 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-green-300 leading-relaxed"
              rows={Math.max(2, editContent.split('\n').length)}
            />
            <div className="flex gap-2 mt-1.5">
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-500 text-white rounded-full font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                <IoCheckmark className="w-3.5 h-3.5" />
                {isSavingEdit ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full font-medium hover:bg-gray-200 transition-colors"
              >
                <IoClose className="w-3.5 h-3.5" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-gray-900 text-sm leading-relaxed whitespace-pre-wrap break-words mb-2">
            <RichContent text={message.content} searchQuery={searchQuery} />
          </p>
        )}

        {/* Attachments */}
        {message.attachments.length > 0 && (
          <div className={`mb-2 rounded-2xl overflow-hidden border border-gray-200 ${message.attachments.length === 1 ? 'max-w-sm' : 'grid grid-cols-2 gap-0.5'}`}>
            {message.attachments.map((att, i) => {
              const signedUrl = signedUrls[att.path];
              if (!signedUrl) {
                return (
                  <div key={i} className="h-32 bg-gray-100 animate-pulse rounded" />
                );
              }
              return att.type.startsWith('image/') ? (
                <a key={i} href={signedUrl} target="_blank" rel="noopener noreferrer">
                  <img
                    src={signedUrl}
                    alt={att.name}
                    className="w-full object-cover max-h-72 hover:opacity-95 transition-opacity"
                  />
                </a>
              ) : (
                <a
                  key={i}
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-gray-50 text-blue-600 text-xs hover:bg-gray-100 transition-colors"
                >
                  📎 {att.name}
                </a>
              );
            })}
          </div>
        )}

        {/* Unified action bar — reply + inline reaction pills + add-reaction picker */}
        <div className="flex items-center gap-1 flex-wrap mt-1.5">
          {/* Reply button */}
          {onOpenThread && !isThreadParent && (
            <button
              onClick={onOpenThread}
              className="group flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-500 transition-colors mr-2"
            >
              <span className="p-1.5 rounded-full group-hover:bg-blue-50 transition-colors">
                <IoChatbubble className="w-4 h-4" />
              </span>
              <span>{message.replyCount > 0 ? message.replyCount : ''}</span>
            </button>
          )}

          {/* Existing reaction pills — inline in the action bar */}
          {message.reactions.map((reaction) => (
            <button
              key={reaction.emoji}
              onClick={() => onToggleReaction(reaction.emoji)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all border active:scale-95 ${
                reaction.reacted
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-transparent text-gray-500 border-gray-200 hover:border-green-200 hover:bg-green-50 hover:text-green-700'
              }`}
            >
              <span className="leading-none">{reaction.emoji}</span>
              <span>{reaction.count}</span>
            </button>
          ))}

          {/* Add reaction button + picker */}
          <div className="relative" ref={reactionPickerRef}>
            <button
              onClick={handleOpenPicker}
              className="group flex items-center p-1.5 rounded-full text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
              aria-label="Add reaction"
            >
              <IoHappy className="w-3.5 h-3.5" />
            </button>

            {showReactionPicker && (
              <div className={`absolute bottom-full mb-2 bg-white shadow-xl border border-gray-100 rounded-2xl px-3 py-2 flex gap-2.5 z-20 ${pickerPosition === 'right' ? 'right-0 origin-bottom-right' : 'left-0 origin-bottom-left'}`}>
                {QUICK_REACTIONS.map((emoji, i) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onToggleReaction(emoji);
                      setShowReactionPicker(false);
                    }}
                    className="text-xl leading-none transition-all hover:scale-125 active:scale-110"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
