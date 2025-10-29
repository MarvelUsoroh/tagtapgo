# Protocol vs Gamification – Scope and Boundaries

Document Version: 1.0  
Last Updated: 2025-10-21

## TL;DR

- TUP is a pure protocol layer: validate NFC credentials (cards + Wallet), normalize, and forward attendance events to the university’s SIS/LMS. It does not store attendance records.
- Gamification is an optional engagement layer on top: points, streaks, achievements, leaderboards, rewards. It reads attendance from the SIS/LMS and never awards based on client input.

## Protocol (TUP) – What it does

- Vendor-agnostic ISO 14443 integration for readers (ELATEC, LEGIC, HID, Salto…).
- End-to-end cryptography: ECDH + AES-256-GCM, ECDSA signatures, zero-trust readers.
- Policy evaluation → short-lived decision tokens (JWT) for offline resilience.
- Forward normalized attendance.tap events to SIS/LMS adapters (Moodle, openSIS, OpenEduCat). University stores attendance.

## Protocol (TUP) – What it does not do

- Does not store attendance records (only 30-day validation logs).
- Does not replace SIS/LMS; does not charge per tap; does not sell hardware.
- Does not use geolocation/Wi‑Fi as a trust factor. Presence is proven by the NFC credential validation path.

## Gamification – What it does

- Computes points/streaks/achievements/leaderboards/rewards in backend jobs from SIS-confirmed attendance only.
- Maintains a points ledger (idempotent) and compensating entries for adjustments.
- Shows “Pending → Confirmed/Adjusted” states in the UI; client is read-only with regard to awards.

## Gamification – What it does not do

- No client-triggered “claim” or “check-in” that impacts points/streaks.
- No storage of attendance as source of truth (always SIS/LMS-owned).

## Optional context signals (not protocol trust)

- If a university requests, low-friction heuristics (e.g., on-campus network presence) may be used for tiny bonuses or anomaly detection, not as the primary attendance trust. These remain outside the protocol path and are clearly labeled as such.

## Implementation Status

### ✅ Completed (2025-10-21)

**Frontend (tagtapgo-app):**
- ✅ Removed manual "Tap for Class" button (was violating zero-friction principle)
- ✅ Made app read-only for points/streaks (no client-triggered awards)
- ✅ Added real-time updates via Supabase Realtime for points, streaks, and achievements
- ✅ Added "Active Class Status" display (informational only, no manual check-in)
- ✅ Added pending state messaging ("Attendance will be recorded automatically")

**Backend (tagtapgo-backend):**
- ✅ Database migrations deployed (20 tables, RLS policies, indexes, triggers)
- ✅ student_points_balance view created
- ⏳ Attendance sync job (pending implementation)
- ⏳ SIS/LMS adapters (pending implementation)
- ⏳ Gamification engine (pending implementation)

### 🎯 Architecture Compliance

The current implementation now follows the zero-friction principle:
```
Student attends class (NFC tap at reader)
  ↓
Attendance recorded in university SIS/LMS
  ↓
Backend sync job fetches attendance (every 5 min)
  ↓
Points/streaks calculated automatically
  ↓
Real-time update pushed to student app
  ↓
Student sees updated points (no manual action needed)
```

**Key Principle Maintained:** "Tap → Points" mental model with zero client-side claims.

## References

- notes/TUP.md, notes/TUP_IMPLEMENTATION.md – Protocol architecture and contracts
- notes/SIS_LMS_INTEGRATION.md – SIS adapters and data ownership
- notes/SECURITY_MODEL.md – End-to-end security model and decision tokens
