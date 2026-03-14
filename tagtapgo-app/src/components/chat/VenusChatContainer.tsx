'use client';

import { useEffect, useRef } from 'react';
import { IoArrowBack } from 'react-icons/io5';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ChatLayout from './ChatLayout';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import QuickReplyOptions from './QuickReplyOptions';
import TypingIndicator from './TypingIndicator';
import { useVenusChat } from '@/hooks/useVenusChat';

interface VenusChatContainerProps {
  sessionId: string;
  courseName: string;
  topic: string;
}

export default function VenusChatContainer({ sessionId, courseName, topic }: VenusChatContainerProps) {
  const router = useRouter();
  const { 
    messages, 
    isTyping, 
 
    error, 
    quickReplies, 
    sendMessage, 
    startChat
  } = useVenusChat(sessionId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startChat();
  }, [startChat]);

  // Auto-scroll to latest message
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    // Use requestAnimationFrame to ensure DOM has updated after render
    const rafId = requestAnimationFrame(() => {
      // Additional delay to account for message animations and markdown rendering
      timeoutId = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ 
          behavior: "smooth", 
          block: "end" 
        });
      }, 150);
    });
    
    return () => {
      cancelAnimationFrame(rafId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [messages, isTyping]);

  const handleBack = () => {
    router.back();
  };

  const handleQuickReply = (option: string) => {
    sendMessage(option);
  };

  const Header = (
    <div className="flex items-center gap-3 p-4">
      <button onClick={handleBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
        <IoArrowBack size={20} className="text-gray-600" />
      </button>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-xl">
          🦉
        </div>
        <div>
          <h1 className="font-semibold text-gray-900">Venus</h1>
          <p className="text-xs text-gray-500 truncate max-w-[200px]">{courseName}: {topic}</p>
        </div>
      </div>
      <div className="ml-auto">
      </div>
    </div>
  );

  return (
    <ChatLayout
      header={Header}
      input={
        <div>
          <QuickReplyOptions options={quickReplies} onSelect={handleQuickReply} />
          <ChatInput 
            onSend={sendMessage} 
            disabled={isTyping} 
          />
        </div>
      }
    >
      <div className="py-4">
        {/* Error Message */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-red-50 text-red-600 text-sm rounded-lg mb-4 border border-red-200"
          >
            {error}
          </motion.div>
        )}

        {/* Messages */}
        <AnimatePresence initial={false}>
          {messages.map((msg, index) => (
            <MessageBubble 
              key={msg.id} 
              message={msg} 
              isLast={index === messages.length - 1} 
            />
          ))}
        </AnimatePresence>
        
        {/* Typing Indicator */}
        {isTyping && <TypingIndicator />}
        
        <div ref={messagesEndRef} />
      </div>
    </ChatLayout>
  );
}
