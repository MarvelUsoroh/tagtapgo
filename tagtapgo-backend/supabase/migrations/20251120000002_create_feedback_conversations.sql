-- Migration: Create Feedback Conversations Tables
-- Description: Creates tables for storing Venus AI chat history and updates points constraint.

-- 1. Create feedback_conversations table
CREATE TABLE IF NOT EXISTS public.feedback_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_schedule_id UUID NOT NULL REFERENCES public.class_schedules(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    sentiment_score FLOAT, -- AI analyzed sentiment (-1.0 to 1.0)
    summary TEXT, -- AI generated summary of student's reflection
    points_awarded INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create feedback_messages table
CREATE TABLE IF NOT EXISTS public.feedback_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.feedback_conversations(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'ai')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_feedback_conversations_student_id ON public.feedback_conversations(student_id);
CREATE INDEX IF NOT EXISTS idx_feedback_conversations_class_schedule_id ON public.feedback_conversations(class_schedule_id);
CREATE INDEX IF NOT EXISTS idx_feedback_messages_conversation_id ON public.feedback_messages(conversation_id);

-- 4. Enable RLS
ALTER TABLE public.feedback_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_messages ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Students can view their own conversations
CREATE POLICY "Students can view own conversations" ON public.feedback_conversations
    FOR SELECT USING (auth.uid() = student_id);

-- Students can insert their own conversations (for starting a chat)
CREATE POLICY "Students can insert own conversations" ON public.feedback_conversations
    FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Students can update their own conversations (for completion status)
CREATE POLICY "Students can update own conversations" ON public.feedback_conversations
    FOR UPDATE USING (auth.uid() = student_id);

-- Students can view messages in their conversations
CREATE POLICY "Students can view own messages" ON public.feedback_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.feedback_conversations 
            WHERE id = feedback_messages.conversation_id 
            AND student_id = auth.uid()
        )
    );

-- Students can insert messages (user replies)
CREATE POLICY "Students can insert own messages" ON public.feedback_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.feedback_conversations 
            WHERE id = feedback_messages.conversation_id 
            AND student_id = auth.uid()
        )
    );

-- 6. Update points table constraint to allow 'feedback_reward'
-- Note: We have to drop and recreate the constraint to modify it
ALTER TABLE public.points DROP CONSTRAINT IF EXISTS points_transaction_type_check;
ALTER TABLE public.points ADD CONSTRAINT points_transaction_type_check 
    CHECK (transaction_type IN (
        'attendance', 'achievement', 'bonus', 'early_arrival', 
        'perfect_week', 'perfect_month', 'streak', 'challenge', 
        'referral', 'redemption', 'adjustment', 'feedback', 'feedback_reward'
    ));

-- 7. Triggers for updated_at
CREATE TRIGGER update_feedback_conversations_updated_at
    BEFORE UPDATE ON public.feedback_conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
