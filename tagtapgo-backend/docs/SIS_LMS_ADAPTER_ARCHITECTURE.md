# SIS/LMS Adapter Architecture

**Version:** 1.1  
**Last Updated:** October 25, 2025  
**Status:** Implemented

---

## Overview

The SIS/LMS Adapter layer provides a **school-agnostic integration framework** for pulling attendance data from university systems. It implements a **discovery + fallback pattern** that gracefully handles varying capabilities across institutions.

### Key Principles

1. **Unified Canonical Schema** - All adapters return the same data structure
2. **Discovery + Fallback** - Detect capabilities at runtime, degrade gracefully
3. **School-Agnostic** - Works with any Moodle, openSIS, or custom system
4. **Multi-University** - Registry manages adapters for multiple institutions
5. **Health Monitoring** - Tracks adapter health and auto-recovers from failures
6. **Attendance-Focused** - MVP excludes grades (out of scope)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   Attendance Sync Job                       │
│                  (Runs every 5 minutes)                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Adapter Registry                           │
│  - Manages adapters for multiple universities               │
│  - Health monitoring & auto-recovery                        │
│  - Adapter statistics & alerting                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Adapter Factory                            │
│  - Creates adapters based on configuration                  │
│  - Runs discovery on initialization                         │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Moodle    │  │   openSIS   │  │   Generic   │
│   Adapter   │  │   Adapter   │  │   Adapter   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┴────────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │   Unified Canonical Schema   │
         │  { courses, roster,          │
         │    attendance, schedule }    │
         └──────────────────────────────┘
```

---

## File Structure

```
tagtapgo-backend/supabase/functions/_shared/
├── types/
│   └── canonical-schema.ts          # Unified data contract
├── adapters/
│   ├── adapter-interface.ts         # Base interface + errors
│   ├── moodle-adapter.ts            # Moodle implementation
│   ├── opensis-adapter.ts           # openSIS implementation
│   ├── generic-adapter.ts           # Generic REST implementation
│   ├── adapter-factory.ts           # Factory + Registry
│   └── index.ts                     # Public API exports
├── utils/
│   └── schedule-helpers.ts          # Time-based features
└── SCOPE_DECISIONS.md               # Scope documentation
```

---

## Canonical Schema

The canonical schema provides a unified data contract that all adapters must return. This ensures downstream systems (gamification engine, dashboards) work consistently regardless of the source system.

### Core Types

```typescript
interface CanonicalSchema {
  courses: CanonicalCourse[];
  meta: CanonicalMeta;
}

interface CanonicalCourse {
  id: number;
  code: string;                   // e.g., "CS101"
  name: string;
  shortName: string;
  startAt: string;                // ISO-8601
  endAt: string;                  // ISO-8601
  roster: CanonicalStudent[];
  attendance: CanonicalAttendance[];
  schedule: CanonicalSchedule[];
}

interface CanonicalStudent {
  id: number;
  username?: string;              // LMS-specific
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: 'active' | 'inactive' | 'suspended';
  gradeLevel?: string;            // SIS-specific
  studentNumber?: string;         // SIS-specific
}

interface CanonicalAttendance {
  id: string;                     // Composite: "courseId-sessionId-userId"
  courseId: number;
  sessionId: number;
  userId: number;
  status: 'present' | 'late' | 'excused' | 'absent' | 'unknown';
  statusCode: string;             // Raw code (e.g., "P", "L")
  recordedAt: string;             // ISO-8601
  sourceTz: string;               // e.g., "Europe/Dublin"
  period?: string;                // SIS-specific
  date?: string;                  // SIS-specific
}

interface CanonicalSchedule {
  id: string;                     // Composite: "courseId-dayOfWeek-period"
  courseId: number;
  dayOfWeek: string;              // e.g., "Monday" or "1"
  period?: string;                // e.g., "Morning", "Period 1"
  startTime: string;              // e.g., "09:00:00"
  endTime: string;                // e.g., "10:30:00"
  location?: string;
  instructorId?: number;
  effectiveFrom: string;          // Date
  effectiveTo: string;            // Date
}
```

### Metadata & Capabilities

```typescript
interface CanonicalMeta {
  source: 'moodle' | 'opensis' | 'generic';
  version: string;                // Schema version (e.g., "1.1")
  fetchedAt: string;              // ISO-8601
  capabilities: AdapterCapabilities;
}

interface AdapterCapabilities {
  courses: boolean;               // Always true
  roster: boolean;                // Always true
  attendance: boolean;            // Optional (plugin-dependent)
  schedule: boolean;              // Optional (plugin-dependent)
}
```

### Key Design Decisions

1. **Composite IDs** - Deterministic IDs for idempotent upserts
2. **Timezone Awareness** - `sourceTz` field preserves original timezone
3. **Status Normalization** - Maps various codes (P/L/E/A) to canonical values
4. **No Grades** - Removed from MVP scope (attendance-based gamification only)
5. **Optional Fields** - SIS-specific fields (gradeLevel, studentNumber) are optional

---

## Adapter Interface

All adapters implement the `IAdapter` interface:

```typescript
interface IAdapter {
  // Discovery
  discover(): Promise<AdapterCapabilities>;
  getCapabilities(): AdapterCapabilities;
  
  // Data fetching
  fetchAll(since?: Date): Promise<CanonicalSchema>;
  fetchCourses(): Promise<CanonicalCourse[]>;
  fetchRoster(courseId: number): Promise<CanonicalStudent[]>;
  fetchAttendance(courseId: number, since?: Date): Promise<CanonicalAttendance[]>;
  fetchSchedule(courseId: number): Promise<CanonicalSchedule[]>;
  
  // Health
  healthCheck(): Promise<boolean>;
}
```

### Discovery + Fallback Pattern

```typescript
// 1. Discover capabilities on startup
const adapter = await AdapterFactory.createAndDiscover(config);
const capabilities = adapter.getCapabilities();

// 2. Fetch data based on capabilities
if (capabilities.attendance) {
  course.attendance = await adapter.fetchAttendance(courseId);
} else {
  course.attendance = []; // Graceful degradation
}

// 3. Metadata reflects what's available
{
  "courses": [...],
  "meta": {
    "capabilities": {
      "courses": true,
      "roster": true,
      "attendance": false,  // Plugin not installed
      "schedule": true
    }
  }
}
```

---

## Adapter Implementations

### 1. Moodle Adapter

**File:** `moodle-adapter.ts`

**Discovery Strategy:**
- Calls `core_webservice_get_site_info` to get available functions
- Checks for attendance plugin functions (`mod_attendance_*`)
- Checks for calendar functions (`core_calendar_*`)

**Core Functions:**
- `core_course_get_courses` - Fetch courses
- `core_enrol_get_enrolled_users` - Fetch roster
- `mod_attendance_get_sessions` - Fetch attendance sessions
- `mod_attendance_get_session_log` - Fetch attendance records
- `core_calendar_get_calendar_events` - Fetch schedule

**Normalization:**
- Unix timestamps → ISO-8601
- Status codes: P/L/E/A → present/late/excused/absent
- Timezone conversion using `sourceTz`

**Configuration:**
```typescript
interface MoodleConfig {
  type: 'moodle';
  universityId: string;
  baseUrl: string;              // e.g., "https://moodle.university.edu"
  token: string;                // Web service token
  timezone: string;             // e.g., "Europe/Dublin"
}
```

### 2. openSIS Adapter

**File:** `opensis-adapter.ts`

**Dual Mode:**
- **REST API** - For cloud-hosted openSIS instances
- **PostgreSQL Direct** - For self-hosted instances (faster, more reliable)

**Discovery Strategy:**
- Tests API endpoints to detect enabled modules
- Checks database tables if using direct access
- Detects attendance module, scheduling module

**Core Endpoints/Tables:**
- `/api/courses` or `courses` table
- `/api/students` or `students` table
- `/api/attendance` or `attendance` table
- `/api/schedule` or `course_periods` table

**SIS-Specific Features:**
- Grade levels (Undergraduate, Graduate, Year 1-4)
- Student numbers
- Period-based attendance (Morning, Afternoon, Period 1-8)
- Class periods with locations

**Configuration:**
```typescript
interface OpenSISConfig {
  type: 'opensis';
  universityId: string;
  baseUrl: string;
  apiKey?: string;              // For REST API
  dbHost?: string;              // For direct access
  dbUser?: string;
  dbPassword?: string;
  useDirectAccess: boolean;     // true = PostgreSQL, false = REST
  timezone: string;
}
```

### 3. Generic REST Adapter

**File:** `generic-adapter.ts`

**Purpose:** Support custom SIS/LMS systems with configurable endpoints and field mappings.

**Features:**
- Configurable endpoints for each data type
- Custom field name mappings
- Flexible authentication (API key, Bearer token, custom headers)
- Response format normalization (array vs. object with data property)

**Discovery Strategy:**
- Tests each configured endpoint
- Marks capability as available if endpoint returns 200

**Configuration:**
```typescript
interface GenericConfig {
  type: 'generic';
  universityId: string;
  baseUrl: string;
  apiKey?: string;
  authHeader?: string;          // e.g., "X-API-Key"
  endpoints: {
    courses?: string;           // e.g., "/api/v1/courses"
    roster?: string;
    attendance?: string;
    schedule?: string;
  };
  fieldMappings?: {             // Map source fields to canonical fields
    'course_id': 'id',
    'course_code': 'code',
    // ...
  };
  timezone: string;
}
```

---

## Adapter Factory & Registry

### Factory Pattern

**File:** `adapter-factory.ts`

```typescript
class AdapterFactory {
  static create(config: AnyAdapterConfig): IAdapter {
    switch (config.type) {
      case 'moodle':
        return new MoodleAdapter(config);
      case 'opensis':
        return new OpenSISAdapter(config);
      case 'generic':
        return new GenericAdapter(config);
      default:
        throw new Error(`Unknown adapter type: ${config.type}`);
    }
  }
  
  static async createAndDiscover(config: AnyAdapterConfig): Promise<IAdapter> {
    const adapter = this.create(config);
    await adapter.discover();
    return adapter;
  }
}
```

### Registry Management

```typescript
class AdapterRegistry {
  private adapters = new Map<string, IAdapter>();
  private health = new Map<string, AdapterHealth>();
  
  async register(universityId: string, config: AnyAdapterConfig): Promise<void> {
    const adapter = await AdapterFactory.createAndDiscover(config);
    this.adapters.set(universityId, adapter);
    this.health.set(universityId, {
      universityId,
      type: config.type,
      healthy: true,
      lastCheck: new Date(),
      consecutiveFailures: 0,
    });
  }
  
  get(universityId: string): IAdapter | undefined {
    return this.adapters.get(universityId);
  }
  
  async checkHealth(universityId: string): Promise<boolean> {
    const adapter = this.adapters.get(universityId);
    if (!adapter) return false;
    
    const healthy = await adapter.healthCheck();
    const health = this.health.get(universityId)!;
    
    if (healthy) {
      health.healthy = true;
      health.lastSuccess = new Date();
      health.consecutiveFailures = 0;
    } else {
      health.consecutiveFailures++;
      if (health.consecutiveFailures >= 3) {
        health.healthy = false;
        // Alert admin
      }
    }
    
    health.lastCheck = new Date();
    return healthy;
  }
  
  async recover(universityId: string): Promise<boolean> {
    // Attempt to re-discover capabilities and reconnect
    const adapter = this.adapters.get(universityId);
    if (!adapter) return false;
    
    try {
      await adapter.discover();
      const health = this.health.get(universityId)!;
      health.healthy = true;
      health.consecutiveFailures = 0;
      return true;
    } catch (error) {
      return false;
    }
  }
}
```

### Health Monitoring

```typescript
interface AdapterHealth {
  universityId: string;
  type: string;
  healthy: boolean;
  lastCheck: Date;
  lastSuccess?: Date;
  lastError?: string;
  consecutiveFailures: number;
}
```

---

## Schedule Helpers

**File:** `schedule-helpers.ts`

Provides utilities for time-based features (feedback prompts, streak warnings, countdown).

### Core Functions

```typescript
// Get next upcoming class
function getNextClass(schedules: CanonicalSchedule[]): NextClass | null;

// Get class end time for feedback prompts
function getClassEndTime(schedules: CanonicalSchedule[], sessionId: number): Date | null;

// Check if class is currently active
function isClassActive(schedules: CanonicalSchedule[], sessionId: number): boolean;

// Check if streak is at risk (no attendance in 24h before next class)
function isStreakAtRisk(schedules: CanonicalSchedule[], lastAttendance: Date): boolean;
```

### Use Cases

1. **Feedback Prompts** - Trigger 15 minutes after class ends
2. **Streak Warnings** - Alert 2 hours before next class if no recent attendance
3. **Dashboard Countdown** - Show time until next class

---

## Data Flow

### Sync Job Workflow

```
1. Load university configurations from database
2. For each university:
   a. Get adapter from registry (or create if not exists)
   b. Check adapter health
   c. Fetch data: adapter.fetchAll(since)
   d. Validate canonical schema
   e. Upsert to database (idempotent)
   f. Trigger gamification engine
3. Log results and update sync status
```

### Error Handling

```typescript
try {
  const schema = await adapter.fetchAll(since);
  await upsertToDatabase(schema);
} catch (error) {
  if (error instanceof DiscoveryError) {
    // Log warning, mark capability as unavailable
    console.warn('Discovery failed, using cached capabilities');
  } else if (error instanceof FetchError) {
    // Skip this sync, retry next time
    console.error('Fetch failed, will retry');
  } else if (error instanceof AuthenticationError) {
    // Alert admin, mark adapter as unhealthy
    console.error('Authentication failed, check credentials');
    await registry.markUnhealthy(universityId);
  }
}
```

---

## Configuration Examples

### Moodle University

```json
{
  "id": "uni-moodle-123",
  "name": "University of Example",
  "sis_type": "moodle",
  "api_config": {
    "type": "moodle",
    "universityId": "uni-moodle-123",
    "baseUrl": "https://moodle.example.edu",
    "token": "abc123...",
    "timezone": "Europe/Dublin"
  },
  "timezone": "Europe/Dublin"
}
```

### openSIS University (Direct Access)

```json
{
  "id": "uni-opensis-456",
  "name": "State University",
  "sis_type": "opensis",
  "api_config": {
    "type": "opensis",
    "universityId": "uni-opensis-456",
    "baseUrl": "https://sis.stateuniversity.edu",
    "dbHost": "localhost",
    "dbUser": "opensis_ro",
    "dbPassword": "encrypted...",
    "useDirectAccess": true,
    "timezone": "America/New_York"
  },
  "timezone": "America/New_York"
}
```

### Generic REST University

```json
{
  "id": "uni-custom-789",
  "name": "Custom University",
  "sis_type": "generic",
  "api_config": {
    "type": "generic",
    "universityId": "uni-custom-789",
    "baseUrl": "https://api.customuniversity.edu",
    "apiKey": "xyz789...",
    "authHeader": "X-API-Key",
    "endpoints": {
      "courses": "/v1/courses",
      "roster": "/v1/courses/{courseId}/students",
      "attendance": "/v1/courses/{courseId}/attendance",
      "schedule": "/v1/courses/{courseId}/schedule"
    },
    "fieldMappings": {
      "course_id": "id",
      "course_code": "code",
      "student_id": "id",
      "student_email": "email"
    },
    "timezone": "America/Los_Angeles"
  },
  "timezone": "America/Los_Angeles"
}
```

---

## Usage Examples

### Initialize Registry

```typescript
import { AdapterRegistry } from './_shared/adapters/index.ts';

const registry = new AdapterRegistry();

// Load university configs from database
const universities = await supabase
  .from('universities')
  .select('*');

// Register adapters
for (const uni of universities.data) {
  await registry.register(uni.id, uni.api_config);
}
```

### Sync Single University

```typescript
const adapter = registry.get('uni-moodle-123');
if (!adapter) throw new Error('Adapter not found');

// Check health
const healthy = await registry.checkHealth('uni-moodle-123');
if (!healthy) {
  console.warn('Adapter unhealthy, attempting recovery...');
  await registry.recover('uni-moodle-123');
}

// Fetch data
const since = await getLastSyncTime('uni-moodle-123');
const schema = await adapter.fetchAll(since);

// Validate
const errors = validateCanonicalSchema(schema);
if (errors.length > 0) {
  throw new Error(`Invalid schema: ${errors.join(', ')}`);
}

// Upsert to database
await upsertCourses(schema.courses);
await updateSyncStatus('uni-moodle-123', 'success');
```

### Capability-Based Fetching

```typescript
const capabilities = adapter.getCapabilities();

if (capabilities.attendance) {
  const attendance = await adapter.fetchAttendance(courseId, since);
  console.log(`Fetched ${attendance.length} attendance records`);
} else {
  console.warn('Attendance not available for this university');
}

if (capabilities.schedule) {
  const schedule = await adapter.fetchSchedule(courseId);
  const nextClass = getNextClass(schedule);
  console.log(`Next class: ${nextClass?.startTime}`);
}
```

---

## Testing

### Unit Tests

```typescript
describe('MoodleAdapter', () => {
  it('should discover capabilities', async () => {
    const adapter = new MoodleAdapter(mockConfig);
    const capabilities = await adapter.discover();
    expect(capabilities.courses).toBe(true);
    expect(capabilities.roster).toBe(true);
  });
  
  it('should normalize attendance status', () => {
    const status = normalizeAttendanceStatus('P');
    expect(status).toBe('present');
  });
});
```

### Integration Tests

```typescript
describe('Integration', () => {
  it('should sync from real Moodle instance', async () => {
    const adapter = await AdapterFactory.createAndDiscover(realMoodleConfig);
    const schema = await adapter.fetchAll();
    expect(schema.courses.length).toBeGreaterThan(0);
    expect(validateCanonicalSchema(schema)).toEqual([]);
  });
});
```

---

## Troubleshooting

### Discovery Failures

**Symptom:** Adapter fails to discover capabilities

**Causes:**
- Invalid credentials
- Network connectivity issues
- API endpoint changes

**Solutions:**
1. Verify credentials in database
2. Test API endpoint manually (curl/Postman)
3. Check adapter logs for specific error
4. Update adapter if API changed

### Missing Attendance Data

**Symptom:** `capabilities.attendance = false`

**Causes:**
- Attendance plugin not installed
- API permissions insufficient
- Module disabled in SIS/LMS

**Solutions:**
1. Check if attendance plugin installed in Moodle
2. Verify API token has attendance permissions
3. Enable attendance module in openSIS
4. Use generic adapter with custom endpoint

### Health Check Failures

**Symptom:** Adapter marked as unhealthy

**Causes:**
- Temporary network issues
- API rate limiting
- Credential expiration

**Solutions:**
1. Check network connectivity
2. Review rate limit settings
3. Rotate API credentials
4. Attempt manual recovery: `registry.recover(universityId)`

---

## Performance Considerations

### Optimization Strategies

1. **Incremental Sync** - Only fetch records since last sync
2. **Parallel Processing** - Process multiple universities concurrently
3. **Caching** - Cache course/roster data (changes infrequently)
4. **Rate Limiting** - Respect API rate limits
5. **Connection Pooling** - Reuse database connections (openSIS direct access)

### Scalability

- **Horizontal:** Multiple Edge Function instances
- **Vertical:** Optimize database queries and indexes
- **Caching:** Redis for frequently accessed data
- **Queue:** Background job processing for heavy operations

---

## Security

### Authentication

- **Moodle:** Web service tokens (scoped permissions)
- **openSIS:** API keys or database credentials (encrypted)
- **Generic:** Configurable auth headers

### Data Protection

- **Encryption at Rest:** Supabase PostgreSQL encryption
- **Encryption in Transit:** HTTPS/TLS for all API calls
- **Credential Storage:** Encrypted in database
- **Access Control:** RLS policies on all tables

### Compliance

- **GDPR:** Data minimization (attendance only, minimal PII)
- **Data Sovereignty:** University owns all data
- **Audit Trail:** All sync operations logged
- **Right to Erasure:** Student data deletion support

---

## Future Enhancements

### Planned Adapters

1. **Canvas LMS** - Popular in North America
2. **Blackboard Learn** - Enterprise LMS
3. **PowerSchool SIS** - K-12 and higher ed
4. **Banner ERP** - Ellucian's SIS

### Advanced Features

1. **Custom Sync Intervals** - Per-university scheduling
2. **Predictive Alerting** - ML-based failure prediction
3. **Data Enrichment** - Correlation analysis, risk factors
4. **Real-time Sync** - Webhook-based updates

### Extensibility

```typescript
// Add new adapter type
class CanvasAdapter extends BaseAdapter {
  async discover(): Promise<AdapterCapabilities> {
    // Canvas-specific discovery
  }
}

// Register in factory
AdapterFactory.register('canvas', CanvasAdapter);
```

---

## Summary

The SIS/LMS Adapter Architecture provides:

✅ **School-Agnostic** - Works with any institution  
✅ **Discovery + Fallback** - Graceful degradation  
✅ **Multi-University** - Single deployment, multiple institutions  
✅ **Health Monitoring** - Auto-recovery and alerting  
✅ **Production-Ready** - Comprehensive error handling  
✅ **Extensible** - Easy to add new adapter types  

This architecture enables attendance-based gamification while providing the flexibility to adapt to any university's technical environment.

