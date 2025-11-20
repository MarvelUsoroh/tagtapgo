import { useState, useCallback, useEffect } from 'react';
import { Message } from '@/components/chat/MessageBubble';
import { supabase } from '@/lib/supabase';

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

export function useVenusChat(promptId: string, classScheduleId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [status, setStatus] = useState<'idle' | 'thinking' | 'completed'>('idle');
  const [turn, setTurn] = useState(0);
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
          turn: savedTurn, 
          status: savedStatus,
          conversationId: savedConvId
        } = JSON.parse(saved);
        
        // Add timestamps if missing
        const messagesWithTimestamps = savedMessages.map((msg: Message) => ({
          ...msg,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
        }));
        
        setMessages(messagesWithTimestamps);
        setTurn(savedTurn);
        setStatus(savedStatus);
        if (savedConvId) setConversationId(savedConvId);
        
        // Set appropriate quick replies
        const turnKeys = ['recall', 'elaboration', 'gap', 'closing'] as const;
        setQuickReplies(QUICK_REPLIES[turnKeys[savedTurn]] || []);
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
          turn, 
          status,
          conversationId
        }));
      } catch (err) {
        console.error('Failed to save chat:', err);
      }
    }
  }, [messages, turn, status, conversationId, promptId]);

  // Create conversation in DB if not exists
  const ensureConversation = async () => {
    if (conversationId) return conversationId;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Check if one exists for this prompt (metadata check) or just create new
      // For MVP, we'll create a new one and link it to the prompt via metadata
      const { data, error } = await supabase
        .from('feedback_conversations')
        .insert({
          student_id: user.id,
          class_schedule_id: classScheduleId,
          metadata: { prompt_id: promptId }
        })
        .select('id')
        .single();

      if (error) throw error;
      
      setConversationId(data.id);
      return data.id;
    } catch (err) {
      console.error('Failed to create conversation:', err);
      setError('Failed to start conversation. Please try again.');
      return null;
    }
  };

  // Award points API call
  const awardPoints = async (convId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/award-feedback-points`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            conversation_id: convId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to award points');
      }

      const data = await response.json();
      
      // Trigger confetti if points were awarded
      if (data.success) {
        triggerConfetti();
      }
    } catch (error) {
      console.error('Error awarding points:', error);
      // Don't show error to user, just log it. The chat is already done.
    }
  };

  // Initialize chat
  const startChat = useCallback(async () => {
    if (messages.length > 0) return;
    
    // Create conversation record
    await ensureConversation();
    
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
  }, [messages.length]); // Removed ensureConversation from deps to avoid loop, it's stable enough or we can use ref

  const sendMessage = async (content: string) => {
    try {
      setError(null);
      
      // Ensure conversation ID exists (retry if failed at start)
      let currentConvId = conversationId;
      if (!currentConvId) {
        currentConvId = await ensureConversation();
        if (!currentConvId) return; // Stop if still fails
      }

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
            if (currentConvId) {
              await awardPoints(currentConvId);
            }
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
