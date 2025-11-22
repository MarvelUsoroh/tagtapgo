import { useState, useCallback, useEffect } from 'react';
import { Message } from '@/components/chat/MessageBubble';
import { supabase } from '@/lib/supabase';

// Lazy load confetti
const triggerConfetti = async () => {
  try {
    const confetti = (await import('canvas-confetti')).default;
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  } catch (err) {
    console.error('Failed to load confetti:', err);
  }
};

export function useVenusChat(promptId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [status, setStatus] = useState<'idle' | 'thinking' | 'completed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`venus-chat-${promptId}`);
      if (saved) {
        const { 
          messages: savedMessages, 
          status: savedStatus,
          conversationId: savedConvId
        } = JSON.parse(saved);
        
        // Add timestamps if missing
        const messagesWithTimestamps = savedMessages.map((msg: Message) => ({
          ...msg,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
        }));
        
        setMessages(messagesWithTimestamps);
        setStatus(savedStatus);
        if (savedConvId) setConversationId(savedConvId);
      }
    } catch (err) {
      console.error('Failed to load saved chat:', err);
    }
  }, [promptId]);

  // Save to localStorage when state changes
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(`venus-chat-${promptId}`, JSON.stringify({ 
          messages, 
          status,
          conversationId
        }));
      } catch (err) {
        console.error('Failed to save chat:', err);
      }
    }
  }, [messages, status, conversationId, promptId]);

  // Note: Points are now awarded via achievement system, not directly per chat

  // Initialize chat
  const startChat = useCallback(async () => {
    if (messages.length > 0) return;
    
    setIsTyping(true);
    setStatus('thinking');
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat-with-venus`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'start',
            promptId: promptId
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to start chat');

      const data = await response.json();
      setConversationId(data.conversationId);
      
      setMessages([{ 
        id: 'init', 
        role: 'ai', 
        content: data.message,
        timestamp: new Date()
      }]);
      
      // Use quick replies from backend if available, otherwise default
      if (data.quickReplies && Array.isArray(data.quickReplies)) {
        setQuickReplies(data.quickReplies);
      } else {
        setQuickReplies(["It was interesting!", "I'm confused about...", "We learned about..."]);
      }

    } catch (err) {
      console.error('Start chat error:', err);
      setError('Could not connect to Venus. Please try again.');
    } finally {
      setIsTyping(false);
      setStatus('idle');
    }
  }, [messages.length, promptId]);

  const sendMessage = async (content: string) => {
    try {
      setError(null);
      
      if (!conversationId) {
        setError("Conversation not started");
        return;
      }

      // 1. User Message
      const userMsg: Message = { 
        id: Date.now().toString(), 
        role: 'user', 
        content,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMsg]);
      setQuickReplies([]); // Clear quick replies
      
      // 2. AI Response
      setIsTyping(true);
      setStatus('thinking');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat-with-venus`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'message',
            conversationId: conversationId,
            message: content
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();
      
      const aiMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'ai', 
        content: data.message,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);

      // Update quick replies from backend (trust the backend completely)
      if (data.quickReplies && Array.isArray(data.quickReplies)) {
        setQuickReplies(data.quickReplies);
      } else {
        // Backend sends empty array or undefined when no quick replies needed (e.g., TUTOR mode)
        setQuickReplies([]);
      }

      // Check if conversation is complete (backend sends isComplete flag)
      if (data.isComplete) {
        setStatus('completed');
        // Note: Points are now awarded via achievements, not directly
        setTimeout(() => triggerConfetti(), 500);
      } else {
        setStatus('idle');
      }

    } catch (err) {
      console.error('Send message error:', err);
      setError('Oops! Venus had a hiccup. Try again?');
      setStatus('idle');
    } finally {
      setIsTyping(false);
    }
  };

  const endSession = async () => {
    if (conversationId && status !== 'completed') {
      setStatus('completed');
      // Confetti for completion (achievements handled by gamification engine)
      setTimeout(() => triggerConfetti(), 500);
    }
  };

  return { 
    messages, 
    isTyping, 
    status, 
    error, 
    quickReplies, 
    sendMessage, 
    startChat,
    endSession
  };
}
