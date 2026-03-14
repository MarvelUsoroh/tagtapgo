# Moodle Minimal API Architecture

## Overview

TagTapGo uses a **data minimization** approach to Moodle integration, requesting only the data necessary for attendance gamification. This document explains the architectural decisions and implementation.

## Integration Modes

TagTapGo supports two distinct integration modes:

### 1. Pilot Mode (Read-Only) - For Real Universities
- **Purpose**: Sync existing students and attendance from production LMS
- **Operations**: Read-only API calls
- **Use Case**: Real university pilots where students already exist in Moodle
- **Functions Used**: `core_webservice_get_site_info`, `mod_attendance_get_sessions`, `core_enrol_get_enrolled_users`, `core_course_get_courses`

### 2. Demo Mode (Read-Write) - For Testing Only
- **Purpose**: Create test environment with auto-enrollment
- **Operations**: Read + Write API calls
- **Use Case**: Demo university for testing and development
- **Functions Used**: All read functions + `core_user_get_users_by_field`, `core_user_create_users`, `enrol_manual_enrol_users`
- **Modular Design**: Easily removable via environment variables

## Key Discovery: `mod_attendance_get_sessions`

After testing all 10 available Moodle API functions, we discovered that `mod_attendance_get_sessions` returns everything needed in a single call:

```json
{
  "sessions": [
    {
      "id": 1,
      "attendanceid": 1,
      "courseid": 2,
      "sessdate": 1735840800,     // Unix timestamp
      "duration": 3600,            // Seconds
      "description": "Class session",
      "statuses": [
        { "id": 1, "acronym": "P" },
        { "id": 2, "acronym": "A" }
      ],
      "attendance_log": [           // ← Attendance records embedded!
        { "studentid": 5, "statusid": 1, "timetaken": 1735840900 }
      ],
      "users": [                    // ← Minimal user data embedded!
        { "id": 5, "firstname": "John", "lastname": "Doe" }
      ]
    }
  ]
}
```

## Minimal Function Set (Core Functions)

### Attendance Sync Functions (attendance-sync-job)

| Function | Why We're Actively Using It Today | Privacy Lens |
|----------|----------------------------------|--------------|
| `core_webservice_get_site_info` | Every sync run starts here to validate the token, discover enabled WS functions, and short-circuit if `mod_attendance_get_sessions` isn’t exposed. | ✅ Low – capability metadata only |
| `mod_attendance_get_sessions` | Primary data feed for sessions, durations, statuses, attendance logs, and minimal user stubs. Also provides `session.description` used for Venus AI context. | ✅ Low – class/attendance context only |
| `core_enrol_get_enrolled_users` | **Crucial for pre-population**: Used to extract the `email` from the Moodle payload (requires `moodle/course:useremail` capability) so students can log in via magic links. Also used to filter to true `student` roles. | ✅ Low – emails and role metadata only |
| `core_course_get_courses` *(optional)* | Pulled only to hydrate real course names/codes for dashboards. When disabled, we rely on Moodle attendance metadata. | ✅ Low – course metadata only |

### Functions Removed (Data Minimization)

| Function | Reason Removed |
|----------|----------------|
| `core_user_get_users_by_field` | Dropped Demo Auto-Enrollment mode |
| `core_user_create_users` | Dropped Demo Auto-Enrollment mode |
| `enrol_manual_enrol_users` | Dropped Demo Auto-Enrollment mode |
| `core_course_get_contents` | Too broad, returns entire course structure |
| `core_calendar_get_calendar_events` | Requires high privileges, unreliable |
| `mod_attendance_get_session` | Redundant - data in get_sessions |
| `mod_attendance_add_session` | We don't need write access |

## Student Record Strategy

### Pilot Mode (Read-Only): No Emails from Moodle

The minimal API returns only:
- `id` (Moodle user ID)
- `firstname`
- `lastname`

**This is intentional** - we never request email addresses from Moodle during sync.

#### Account Linking Flow (Pilot Mode)

1. **Sync creates stub records** - Minimal student records with `external_id` (Moodle user ID)
2. **Students self-register** - PWA registration with their email
3. **Account claiming** - Students can link their Moodle ID to claim existing attendance data

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Moodle        │     │   TagTapGo      │     │   PWA           │
│   Sessions      │────▶│   Stub Records  │◀────│   Registration  │
│   (no email)    │     │   (external_id) │     │   (with email)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Pre-population Model (Read-Only)

For the TagTapGo Pilot, students are **not** created via open registration. Instead:
1. The **Moodle Sync Job** pulls all active students from the Moodle instance via `core_enrol_get_enrolled_users`, including their `email` address.
2. It pre-populates the TagTapGo `students` table, saving their official university emails.
3. Students must sign into the app using their pre-registered university email. If they attempt to sign in with an unregistered email, the app rejects the login.

**Key Implementation Details**:
- Sync compatibility: Sets both `external_id` and `metadata.moodle_user_id` to prevent duplicate student creation.

## Data Flow

### Pilot Mode: Read-Only Sync (v2 Sync)

```
1. Load active universities
2. For each university:
   a. core_webservice_get_site_info → Verify capabilities
   b. For each attendance instance:
      i.   mod_attendance_get_sessions → Fetch ALL attendance data
      ii.  core_course_get_courses → Fetch actual course name (optional)
      iii. core_enrol_get_enrolled_users → Extract emails & filter students from teachers
      iv.  Upsert courses (with real name from Moodle)
      v.   Upsert classes (from attendance instance)
      vi.  Upsert students (from session.users + extracted emails, STUDENT role only)
      vii. Upsert enrollments (by student_id + course_id unique constraint)
      viii.Upsert attendance (from session.attendance_log)
      ix.  Upsert class_schedules (from session dates with effective_from/to)
3. Return summary
```

## API Calls Comparison

| Approach | API Calls per Sync | Data Fetched |
|----------|-------------------|--------------|
| v1 (Original) | 6-10 calls | All courses, all users, calendar events |
| v2 (Minimal Sync) | 3-4 calls per attendance | Only attendance data + course name + role filtering + emails |

## Configuration

Add `attendance_ids` to university `api_config`:

```json
{
  "type": "moodle",
  "baseUrl": "https://university.moodlecloud.com",
  "token": "your-webservice-token",
  "timezone": "America/New_York",
  "attendance_ids": [1, 2, 3]  // ← Attendance module instance IDs
}
```

## Compliance Benefits

✅ **FERPA Compliant** - No bulk email/PII requests (only exact emails needed for login)  
✅ **GDPR Compliant** - Data minimization principle  
✅ **Purpose Limitation** - Only attendance-related data for gamification tracking  
✅ **Reduced Attack Surface** - Zero write operations  

## Implementation Files

### Core Sync (Pilot Mode - Read-Only)
- `supabase/functions/attendance-sync-job/index.ts` - Minimal sync job (v2 architecture)
- `supabase/functions/_shared/adapters/moodle-adapter.ts` - Minimal adapter class with read operations
- `supabase/functions/_shared/adapters/adapter-interface.ts` - Base adapter interface
- `supabase/functions/_shared/adapters/adapter-factory.ts` - Adapter factory for multi-LMS support

## Testing the Minimal API

Use the test script to verify API responses:

```bash
cd tagtapgo-backend/scripts
deno run --allow-net test-moodle-functions.ts
```
