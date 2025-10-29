# Scope Decisions - SIS/LMS Integration

## Grades Removed from MVP (2025-10-25)

### Decision

**Removed `CanonicalGrade` and all grade-related functionality from the canonical schema.**

### Rationale

**1. Application Goal:**

- Primary goal: Prove 15-25% attendance increase through gamification
- Core mechanics: Points, streaks, achievements, leaderboards based on **attendance only**

**2. Requirements Analysis:**

- 0 out of 16 requirements mention grades
- All gamification is based on attendance records (Requirements 1-3, 16)
- Points awarded for attendance patterns (Requirement 2)
- Achievements based on attendance milestones (Requirements 4, 7)
- Leaderboards rank by points from attendance (Requirements 6, 8)

**3. MVP Scope:**
From `PROTOCOL_VS_GAMIFICATION.md`:

> Gamification reads attendance from SIS/LMS
> Points/streaks/achievements calculated from attendance only

**4. Data Actually Needed:**

- ✅ `CanonicalCourse` - course information
- ✅ `CanonicalStudent` - student roster
- ✅ `CanonicalAttendance` - **CORE DATA** for gamification
- ✅ `CanonicalSchedule` - for time-based features (feedback prompts, streak warnings)
- ❌ `CanonicalGrade` - **NOT USED** in attendance-based gamification

### What Was Removed

**From `canonical-schema.ts`:**

- `CanonicalGrade` interface
- `grades` array from `CanonicalCourse`
- `grades` capability flag from `AdapterCapabilities`
- `generateGradeId()` utility function

**From `adapter-interface.ts`:**

- `fetchGrades()` method from `IAdapter` interface
- `fetchGrades()` abstract method from `BaseAdapter` class
- Grade fetching logic from `fetchAll()` method
- `grades` capability initialization

**From `OpenAPI.md`:**

- Grade examples from canonical schema
- Grade-related capability flags
- Grade references in design principles

### Future Consideration

Grades could be added in a future version for:

- "Academic Achievement" badges (e.g., "Dean's List", "Perfect GPA")
- Correlation analysis (attendance vs academic performance)
- Predictive models (at-risk student identification)

However, these are **out of scope for the attendance-focused gamification MVP**.

### Impact

**Positive:**

- ✅ Simplified schema (fewer fields to maintain)
- ✅ Faster implementation (fewer API calls, less normalization)
- ✅ Clearer focus on MVP goal (attendance increase)
- ✅ Reduced scope creep risk

**No Negative Impact:**

- All 16 requirements still fully supported
- No functionality lost (grades were never used)
- Schema remains extensible for future additions

---

**Decision Date:** 2025-10-25  
**Status:** Implemented  
**Approved By:** User (explicit confirmation)
