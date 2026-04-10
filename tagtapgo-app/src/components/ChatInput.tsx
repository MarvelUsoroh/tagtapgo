'use client';
/* eslint-disable @next/next/no-img-element */

/**
 * ChatInput Component
 * Enhanced input with #course-tag autocomplete and file upload
 */

import { useState, useRef, useEffect } from 'react';
import { IoSend, IoPricetag, IoAttach, IoClose, IoHourglass } from 'react-icons/io5';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import type { Message } from './CommunityChat';

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

interface ChatInputProps {
  currentUser: User;
  enrolledCourses: Course[];
  selectedCourse: Course | null;
  parentId: string | null;
  onSend?: (msg?: Message) => void;
}

interface PendingAttachment {
  file: File;
  preview?: string;
}

export default function ChatInput({
  currentUser,
  enrolledCourses,
  selectedCourse,
  parentId,
  onSend,
}: ChatInputProps) {
  const [content, setContent] = useState('');
  const [courseTag, setCourseTag] = useState<Course | null>(selectedCourse);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const courseDropdownRef = useRef<HTMLDivElement>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);
  // supabase singleton — no per-render client creation
  const toast = useToast();

  // Mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<User[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursorPos, setCursorPos] = useState(0);

  // Search for users to mention
  useEffect(() => {
    if (mentionQuery === null) {
      setMentionResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      // Ensure we have an active session for RLS to evaluate correctly
      await supabase.auth.getSession();
      let query;
      if (courseTag) {
        query = supabase
          .from('students')
          .select('*, enrollments!inner(course_id, status)')
          .eq('university_id', currentUser.universityId)
          .eq('enrollments.course_id', courseTag.id)
          .eq('enrollments.status', 'active');
      } else {
        query = supabase
          .from('students')
          .select('*')
          .eq('university_id', currentUser.universityId);
      }

      const { data, error } = await query
        .ilike('full_name', `%${mentionQuery}%`)
        .neq('id', currentUser.id)
        .limit(5);

      if (error) {
        console.error('[Mentions] Query Error:', error);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formattedData: User[] = (data || []).map((u: any) => ({
        id: u.id,
        universityId: u.university_id,
        firstName: u.first_name,
        lastName: u.last_name,
        fullName: u.full_name,
        avatarUrl: u.avatar_url
      }));
      
      setMentionResults(formattedData);
      setMentionIndex(0);
    }, 300);

    return () => clearTimeout(timer);
  }, [mentionQuery, currentUser.universityId, currentUser.id, courseTag]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setContent(newVal);
    
    // Check for mention trigger
    const selectionStart = e.target.selectionStart;
    setCursorPos(selectionStart);
    
    const textBeforeCursor = newVal.slice(0, selectionStart);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9\s]*)$/);
    
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (user: User) => {
    const textBeforeCursor = content.slice(0, cursorPos);
    const textAfterCursor = content.slice(cursorPos);
    
    const popLength = mentionQuery ? mentionQuery.length + 1 : 1; // +1 for @
    const newTextBefore = textBeforeCursor.slice(0, -popLength) + `@"${user.fullName}" `;
    
    setContent(newTextBefore + textAfterCursor);
    setMentionQuery(null);
    setMentionResults([]);
    
    // Reset cursor position needs timeout to wait for render
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = newTextBefore.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  // Update courseTag when selectedCourse changes
  useEffect(() => {
    setCourseTag(selectedCourse);
  }, [selectedCourse]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [content]);

  // Click-outside handler for course dropdown
  useEffect(() => {
    if (!showCourseDropdown) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (courseDropdownRef.current && !courseDropdownRef.current.contains(e.target as Node)) {
        setShowCourseDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCourseDropdown]);

  // Click-outside handler for mention dropdown
  useEffect(() => {
    if (mentionResults.length === 0) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (mentionDropdownRef.current && !mentionDropdownRef.current.contains(e.target as Node)) {
        setMentionResults([]);
        setMentionQuery(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mentionResults]);

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newAttachments: PendingAttachment[] = [];
    for (const file of files) {
      // Max 10MB
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`);
        continue;
      }

      const attachment: PendingAttachment = { file };
      const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|avif|heic|heif|bmp)$/i.test(file.name);
      if (isImage) {
        attachment.preview = URL.createObjectURL(file);
      }
      newAttachments.push(attachment);
    }

    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const updated = [...prev];
      if (updated[index].preview) URL.revokeObjectURL(updated[index].preview!);
      updated.splice(index, 1);
      return updated;
    });
  };

  // Send message
  const handleSend = async () => {
    if (!content.trim() && attachments.length === 0) return;
    if (sending) return;

    // Store message content and attachments before clearing
    const messageContent = content.trim();
    const messageAttachments = [...attachments];
    const messageId = crypto.randomUUID(); // Client-generated UUID for deduplication
    
    // Create optimistic message object for the UI
    const optimisticMessage: Message = {
      id: messageId,
      content: messageContent,
      author: {
        id: currentUser.id,
        first_name: currentUser.firstName,
        last_name: currentUser.lastName,
        full_name: currentUser.fullName,
        avatar_url: currentUser.avatarUrl,
      },
      course: courseTag ? {
        id: courseTag.id,
        code: courseTag.code,
        short_name: courseTag.shortName,
        name: courseTag.name,
      } : null,
      parentId: parentId || null,
      replyCount: 0,
      reactions: [],
      attachments: messageAttachments.map(a => ({ 
        path: a.preview || '', // Use preview URL temporarily for rendering
        type: a.file.type, 
        name: a.file.name,
        size: a.file.size
      })),
      createdAt: new Date().toISOString(),
    };

    // Propagate optimistic message to UI immediately
    if (onSend) onSend(optimisticMessage);

    // Clear input immediately for better UX
    setContent('');
    setAttachments([]);
    if (!parentId) setCourseTag(null);

    setSending(true);
    try {
      // Upload attachments first
      const uploadedFiles: { path: string; type: string; name: string; size: number }[] = [];
      if (messageAttachments.length > 0) {
        setUploading(true);
        try {
          for (const att of messageAttachments) {
            const safeName = att.file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const fileName = `${currentUser.id}/${Date.now()}-${safeName}`;
            const { data, error } = await supabase.storage
              .from('chat-attachments')
              .upload(fileName, att.file);

            if (error) {
              console.error('Upload error:', error);
              continue;
            }

            uploadedFiles.push({
              path: data.path,
              type: att.file.type,
              name: att.file.name,
              size: att.file.size,
            });
          }
        } finally {
          setUploading(false);
        }
      }

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('No session');
        // Restore content on error
        setContent(messageContent);
        setAttachments(messageAttachments);
        toast.error('Session expired. Please refresh.');
        setSending(false);
        return;
      }

      // Call edge function
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat-send-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            id: messageId, // Send generated UUID
            content: messageContent,
            courseId: courseTag?.id || null,
            parentId: parentId,
            attachments: uploadedFiles,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Send error:', errorData);
        // Restore content on error
        setContent(messageContent);
        setAttachments(messageAttachments);
        toast.error('Failed to send message');
        setSending(false);
        return;
      }

      // Success - input already cleared, let realtime handle the message display
      // onMessageSent(); // Removed as onSend handles optimistic update
    } catch (err) {
      console.error('Error sending message:', err);
      // Restore content on error
      setContent(messageContent);
      setAttachments(messageAttachments);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Handle KeyDown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionResults.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev > 0 ? prev - 1 : mentionResults.length - 1));
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev < mentionResults.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionResults[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        setMentionResults([]);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getCourseLabel = (course: Course) => 
    course.code || course.shortName || course.name;

  return (
    <div className="bg-white border-t border-gray-100 px-4 py-3">
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
          {attachments.map((att, i) => (
            <div key={i} className="relative flex-shrink-0">
              {att.preview ? (
                <img
                  src={att.preview}
                  alt={att.file.name}
                  className="h-20 w-20 object-cover rounded-xl border border-gray-200"
                />
              ) : (
                <div className="h-20 w-20 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center text-xs text-gray-500 px-2 text-center">
                  📎 {att.file.name.slice(0, 10)}...
                </div>
              )}
              <button
                onClick={() => removeAttachment(i)}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors"
              >
                <IoClose className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Course tag indicator */}
      {courseTag && (
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-sm font-semibold border border-green-100">
            <IoPricetag className="w-3.5 h-3.5" />
            {getCourseLabel(courseTag)}
            <button
              onClick={() => setCourseTag(null)}
              className="ml-0.5 hover:bg-green-100 rounded-full p-0.5 transition-colors"
            >
              <IoClose className="w-3.5 h-3.5" />
            </button>
          </span>
          <span className="text-xs text-gray-500">Only {getCourseLabel(courseTag)} students will see this</span>
        </div>
      )}

      <div className="flex items-end gap-3 relative">
        {/* File upload */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          disabled={uploading}
          aria-label="Attach file"
        >
          <IoAttach className="w-5 h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.heic,.heif"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Mention Popup */}
        {mentionResults.length > 0 && (
          <div ref={mentionDropdownRef} className="absolute bottom-full left-12 mb-2 w-64 bg-white rounded-xl shadow-xl border overflow-hidden z-30 animate-slide-up">
            <div className="px-3 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-600">
              Mention someone
            </div>
            {mentionResults.map((user, i) => (
              <button
                key={user.id}
                onClick={() => insertMention(user)}
                onMouseEnter={() => setMentionIndex(i)}
                className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-gray-50 transition-colors ${
                  i === mentionIndex ? 'bg-green-50 text-green-700' : 'text-gray-700'
                }`}
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-sm font-bold text-green-700">
                    {user.firstName?.[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.fullName}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Course tag selector */}
        <div ref={courseDropdownRef} className="relative">
          <button
            onClick={() => setShowCourseDropdown(!showCourseDropdown)}
            className={`p-2.5 transition-colors rounded-lg ${
              courseTag ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            aria-label="Tag a course"
          >
            <IoPricetag className="w-5 h-5" />
          </button>

          {showCourseDropdown && (
            <div className="absolute bottom-full left-0 mb-2 bg-white shadow-xl rounded-xl border py-1 min-w-[180px] max-h-64 overflow-y-auto z-20">
              <button
                onClick={() => {
                  setCourseTag(null);
                  setShowCourseDropdown(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                  !courseTag ? 'text-green-600 font-semibold' : 'text-gray-700'
                }`}
              >
                All (No tag)
              </button>
              {enrolledCourses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => {
                    setCourseTag(course);
                    setShowCourseDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors ${
                    courseTag?.id === course.id ? 'text-green-600 font-semibold' : 'text-gray-700'
                  }`}
                >
                  <IoPricetag className="w-3.5 h-3.5" />
                  {getCourseLabel(course)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onClick={(e) => setCursorPos(e.currentTarget.selectionStart)}
          onBlur={() => setTimeout(() => setMentionQuery(null), 200)}
          placeholder={parentId ? 'Post your reply...' : 'Share something with your university...'}
          rows={1}
          className="flex-1 resize-none px-3 py-2.5 text-base focus:outline-none bg-transparent placeholder-gray-400 leading-relaxed"
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={sending || uploading || (!content.trim() && attachments.length === 0)}
          className="p-3 bg-green-600 text-white rounded-full hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          aria-label="Send message"
        >
          {sending || uploading ? (
            <IoHourglass className="w-5 h-5 animate-spin" />
          ) : (
            <IoSend className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
