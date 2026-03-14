'use client';

import { useState, useRef, useEffect } from 'react';
import { IoSend } from 'react-icons/io5';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, disabled, placeholder = "Type your thought..." }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (value.trim() && !disabled) {
      onSend(value.trim());
      setValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  // Auto-focus when not disabled (e.g., after Venus responds)
  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  return (
    <div className="px-4 py-2">
      <div className="relative flex items-end gap-2 p-2 bg-gray-50 rounded-xl border border-gray-200 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand transition-all">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full bg-transparent border-none focus:ring-0 resize-none py-3 px-2 max-h-32 text-base disabled:opacity-50 outline-none"
        />
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleSubmit}
          disabled={!value.trim() || disabled}
          className={cn(
            "p-3 rounded-lg mb-1 transition-colors flex-shrink-0",
            value.trim() && !disabled
              ? "bg-brand text-white shadow-sm"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          )}
        >
          <IoSend size={20} />
        </motion.button>
      </div>
    </div>
  );
}
