'use client';
/* eslint-disable @next/next/no-img-element */

/**
 * ChatInput Component
 * Enhanced input with #course-tag autocomplete and file upload
 */

import { useState, useRef, useEffect } from 'react';
import { Send, Hash, Paperclip, X, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';

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
  onMessageSent: () => void;
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
  onMessageSent,
}: ChatInputProps) {
  const [content, setContent] = useState('');
  const [courseTag, setCourseTag] = useState<Course | null>(selectedCourse);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
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
      const { data } = await supabase
        .from('students')
        .select('*')
        .eq('university_id', currentUser.universityId)
        .ilike('full_name', `%${mentionQuery}%`)
        .neq('id', currentUser.id)
        .limit(5);
      
      setMentionResults(data || []);
      setMentionIndex(0);
    }, 300);

    return () => clearTimeout(timer);
  }, [mentionQuery, currentUser.universityId, currentUser.id, supabase]);

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
    const newTextBefore = textBeforeCursor.slice(0, -popLength) + `@${user.fullName} `;
    
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
      if (file.type.startsWith('image/')) {
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

  // Upload files to storage
  const uploadAttachments = async (): Promise<{ url: string; type: string; name: string; size: number }[]> => {
    if (attachments.length === 0) return [];

    setUploading(true);
    const uploaded: { url: string; type: string; name: string; size: number }[] = [];

    try {
      for (const att of attachments) {
        const fileName = `${currentUser.id}/${Date.now()}-${att.file.name}`;
        const { data, error } = await supabase.storage
          .from('chat-attachments')
          .upload(fileName, att.file);

        if (error) {
          console.error('Upload error:', error);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(data.path);

        uploaded.push({
          url: urlData.publicUrl,
          type: att.file.type,
          name: att.file.name,
          size: att.file.size,
        });
      }
    } finally {
      setUploading(false);
    }

    return uploaded;
  };

  // Send message
  const handleSend = async () => {
    if (!content.trim() && attachments.length === 0) return;
    if (sending) return;

    setSending(true);
    try {
      // Upload attachments first
      const uploadedFiles = await uploadAttachments();

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('No session');
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
            content: content.trim(),
            courseId: courseTag?.id || null,
            parentId: parentId,
            attachments: uploadedFiles,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Send error:', errorData);
        toast.error('Failed to send message');
        return;
      }

      // Clear input
      setContent('');
      setAttachments([]);
      if (!parentId) setCourseTag(null);
      onMessageSent();
    } catch (err) {
      console.error('Error sending message:', err);
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
    <div className="bg-white border-t px-4 py-3 safe-area-bottom">
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
          {attachments.map((att, i) => (
            <div key={i} className="relative flex-shrink-0">
              {att.preview ? (
                <img
                  src={att.preview}
                  alt={att.file.name}
                  className="h-16 w-16 object-cover rounded-lg border"
                />
              ) : (
                <div className="h-16 w-16 rounded-lg border bg-gray-100 flex items-center justify-center text-xs text-gray-500 px-1 text-center">
                  📎 {att.file.name.slice(0, 10)}...
                </div>
              )}
              <button
                onClick={() => removeAttachment(i)}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Course tag indicator */}
      {courseTag && (
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
            <Hash className="w-3 h-3" />
            {getCourseLabel(courseTag)}
            <button
              onClick={() => setCourseTag(null)}
              className="ml-1 hover:bg-green-200 rounded-full p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
          <span className="text-xs text-gray-500">Only {getCourseLabel(courseTag)} students will see this</span>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* File upload */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          disabled={uploading}
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Mention Popup */}
        {mentionResults.length > 0 && (
          <div className="absolute bottom-full left-10 mb-2 w-64 bg-white rounded-lg shadow-xl border overflow-hidden z-30 animate-slide-up">
            <div className="px-3 py-2 bg-gray-50 border-b text-xs font-medium text-gray-500">
              Mentioning...
            </div>
            {mentionResults.map((user, i) => (
              <button
                key={user.id}
                onClick={() => insertMention(user)}
                onMouseEnter={() => setMentionIndex(i)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-50 ${
                  i === mentionIndex ? 'bg-green-50 text-green-700' : 'text-gray-700'
                }`}
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">
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
        <div className="relative">
          <button
            onClick={() => setShowCourseDropdown(!showCourseDropdown)}
            className={`p-2 transition-colors rounded-lg ${
              courseTag ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Hash className="w-5 h-5" />
          </button>

          {showCourseDropdown && (
            <div className="absolute bottom-full left-0 mb-2 bg-white shadow-lg rounded-lg border py-1 min-w-[160px] max-h-48 overflow-y-auto z-20">
              <button
                onClick={() => {
                  setCourseTag(null);
                  setShowCourseDropdown(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                  !courseTag ? 'text-green-600 font-medium' : 'text-gray-700'
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
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                    courseTag?.id === course.id ? 'text-green-600 font-medium' : 'text-gray-700'
                  }`}
                >
                  <Hash className="w-3 h-3" />
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
          placeholder={parentId ? 'Reply to thread...' : 'Message MyView...'}
          rows={1}
          className="flex-1 resize-none border rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={sending || uploading || (!content.trim() && attachments.length === 0)}
          className="p-2.5 bg-green-600 text-white rounded-full hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending || uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
