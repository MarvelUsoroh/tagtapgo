-- Migration: Delete today's Venus conversation for student 42e816fa-6473-4209-9ca7-dc1c2e3da1b6

-- Delete the feedback conversation
DELETE FROM feedback_conversations
WHERE student_id = '42e816fa-6473-4209-9ca7-dc1c2e3da1b6'
AND created_at >= '2025-12-05'::date;
