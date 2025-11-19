# Venus AI Feedback System 🦉

> "The only platform that makes students smarter while improving attendance."

## Overview
Venus is an AI-powered mascot that engages students in reflective conversations after lectures. Instead of filling out boring surveys, students chat with Venus to discuss what they learned, reinforcing their memory and providing valuable insights to lecturers.

## Key Features
-   **Conversational Interface**: Chat with Venus, a friendly academic owl.
-   **Context-Aware**: Venus knows what lecture you just attended and asks relevant questions.
-   **Gamified**: Earn points, maintain streaks, and unlock achievements for reflecting.
-   **Pedagogical**: Built on principles of retrieval practice and spaced repetition.
-   **Quick Mode**: A 1-question option for students in a rush (5 pts).

## How It Works
1.  **Class Ends**: 15 minutes after a lecture, the student receives a notification.
2.  **Chat Starts**: Venus initiates a conversation: "Hey! What was the most interesting thing you learned in [Course] today?"
3.  **Reflection**: The student answers, and Venus asks follow-up questions to deepen understanding.
4.  **Reward**: The student earns points and keeps their streak alive.
5.  **Insights**: Lecturers receive aggregated, anonymized insights about student understanding and confusion.

## Architecture
-   **Frontend**: Next.js (Chat UI Component).
-   **AI Engine**: OpenAI GPT-4o-mini (via Supabase Edge Functions).
-   **Database**: Supabase (PostgreSQL) for storing sessions, messages, and analytics.

## Contributing
See `FEEDBACK_SYSTEM_IMPLEMENTATION_SUMMARY.md` for the detailed roadmap and implementation strategy.
