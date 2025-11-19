# Venus Chat Interface - Technical UI Specification

## 1. Design Philosophy
To achieve "simplicity with great UI/UX" while ensuring maintainability, we will adopt a **Compound Component** pattern with a custom hook for logic separation. This aligns with the `copilot-instructions.md` directive to separate concerns (Server vs Client) and use centralized theming.

## 2. Component Architecture

### 2.1 Container Component (`VenusChatContainer`)
-   **Role**: Smart Component (Logic & Data).
-   **Responsibilities**:
    -   Fetches initial conversation state (Server Component or Client Wrapper).
    -   Initializes the `useVenusChat` hook.
    -   Handles the "End of Conversation" logic (awarding points, redirecting).
-   **Props**: `sessionId`, `studentId`, `initialContext`.

### 2.2 Presentational Components (Dumb)
We will break the UI into small, reusable atoms located in `src/components/chat/`.

1.  **`ChatLayout`**:
    -   Wrapper with `flex-col`, `h-screen` (or `h-[calc(100dvh-nav)]`).
    -   Handles the sticky header and background.
2.  **`MessageList`**:
    -   Scrollable area with `flex-1`, `overflow-y-auto`.
    -   Uses `AnimatePresence` (Framer Motion) for message entry animations.
3.  **`MessageBubble`**:
    -   Props: `message` (content, sender), `isLast`.
    -   **Styling**:
        -   **User**: `bg-primary text-white rounded-br-none`.
        -   **Venus**: `bg-gray-100 text-gray-800 rounded-bl-none`.
    -   **Animation**: Slide up + Fade in (`initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}`).
4.  **`TypingIndicator`**:
    -   3 pulsing dots using `motion.div` with staggered delay.
    -   Visual: "Venus is thinking..."
5.  **`QuickReplyOptions`**:
    -   Horizontal scrollable list of chips.
    -   Props: `options[]`, `onSelect`.
    -   Style: `border border-primary text-primary hover:bg-primary-light`.
6.  **`ChatInput`**:
    -   Textarea with auto-resize.
    -   Send button (disabled when empty/sending).

7.  **`ErrorState`**:
    -   Visual: "Venus lost connection..." with Retry button.
    -   Props: `onRetry`, `message`.

## 3. State Management: `useVenusChat` Hook

Encapsulate all logic in `src/hooks/useVenusChat.ts`.

```typescript
export function useVenusChat(sessionId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [status, setStatus] = useState<'idle' | 'thinking' | 'streaming' | 'completed' | 'error'>('idle');

  const sendMessage = async (content: string) => {
    // 1. Optimistic Update
    const tempId = Date.now().toString();
    setMessages(prev => [...prev, { id: tempId, role: 'user', content }]);
    
    // 2. Set Loading
    setIsTyping(true);
    setStatus('thinking');

    try {
      // 3. API Call (Streaming Support)
      // Implement Server-Sent Events (SSE) or readable stream here
      // for real-time typing effect.
      const response = await api.post('/chat/venus', { content, sessionId, stream: true });
      
      // 4. Update with AI response (accumulate stream)
      // ... streaming logic ...
      
      if (response.isComplete) {
        setStatus('completed');
        triggerConfetti(); // Reusing canvas-confetti
      }
    } catch (error) {
      setStatus('error');
    } finally {
      setIsTyping(false);
    }
  };

  return { messages, isTyping, status, sendMessage };
}
```

## 4. Styling & Theming Strategy

We will strictly use `src/lib/theme.ts` tokens to ensure consistency.

-   **Colors**:
    -   User Bubble: `colors.primary.DEFAULT` (#4ADE80).
    -   Venus Bubble: `colors.gray[100]` (#F3F4F6).
    -   Text: `colors.gray[800]` (#1F2937).
-   **Typography**:
    -   Messages: `text-base` (16px) for readability.
    -   Metadata: `text-xs text-gray-500`.
-   **Spacing**:
    -   `p-4` for bubbles.
    -   `gap-3` between messages.

## 5. UX Optimizations

1.  **Auto-Scroll**: Use a `ref` on the message list end to auto-scroll when new messages arrive.
2.  **Safe Area**: Ensure input bar respects iOS home indicator (`pb-safe`).
3.  **Keyboard Handling**: Prevent layout shifts on mobile keyboard open (use `dvh` units).
4.  **Micro-interactions**:
    -   Button press scale effect (`whileTap={{ scale: 0.95 }}`).
    -   Smooth transition for the "Send" icon.

## 6. Reusability Check
-   **Is it reusable?** Yes. The `MessageList` and `ChatInput` are generic. By swapping the `useVenusChat` hook with a `useSupportChat` hook, the UI can be reused for a help desk feature.
-   **Is it simple?** Yes. No complex menus, just chat.
-   **Is it maintainable?** Yes. Logic is isolated in the hook; UI is broken into atomic components.
