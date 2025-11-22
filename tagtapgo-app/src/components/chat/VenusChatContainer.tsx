'use client';

import { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
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
    status, 
    error, 
    quickReplies, 
    sendMessage, 
    startChat,
    endSession
  } = useVenusChat(sessionId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startChat();
  }, [startChat]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
        <ArrowLeft size={20} className="text-gray-600" />
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
        {status !== 'completed' && (
          <button 
            onClick={endSession}
            className="text-xs font-medium text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-full hover:bg-red-50 transition-colors"
          >
            End Session
          </button>
        )}
      </div>
    </div>
  );

  return (
    <ChatLayout
      header={Header}
      input={
        status === 'completed' ? (
          <div className="p-4 flex flex-col gap-3 bg-white border-t border-gray-100">
            <div className="text-center bg-green-50 text-green-700 font-medium p-3 rounded-lg border border-green-100">
              Conversation Complete! 🎉
            </div>
            <button 
              onClick={() => router.push('/')}
              className="w-full py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors shadow-sm"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <div>
            <QuickReplyOptions options={quickReplies} onSelect={handleQuickReply} />
            <ChatInput 
              onSend={sendMessage} 
              disabled={isTyping} 
            />
          </div>
        )
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
