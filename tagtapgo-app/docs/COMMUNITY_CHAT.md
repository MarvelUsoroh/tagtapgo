# Community Chat Feature Documentation

University-scoped real-time chat with #course-tag targeting and threaded discussions.

## Overview

Community Chat is a feature that allows students within the same university to communicate in real-time. Messages can be targeted to specific courses using `#course-tags`, ensuring only enrolled students see relevant discussions.

## Features Implemented

### Core Functionality
- **Real-time messaging** via Supabase Realtime subscriptions
- **Course-targeted messages** using `#course-tags` for visibility filtering
- **Threaded replies** for organized conversations
- **Emoji reactions** with click-outside dismissal
- **File attachments** (images, PDFs) up to 10MB with **signed URLs** for security
- **Author avatars** with initials fallback
- **Infinite Scroll** for seamless message history access
- **Toast Notifications** for clear user feedback
- **@Mention Autocomplete** for easy tagging

### Security
- **Private storage bucket** - Attachments stored in private Supabase Storage bucket
- **Signed URLs** - 1-hour expiry tokens for attachment access
- **University-scoped visibility** - Students only see messages from their university
- **Course-based filtering** - Messages tagged with a course are only visible to enrolled students
- **RLS policies** on `chat_messages`, `chat_reactions`, and `students` tables

### UI/UX
- Consistent green color scheme (`bg-green-100 text-green-900`)
- Slide-in thread panel with click-outside to close
- Safe-area padding for mobile devices (notch support)
- Keyboard-aware input positioning for mobile

---

## Technical Architecture

### Database Schema

```sql
-- Core tables
chat_messages (id, university_id, author_id, parent_id, course_id, content, attachments, created_at, deleted_at)
chat_reactions (id, message_id, user_id, emoji, created_at)
chat_read_receipts (id, message_id, user_id, read_at)
chat_mentions (id, message_id, mentioned_user_id, created_at)

-- Attachments format (JSONB array)
attachments: [{ path, type, name, size }]
```

### RLS Policies

| Table | Policy | Description |
|-------|--------|-------------|
| `students` | `Students can view same university students` | Uses `get_my_university_id()` security definer function |
| `universities` | `Students can view their university` | Uses `get_my_university_id()` function |
| `chat_messages` | University + course enrollment checks | Complex policy for visibility |

---

## Component Structure

```
src/
├── app/community/
│   └── page.tsx          # Server component - fetches user data, courses
├── components/
│   ├── CommunityChat.tsx # Main chat component (realtime subscription, UI)
│   ├── MessageItem.tsx   # Individual message display (reactions, signed URLs)
│   └── ChatInput.tsx     # Message composition (course tags, attachments)
```

---

## Edge Functions

### `chat-send-message`

Handles message creation with:
- Content validation
- `#course-tag` parsing 
- `@mention` extraction
- Attachment path processing
- University ID injection from JWT

**Endpoint:** `POST /functions/v1/chat-send-message`

**Payload:**
```json
{
  "content": "Hello #CS101 students!",
  "courseId": "uuid-or-null",
  "parentId": "uuid-or-null",
  "attachments": [{ "path": "userId/file.png", "type": "image/png", "name": "file.png", "size": 1024 }]
}
```

---

## Storage

**Bucket:** `chat-attachments` (Private)
- Max file size: 10MB
- Allowed types: images, PDFs
- Path format: `{user_id}/{timestamp}-{filename}`
- Access: Via signed URLs (1-hour expiry)

---

## Future Enhancements

- [ ] Push notifications with class-aware delay
- [ ] Full-text search
- [ ] Gamification triggers (XP for participation)
- [ ] Read receipts UI
- [x] @mention autocomplete and highlighting
- [x] Toast notification system
- [x] Pagination / Infinite Scroll
- [x] Secure file attachments with signed URLs
