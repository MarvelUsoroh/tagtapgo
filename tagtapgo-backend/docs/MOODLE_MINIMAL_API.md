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
| `core_enrol_get_enrolled_users` *(optional but enabled in prod)* | Used when available to filter to true `student` roles so we never import TAs/instructors. Falls back to the session’s `users` array if the function isn’t exposed. | ✅ Low – role metadata only |
| `core_course_get_courses` *(optional)* | Pulled only to hydrate real course names/codes for dashboards. When disabled, we rely on Moodle attendance metadata. | ✅ Low – course metadata only |

### Enrollment Functions (Demo Mode Only - Write Operations)

**⚠️ DEMO ONLY**: These functions are ONLY used for the demo university and are disabled for production pilots.

| Function | Purpose | Privacy Lens |
|----------|---------|--------------|
| `core_user_get_users_by_field` | Look up existing Moodle users by email before creating duplicates. Prevents duplicate accounts. | ✅ Low – single user lookup |
| `core_user_create_users` | Create new Moodle user accounts when students sign up on TagTapGo. Only for demo university. | ⚠️ Medium – creates user records |
| `enrol_manual_enrol_users` | Enroll students into demo Moodle course. Establishes course membership for testing. | ⚠️ Medium – modifies enrollments |

**Configuration**: Controlled by environment variables:
- `DEMO_MOODLE_UNIVERSITY_DOMAIN` - Demo university domain (e.g., `https://demouniversity.dev`)
- `DEMO_MOODLE_COURSE_ID` - Course ID to enroll students into (e.g., `1`)

**Implementation**: `supabase/functions/enrol-student-in-demo-course/index.ts`

## Functions Removed (Data Minimization)

| Function | Reason Removed |
|----------|----------------|
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

### Demo Mode (Read-Write): Auto-Enrollment

For the demo university, students are automatically created in Moodle when they sign up on TagTapGo:

#### Auto-Enrollment Flow (Demo Mode)

1. **Student signs up** - PWA registration with email
2. **Profile creation** - `ensure-student.ts` creates student profile
3. **Auto-enrollment** - Edge function `enrol-student-in-demo-course` is called (fire-and-forget)
4. **Moodle user creation** - Check if user exists by email, create if not
5. **Course enrollment** - Enroll user in demo course
6. **Metadata update** - Store `moodle_user_id` in student metadata and `external_id`
7. **Sync prevention** - Setting `external_id` prevents duplicate student creation during sync

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   PWA Signup    │────▶│   TagTapGo      │────▶│   Moodle        │
│   (with email)  │     │   Profile       │     │   User Created  │
│                 │     │   + Enrollment  │     │   + Enrolled    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │   Sync Job      │
                        │   (skips user)  │
                        │   external_id   │
                        │   already set   │
                        └─────────────────┘
```

**Key Implementation Details**:
- Enrollment is **fire-and-forget** - dashboard loads even if enrollment fails
- Duplicate prevention: Checks `metadata.moodle_user_id` before enrolling
- Sync compatibility: Sets both `external_id` and `metadata.moodle_user_id` to prevent duplicate student creation
- Modular: Controlled by environment variables, easily disabled for production

## Data Flow

### Pilot Mode: Read-Only Sync (v2 Sync)

```
1. Load active universities
2. For each university:
   a. core_webservice_get_site_info → Verify capabilities
   b. For each attendance instance:
      i.   mod_attendance_get_sessions → Fetch ALL attendance data
      ii.  core_course_get_courses → Fetch actual course name (optional)
      iii. core_enrol_get_enrolled_users → Filter students from teachers (optional)
      iv.  Upsert courses (with real name from Moodle)
      v.   Upsert classes (from attendance instance)
      vi.  Upsert students (from session.users, NO email, STUDENT role only)
      vii. Upsert enrollments (by student_id + course_id unique constraint)
      viii.Upsert attendance (from session.attendance_log)
      ix.  Upsert class_schedules (from session dates with effective_from/to)
3. Return summary
```

### Demo Mode: Auto-Enrollment Flow

```
1. Student signs up on TagTapGo PWA
   ↓
2. ensure-student.ts creates student profile
   - Extracts first_name, last_name from signup
   - Infers university_id from email domain
   - Creates student record in Supabase
   ↓
3. Fire-and-forget call to enrol-student-in-demo-course
   ↓
4. Edge function checks:
   - Is DEMO_MOODLE_UNIVERSITY_DOMAIN set?
   - Is DEMO_MOODLE_COURSE_ID set?
   - Does student already have moodle_user_id?
   ↓
5. If checks pass, call moodle-adapter.enrolStudentInCourse():
   a. core_user_get_users_by_field → Look up user by email
   b. If not found: core_user_create_users → Create Moodle user
   c. enrol_manual_enrol_users → Enroll in demo course
   ↓
6. Update student record:
   - Set external_id = moodle_user_id (prevents sync duplicates)
   - Set metadata.moodle_user_id = moodle_user_id
   - Set metadata.moodle_demo_course_id = course_id
   ↓
7. Next sync run:
   - Sync job sees external_id already set
   - Skips creating duplicate student
   - Updates attendance data for existing student
```

## API Calls Comparison

| Approach | API Calls per Sync | Data Fetched |
|----------|-------------------|--------------|
| v1 (Original) | 6-10 calls | All courses, all users, calendar events |
| v2 (Minimal Sync) | 3-4 calls per attendance | Only attendance data + course name + role filtering |
| Enrollment Adapter | 3 calls per enrollment | User lookup, user creation (if needed), enrollment |

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

✅ **FERPA Compliant** - No bulk email/PII requests  
✅ **GDPR Compliant** - Data minimization principle  
✅ **Purpose Limitation** - Only attendance-related data  
✅ **Reduced Attack Surface** - Fewer API calls, less cached data  

## Implementation Files

### Core Sync (Pilot Mode - Read-Only)
- `supabase/functions/attendance-sync-job/index.ts` - Minimal sync job (v2 architecture)
- `supabase/functions/_shared/adapters/moodle-adapter.ts` - Minimal adapter class with read operations
- `supabase/functions/_shared/adapters/adapter-interface.ts` - Base adapter interface
- `supabase/functions/_shared/adapters/adapter-factory.ts` - Adapter factory for multi-LMS support

### Demo Enrollment (Demo Mode - Write Operations)
- `supabase/functions/enrol-student-in-demo-course/index.ts` - Edge function for auto-enrollment
- `tagtapgo-app/src/lib/ensure-student.ts` - Client-side profile creation with enrollment trigger
- `supabase/functions/_shared/adapters/moodle-adapter.ts` - Contains `enrolStudentInCourse()` method

## Testing the Minimal API

Use the test script to verify API responses:

```bash
cd tagtapgo-backend/scripts
deno run --allow-net test-moodle-functions.ts
```
