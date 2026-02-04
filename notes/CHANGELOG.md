# TagTapGo Documentation Changelog

**Date:** February 2026  
**Version:** 2.1

---

## February 2026 Updates

### PWA Scroll Performance Optimization (2026-02-04)

**Change:** Fixed scroll lag in the PWA by implementing scroll-aware timer hooks that pause expensive operations during scrolling.

**Root Cause:**
- Multiple 1-second `setInterval` timers causing React re-renders during scroll
- Main thread blocked by state updates while user scrolling

**Solution:**
- Created `useScrollAware` hook - detects active scrolling using passive listeners + RAF
- Created `useTickLoop` hook - consolidated timer that auto-pauses during scroll
- Applied to `DashboardClient.tsx` and `TodayClasses.tsx`

**Files Created:**
- `tagtapgo-app/src/hooks/useScrollAware.ts`
- `tagtapgo-app/src/hooks/useTickLoop.ts`

**Files Modified:**
- `tagtapgo-app/src/app/DashboardClient.tsx` - Consolidated 2 timers into 1 scroll-aware loop
- `tagtapgo-app/src/components/TodayClasses.tsx` - Replaced setInterval with scroll-aware tick loop

**Result:**
- 0 state updates during scroll (previously ~3/sec)
- Smooth scrolling on iOS Safari and Android Chrome

---

## October 2025 Updates

## Major Updates

### 1. TUP Positioned as Pure Protocol Layer

**Change:** TUP no longer stores attendance data. Universities retain full ownership through their SIS/LMS.

**Rationale:**
- GDPR compliance easier (data sovereignty)
- No vendor lock-in for universities
- Faster adoption (integrate, don't replace)
- Lower regulatory burden for TUP

**Files Updated:**
- `TUP.md` - Updated architecture and value proposition
- `TUP_IMPLEMENTATION.md` - Added data ownership clarification
- `SPRINT_PLAN.md` - Changed "attendance recording" to "event forwarding"

### 2. New Monetization Model

**Change:** Removed per-transaction fees (€0.10/record). Revenue now from:
- Subscription tiers (€2-3/student/year)
- Brand partnerships (10-20% commission)
- Analytics dashboards (included in Pro/Enterprise)
- Custom integrations (€5K-50K)

**Rationale:**
- Easier to sell (no usage-based fees)
- More predictable revenue
- Aligns with SaaS best practices
- Higher margins (70-97%)

**Files Updated:**
- `TUP.md` - Updated revenue model and FAQ
- `BUSINESS_MODEL.md` - New comprehensive business model document

### 3. SIS/LMS Integration Strategy

**Change:** Added comprehensive integration guide for open-source university systems.

**New Document:** `SIS_LMS_INTEGRATION.md`

**Covers:**
- Moodle integration (priority 1)
- openSIS/RosarioSIS integration (priority 2)
- OpenEduCat integration (priority 3)
- Data ownership model
- GDPR compliance
- Deployment guides

**Rationale:**
- Most EU universities use Moodle + openSIS
- Open-source = no vendor lock-in
- GDPR-compliant by design
- Universities already trust these systems

### 4. Updated Architecture Diagrams

**Change:** All architecture diagrams now show:
- TUP as protocol layer (middle tier)
- University SIS/LMS as data owner (bottom tier)
- Clear data flow: Reader → TUP → SIS/LMS → University Database

**Files Updated:**
- `SIS_LMS_INTEGRATION.md` - New comprehensive diagrams
- `TUP_IMPLEMENTATION.md` - Updated component descriptions

---

## New Documents Created

### 1. `SIS_LMS_INTEGRATION.md`
- Complete integration guide
- Platform-specific adapters (Moodle, openSIS, OpenEduCat)
- TypeScript implementation examples
- Deployment guides
- GDPR compliance section

### 2. `BUSINESS_MODEL.md`
- Revenue streams breakdown
- Unit economics
- 3-year projections
- Competitive analysis
- Go-to-market strategy
- Funding requirements

### 3. `CHANGELOG.md` (this file)
- Summary of all changes
- Rationale for updates
- Document cross-references

---

## Key Messaging Changes

### Old Messaging

"We provide NFC attendance tracking with gamification"

**Problems:**
- Unclear who owns the data
- Sounds like we replace existing systems
- Transaction fees create pricing complexity

### New Messaging

"We normalize NFC taps from any reader or Wallet and push to YOUR Moodle/openSIS. You keep full control of attendance data. We're just the protocol layer + engagement tools."

**Benefits:**
- Clear data ownership (university)
- Works with existing systems
- Simple pricing (subscription)
- GDPR-friendly

---

## Technical Changes

### Data Storage

**Before:**
- TUP stores attendance records
- University queries TUP for data
- Transaction fees per record access

**After:**
- TUP validates credentials only
- TUP forwards events to university SIS/LMS
- University stores attendance in their database
- TUP has read-only access for analytics (optional)

### Integration Architecture

**Before:**
```
Reader → TUP → TUP Database → University (via API)
```

**After:**
```
Reader → TUP (validate) → University SIS/LMS → University Database
                ↓
         Analytics (read-only)
```

---

## Revenue Model Changes

### Before

| Revenue Stream | Amount (10K students) |
|----------------|----------------------|
| Subscription | €25K/year |
| Transaction fees | €200K/year |
| Brand partnerships | €50K/year |
| **Total** | **€275K/year** |

### After

| Revenue Stream | Amount (10K students) |
|----------------|----------------------|
| Subscription | €25K/year |
| Brand partnerships | €50K-100K/year |
| Custom integrations | €10K-20K/year |
| **Total** | **€85K-145K/year** |

**Note:** Lower per-university revenue, but:
- Easier to sell (no usage fees)
- Faster adoption
- Higher margins
- More scalable

---

## Competitive Positioning Changes

### Before

"We're cheaper than Transact/CBORD"

### After

"We're a protocol layer that works with your existing systems. Transact/CBORD want to own your data and lock you in. We give you vendor-agnostic NFC + Wallet integration while you keep full control."

**Key Differentiators:**
1. Data sovereignty (university owns data)
2. Vendor-agnostic (any reader, any SIS/LMS)
3. GDPR-native (not bolted-on)
4. Open standards (no lock-in)
5. Faster deployment (integrate, don't replace)

---

## GDPR Compliance Changes

### Before

- TUP as data controller for attendance
- Complex data retention policies
- Right to erasure across TUP systems

### After

- University as data controller
- TUP as data processor (validation logs only)
- 30-day automatic deletion of logs
- Right to erasure handled by university

**Benefits:**
- Lower compliance burden for TUP
- Clearer responsibilities
- Easier for universities to adopt
- Aligns with EU data sovereignty principles

---

## Next Steps

### Documentation

- ✅ `SIS_LMS_INTEGRATION.md` created
- ✅ `BUSINESS_MODEL.md` created
- ✅ `TUP.md` updated
- ✅ `SPRINT_PLAN.md` updated
- ✅ `TUP_IMPLEMENTATION.md` updated
- ✅ `RESEARCH.md` (already correct)

### Implementation

- [ ] Update demo app to show SIS/LMS integration
- [ ] Create Moodle plugin prototype
- [ ] Build openSIS adapter
- [ ] Update pitch deck with new messaging
- [ ] Create investor presentation with new business model

### Partnerships

- [ ] Reach out to Moodle community
- [ ] Contact openSIS developers
- [ ] Engage with OpenEduCat team
- [ ] Update vendor partnership materials

---

## Summary

These changes position TUP as a **pure protocol layer** that respects university data sovereignty while providing vendor-agnostic NFC integration and engagement tools. This makes TUP:

1. **Easier to sell** (no data migration, works with existing systems)
2. **GDPR-friendly** (university controls data)
3. **More defensible** (open standards moat)
4. **Faster to deploy** (integrate, don't replace)
5. **Higher margins** (software-only, no transaction processing)

The new business model is more sustainable and aligns with European values around data ownership and open standards.

---

**Document Version:** 1.0  
**Last Updated:** October 2025  
**Status:** Complete

