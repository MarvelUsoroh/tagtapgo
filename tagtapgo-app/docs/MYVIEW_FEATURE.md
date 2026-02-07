# MyView Feature Documentation

University-scoped real-time chat with #course-tag targeting and threaded discussions.

## Overview

MyView is a community chat feature that allows students within the same university to communicate in real-time. Messages can be targeted to specific courses using `#course-tags`, ensuring only enrolled students see relevant discussions.

## Features Implemented

### Core Functionality
- **Real-time messaging** via Supabase Realtime subscriptions
- **Course-targeted messages** using `#course-tags` for visibility filtering
- **Threaded replies** for organized conversations
- **Emoji reactions** with click-outside dismissal
- **File attachments** (images, PDFs) up to 10MB
- **Author avatars** with initials fallback
- **Infinite Scroll** for seamless message history access
- **Toast Notifications** for clear user feedback
- **@Mention Autocomplete** for easy tagging

### Access Control
- **University-scoped visibility** - Students only see messages from their university
- **Course-based filtering** - Messages tagged with a course are only visible to enrolled students
- **RLS policies** on `chat_messages`, `chat_reactions`, and `students` tables

### UI/UX
- Consistent green color scheme matching Venus chat (`bg-green-100 text-green-900`)
- Slide-in thread panel with click-outside to close
- Safe-area padding for mobile devices (notch support)
- Smooth slide-in animations for panels

---

## Technical Architecture

### Database Schema

```sql
-- Core tables
chat_messages (id, university_id, author_id, parent_id, course_id, content, attachments, created_at, deleted_at)
chat_reactions (id, message_id, user_id, emoji, created_at)
chat_read_receipts (id, message_id, user_id, read_at)
chat_mentions (id, message_id, mentioned_user_id, created_at)
```

### RLS Policies

| Table | Policy | Description |
|-------|--------|-------------|
| `students` | `Students can view same university students` | Uses `get_my_university_id()` security definer function |
| `universities` | `Students can view their university` | Uses `get_my_university_id()` function |
| `chat_messages` | University + course enrollment checks | Complex policy for visibility |

### Security Definer Function

```sql
-- Prevents RLS infinite recursion when querying students table
CREATE FUNCTION public.get_my_university_id() RETURNS UUID
LANGUAGE SQL SECURITY DEFINER STABLE
AS $$ SELECT university_id FROM public.students WHERE id = auth.uid(); $$;
```

---

## Component Structure

```
src/
├── app/myview/
│   └── page.tsx          # Server component - fetches user data, courses
├── components/
│   ├── CommunityChat.tsx # Main chat component (realtime subscription, UI)
│   ├── MessageItem.tsx   # Individual message display (reactions, threading)
│   └── ChatInput.tsx     # Message composition (course tags, attachments)
```

### Key Props Flow

```
MyViewPage (Server)
  └─ CommunityChat
       ├─ currentUser: { id, universityId, firstName, lastName, fullName, avatarUrl }
       ├─ universityName: string
       ├─ universityAbbrev: string (e.g., "DU" for "Demo University")
       └─ enrolledCourses: Course[]
```

---

## Edge Functions

### `chat-send-message`

Handles message creation with:
- Content validation
- `#course-tag` parsing 
- `@mention` extraction
- Attachment processing
- University ID injection from JWT

**Endpoint:** `POST /functions/v1/chat-send-message`

**Payload:**
```json
{
  "content": "Hello #CS101 students!",
  "courseId": "uuid-or-null",
  "parentId": "uuid-or-null",
  "attachments": [{ "url": "...", "type": "image/png", "name": "file.png", "size": 1024 }]
}
```

---

## Realtime Subscription

```typescript
supabase
  .channel('myview-chat')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'chat_messages',
    filter: `university_id=eq.${universityId}`,
  }, handleNewMessage)
  .subscribe();
```

---

## Storage

**Bucket:** `chat-attachments`
- Max file size: 10MB
- Allowed types: images, PDFs
- Path format: `{user_id}/{timestamp}-{filename}`

---

## CSS Utilities Added

```css
/* Safe area padding for mobile */
.pb-safe {
  padding-bottom: max(1rem, env(safe-area-inset-bottom, 1rem));
}

/* Thread panel animation */
.animate-slide-in-right {
  animation: slideInRight 0.25s ease-out;
}
```

---

## Future Enhancements

- [ ] Push notifications with class-aware delay
- [ ] Full-text search
- [ ] Gamification triggers (XP for participation)
- [ ] Read receipts UI
- [x] @mention autocomplete and highlighting
- [x] Toast notification system
- [x] Pagination / Infinite Scroll

---

## MVP Readiness Assessment

### Current Status: **Ready for Alpha / Internal Pilot**

The feature is functional and stable for a small-scale pilot. Core flows (sending, replying, tagging) work as expected.

### Resolved Gaps (MVP Polish Phase)
1.  **Pagination**: Implemented infinite scroll to access full history.
2.  **Error Feedback**: Replaced alerts with a robust Toast system.
3.  **Mention Usability**: Added autocomplete popup for `@mentions`.

### Upcoming Improvements Board

| Priority | Feature | Impact | Effort |
|----------|---------|--------|--------|
| 🔴 High | **Class-Aware Notifications** | Crucial for academic focus | Medium |
| � Medium | **User Profiles** | Click avatar to see student details | Low |
| � Medium | **Link Previews** | Rich display for shared URLs | Medium |
| 🟢 Low | **Full-Text Search** | Find specific messages | Medium |

