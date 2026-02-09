'use client';
/* eslint-disable @next/next/no-img-element */

/**
 * MessageItem Component
 * Displays a single chat message with author, course badge, reactions, and thread link
 */

import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, Hash, Smile } from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import type { Message } from './CommunityChat';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '🙏', '👀'];

/**
 * Renders message content with @mentions and #tags highlighted
 */
function RichContent({ text, isOwn }: { text: string; isOwn: boolean }) {
  const parts = useMemo(() => {
    // Split at @mentions and #tags while keeping delimiters
    const regex = /(@[\w\s]+?(?=\s@|\s#|$))|(#[\w]+)/g;
    const result: { type: 'text' | 'mention' | 'tag'; value: string }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'text', value: text.slice(lastIndex, match.index) });
      }
      if (match[1]) {
        result.push({ type: 'mention', value: match[1] });
      } else if (match[2]) {
        result.push({ type: 'tag', value: match[2] });
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      result.push({ type: 'text', value: text.slice(lastIndex) });
    }

    return result;
  }, [text]);

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'mention') {
          return (
            <span
              key={i}
              className={`font-semibold ${isOwn ? 'text-green-700' : 'text-green-600'}`}
            >
              {part.value}
            </span>
          );
        }
        if (part.type === 'tag') {
          return (
            <span
              key={i}
              className={`font-medium ${isOwn ? 'text-green-700' : 'text-green-600'}`}
            >
              {part.value}
            </span>
          );
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
  isThreadParent?: boolean;
}

export default function MessageItem({
  message,
  currentUserId,
  onOpenThread,
  onToggleReaction,
  isThreadParent = false,
}: MessageItemProps) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const reactionPickerRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const isOwnMessage = message.author?.id === currentUserId;

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

  // Generate signed URLs for private bucket attachments
  useEffect(() => {
    const generateSignedUrls = async () => {
      if (message.attachments.length === 0) return;
      
      const urls: Record<string, string> = {};
      for (const att of message.attachments) {
        if (!att.path || signedUrls[att.path]) continue;
        
        const { data, error } = await supabase.storage
          .from('chat-attachments')
          .createSignedUrl(att.path, 3600); // 1 hour expiry
        
        if (!error && data?.signedUrl) {
          urls[att.path] = data.signedUrl;
        }
      }
      
      if (Object.keys(urls).length > 0) {
        setSignedUrls(prev => ({ ...prev, ...urls }));
      }
    };
    
    generateSignedUrls();
  }, [message.attachments]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get author display name
  const authorName = message.author?.full_name ||
    `${message.author?.first_name || ''} ${message.author?.last_name || ''}`.trim() ||
    'Unknown';

  // Get initials for avatar
  const initials = authorName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Format time
  const timeAgo = formatDistanceToNow(new Date(message.createdAt), { addSuffix: true });

  return (
    <div className={`group relative ${isOwnMessage ? 'flex flex-row-reverse' : ''}`}>
      <div className={`flex gap-3 max-w-[85%] ${isOwnMessage ? 'ml-auto' : ''}`}>
        {/* Avatar */}
        {message.author?.avatar_url ? (
          <img
            src={message.author.avatar_url}
            alt={authorName}
            className="w-9 h-9 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
            {initials}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Header: Name, Course Badge, Time */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-gray-900 text-base sm:text-sm">{authorName}</span>
            
            {message.course && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                <Hash className="w-3 h-3" />
                {message.course.code || message.course.short_name || message.course.name}
              </span>
            )}
            
            <span className="text-xs text-gray-400">{timeAgo}</span>
          </div>

          {/* Content */}
          <div
            className={`rounded-2xl px-4 py-2.5 ${
              isOwnMessage
                ? 'bg-green-100 text-green-900'
                : 'bg-white shadow-sm border border-gray-100'
            }`}
          >
            <p className={`text-base sm:text-sm whitespace-pre-wrap break-words ${isOwnMessage ? 'text-green-900' : 'text-gray-800'}`}>
              <RichContent text={message.content} isOwn={isOwnMessage} />
            </p>

            {/* Attachments */}
            {message.attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {message.attachments.map((att, i) => {
                  const signedUrl = signedUrls[att.path];
                  
                  if (!signedUrl) {
                    // Loading state while signed URL is being generated
                    return (
                      <div key={i} className="text-xs text-gray-400">
                        Loading attachment...
                      </div>
                    );
                  }
                  return (
                    <a
                      key={i}
                      href={signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 text-xs ${
                        isOwnMessage ? 'text-green-700 hover:text-green-800' : 'text-blue-600 hover:underline'
                      }`}
                    >
                      {att.type.startsWith('image/') ? (
                        <img src={signedUrl} alt={att.name} className="max-w-[200px] max-h-[150px] rounded-lg mt-1" />
                      ) : (
                        <>📎 {att.name}</>
                      )}
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reactions */}
          {message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {message.reactions.map((reaction) => (
                <button
                  key={reaction.emoji}
                  onClick={() => onToggleReaction(reaction.emoji)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                    reaction.reacted
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                  }`}
                >
                  <span>{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Actions: Thread & React */}
          <div className="flex items-center gap-3 mt-1.5">
            {onOpenThread && !isThreadParent && (
              <button
                onClick={onOpenThread}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-green-600 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {message.replyCount > 0 ? (
                  <span>{message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}</span>
                ) : (
                  <span>Reply</span>
                )}
              </button>
            )}

            {/* Reaction picker trigger */}
            <div className="relative" ref={reactionPickerRef}>
              <button
                onClick={() => setShowReactionPicker(!showReactionPicker)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 active:text-gray-600 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                aria-label="Add reaction"
              >
                <Smile className="w-3.5 h-3.5" />
              </button>

              {showReactionPicker && (
                <div className="absolute bottom-full left-0 mb-1 bg-white shadow-lg rounded-full border px-2 py-1 flex gap-1 z-10">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onToggleReaction(emoji);
                        setShowReactionPicker(false);
                      }}
                      className="hover:scale-125 transition-transform text-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
