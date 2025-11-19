'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp?: Date;
}

interface MessageBubbleProps {
  message: Message;
  isLast?: boolean;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex w-full mb-4",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] p-4 rounded-2xl text-base shadow-sm",
          isUser
            ? "bg-primary text-white rounded-br-none"
            : "bg-gray-100 text-gray-800 rounded-bl-none"
        )}
      >
        {message.content}
        {message.timestamp && (
          <div className={cn(
            "text-xs mt-1 opacity-70",
            isUser ? "text-white/70" : "text-gray-500"
          )}>
            {message.timestamp.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
