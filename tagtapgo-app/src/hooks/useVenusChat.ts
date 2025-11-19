import { useState, useCallback, useEffect } from 'react';
import { Message } from '@/components/chat/MessageBubble';

// Mock Templates for Manual MVP
const TEMPLATES = {
  recall: [
    "Hey! Just finished class? 🎓 What was the most interesting thing you learned today?",
    "I missed the lecture! 🙈 What was the main topic you covered?",
    "Quick check-in! What's the one thing from today's class that stuck with you?"
  ],
  elaboration: [
    "That's cool! So if you had to explain that to a 5-year-old, what would you say?",
    "Interesting! How do you think that applies to real life? 🌍",
    "Nice! If you were writing a tweet about that, what would it say? 🐦"
  ],
  gap: [
    "Awesome insight! 🌟 One last thing - was anything a bit fuzzy or confusing?",
    "Got it! Any parts that you'd like to explore more?",
    "Makes sense! Anything you'd want the lecturer to clarify next time?"
  ],
  closing: [
    "Thanks for sharing! You've earned 15 points. See you next time! 🚀",
    "Great reflection! +15 points for you. Keep it up! 🔥",
    "Love it! You're on fire. 15 points added to your balance! 💎"
  ]
};

const QUICK_REPLIES = {
  recall: ["It was about...", "The main concept was...", "We learned..."],
  elaboration: ["In real life...", "For example...", "It could be used..."],
  gap: ["Yes, I'm confused about...", "No, it was clear!", "Maybe..."],
  closing: []
};

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

export function useVenusChat(sessionId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [status, setStatus] = useState<'idle' | 'thinking' | 'completed'>('idle');
  const [turn, setTurn] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`venus-chat-${sessionId}`);
      if (saved) {
        const { 
          messages: savedMessages, 
          turn: savedTurn, 
          status: savedStatus 
        } = JSON.parse(saved);
        // Add timestamps if missing
        const messagesWithTimestamps = savedMessages.map((msg: Message) => ({
          ...msg,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
        }));
        setMessages(messagesWithTimestamps);
        setTurn(savedTurn);
        setStatus(savedStatus);
        // Set appropriate quick replies
        const turnKeys = ['recall', 'elaboration', 'gap', 'closing'] as const;
        setQuickReplies(QUICK_REPLIES[turnKeys[savedTurn]] || []);
      }
    } catch (err) {
      console.error('Failed to load saved chat:', err);
    }
  }, [sessionId]);

  // Save to localStorage when state changes
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(`venus-chat-${sessionId}`, JSON.stringify({ 
          messages, 
          turn, 
          status 
        }));
      } catch (err) {
        console.error('Failed to save chat:', err);
      }
    }
  }, [messages, turn, status, sessionId]);

  // Award points API call
  const awardPoints = async (points: number) => {
    try {
      const response = await fetch('/api/feedback/award-points', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}` // Adjust based on your auth
        },
        body: JSON.stringify({ sessionId, points })
      });

      if (!response.ok) {
        throw new Error('Failed to award points');
      }

      const result = await response.json();
      console.log('Points awarded:', result);
    } catch (err) {
      console.error('Failed to award points:', err);
      // Don't show error to user for points - it's not critical
    }
  };

  // Initialize chat
  const startChat = useCallback(() => {
    if (messages.length > 0) return;
    
    const randomStart = TEMPLATES.recall[Math.floor(Math.random() * TEMPLATES.recall.length)];
    setIsTyping(true);
    setStatus('thinking');
    setQuickReplies(QUICK_REPLIES.recall);
    
    setTimeout(() => {
      setMessages([{ 
        id: 'init', 
        role: 'ai', 
        content: randomStart,
        timestamp: new Date()
      }]);
      setIsTyping(false);
      setStatus('idle');
    }, 1000);
  }, [messages.length]);

  const sendMessage = async (content: string) => {
    try {
      setError(null);
      
      // 1. User Message
      const userMsg: Message = { 
        id: Date.now().toString(), 
        role: 'user', 
        content,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMsg]);
      
      // Clear quick replies
      setQuickReplies([]);
      
      // 2. AI Response (Mock)
      setIsTyping(true);
      setStatus('thinking');
      
      // Simulate network delay
      setTimeout(async () => {
        try {
          let nextContent = "";
          let nextStatus: 'idle' | 'completed' = 'idle';
          let nextQuickReplies: string[] = [];
          
          if (turn === 0) {
            // Move to Elaboration
            nextContent = TEMPLATES.elaboration[Math.floor(Math.random() * TEMPLATES.elaboration.length)];
            nextQuickReplies = QUICK_REPLIES.elaboration;
            setTurn(1);
          } else if (turn === 1) {
            // Move to Gap
            nextContent = TEMPLATES.gap[Math.floor(Math.random() * TEMPLATES.gap.length)];
            nextQuickReplies = QUICK_REPLIES.gap;
            setTurn(2);
          } else {
            // Closing
            nextContent = TEMPLATES.closing[Math.floor(Math.random() * TEMPLATES.closing.length)];
            nextStatus = 'completed';
            nextQuickReplies = [];
            
            // Award points and trigger confetti
            await awardPoints(15);
            setTimeout(() => triggerConfetti(), 500);
          }

          const aiMsg: Message = { 
            id: (Date.now() + 1).toString(), 
            role: 'ai', 
            content: nextContent,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, aiMsg]);
          setQuickReplies(nextQuickReplies);
          setIsTyping(false);
          setStatus(nextStatus);
        } catch {
          setError('Oops! Venus had a hiccup. Try again?');
          setIsTyping(false);
          setStatus('idle');
        }
      }, 1500);
    } catch {
      setError('Oops! Venus had a hiccup. Try again?');
      setIsTyping(false);
      setStatus('idle');
    }
  };

  return { 
    messages, 
    isTyping, 
    status, 
    error, 
    quickReplies, 
    sendMessage, 
    startChat 
  };
}
