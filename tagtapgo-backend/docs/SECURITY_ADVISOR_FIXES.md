# Supabase Security Advisor Fixes

## Overview

This document describes the fixes applied to resolve security issues identified by Supabase Advisor.

## Issues Fixed

### 1. Security Definer Views (ERROR Level) ✅

**Problem:** 6 views were defined with `SECURITY DEFINER`, which bypasses RLS and uses the creator's permissions instead of the querying user's permissions.

**Risk:** Could expose data that should be protected by RLS policies.

**Solution:** Recreated all views WITHOUT `SECURITY DEFINER` property.

#### Views Fixed:

1. **`achievements_with_progress`** (Student-facing)
   - Used by: Achievements page
   - Now respects RLS policies
   - Uses `auth.uid()` to filter student achievements
   - Students can only see their own progress

2. **`student_points_balance`** (Student-facing)
   - Used by: Leaderboard calculations
   - Now respects RLS policies
   - Aggregates points per student

3. **`cron_job_executions_recent`** (Admin only)
   - Shows last 100 job executions (24 hours)
   - Access restricted to service_role only

4. **`cron_job_health`** (Admin only)
   - Health metrics for cron jobs
   - Access restricted to service_role only

5. **`sync_alerts_active`** (Admin only)
   - Active (unresolved) sync alerts
   - Access restricted to service_role only

6. **`sync_alerts_summary`** (Admin only)
   - Summary of sync alerts (24 hours)
   - Access restricted to service_role only

### 2. Function Search Path Mutable (WARN Level) ✅

**Problem:** 21 functions lacked fixed `search_path`, making them vulnerable to search path hijacking attacks.

**Risk:** Attackers could manipulate the search path to execute malicious code.

**Solution:** Added `SET search_path = public, pg_temp` to all functions.

#### Functions Fixed:

**Achievement Functions:**
- `get_achievements_stats` - Get achievement statistics for a student

**Vault Functions:**
- `get_vault_secret` - Retrieve secrets from Supabase Vault
- `add_vault_secret` - Add secrets to Supabase Vault

**Sync Job Functions:**
- `execute_attendance_sync_job` - Trigger attendance sync via HTTP
- `execute_attendance_sync_job_secure` - Secure version using vault secrets
- `trigger_attendance_sync` - Wrapper function

**Job Status Functions:**
- `is_job_running` - Check if a cron job is currently running
- `get_job_status` - Get the status of the last job execution
- `cleanup_old_job_executions` - Delete old job execution records

**Alert Functions:**
- `alert_exists` - Check if an alert already exists
- `create_sync_alert` - Create or update a sync alert
- `resolve_sync_alert` - Mark an alert as resolved
- `resolve_university_alerts` - Resolve all alerts for a university
- `trigger_alert_checks` - Run all alert check functions

**Alert Check Functions:**
- `check_consecutive_failures` - Check for consecutive sync failures
- `check_stale_syncs` - Check for stale syncs (no success in 2+ hours)
- `check_low_success_rate` - Check for low sync success rate (<50%)

**Trigger Functions:**
- `update_updated_at_column` - Auto-update updated_at timestamp
- `set_unlocked_from_unlocked_at` - Auto-set unlocked flag

**Redemption Functions:**
- `generate_redemption_code` - Generate unique 8-character codes
- `set_redemption_code` - Auto-generate redemption codes on insert

## Migration Details

**File:** `20241028000001_fix_security_advisor_issues.sql`

**Actions:**
1. Drop and recreate all 6 views without SECURITY DEFINER
2. Update all 21 functions to include `SET search_path = public, pg_temp`
3. Set appropriate permissions:
   - Students can read `achievements_with_progress` and `student_points_balance`
   - Admin views restricted to `service_role` only
4. Add documentation comments to all functions

## Security Improvements

### Before:
- ❌ Views bypassed RLS policies
- ❌ Functions vulnerable to search path attacks
- ❌ Potential data exposure
- ❌ Potential code injection

### After:
- ✅ Views respect RLS policies
- ✅ Functions protected from search path attacks
- ✅ Proper access control
- ✅ Defense in depth security

## Testing Checklist

### View Security:
- [ ] Students can only see their own achievements in `achievements_with_progress`
- [ ] Students can see all student points in `student_points_balance` (for leaderboards)
- [ ] Students cannot access admin views (cron_job_*, sync_alerts_*)
- [ ] Service role can access all views

### Function Security:
- [ ] All functions execute with fixed search_path
- [ ] Functions cannot be exploited via search path manipulation
- [ ] Vault functions work correctly
- [ ] Sync job functions work correctly
- [ ] Alert functions work correctly

### Application Functionality:
- [ ] Achievements page loads correctly
- [ ] Leaderboard displays correctly
- [ ] No errors in application logs
- [ ] Real-time updates still work

## Deployment Instructions

1. **Backup Database:**
   ```bash
   # Create a backup before applying migration
   supabase db dump > backup_before_security_fixes.sql
   ```

2. **Apply Migration:**
   ```bash
   # Push migration to Supabase
   supabase db push
   ```

3. **Verify Changes:**
   ```bash
   # Check Supabase Advisor again
   # Should show 0 errors for security_definer_view
   # Should show 0 warnings for function_search_path_mutable
   ```

4. **Test Application:**
   - Test achievements page
   - Test leaderboard
   - Verify no errors in console
   - Check that students can't access admin views

## Remaining Issues

The following Supabase Advisor warnings were NOT addressed in this migration:

### 3. Extension in Public Schema (WARN)
**Issue:** The `http` extension is installed in the public schema.

**Recommendation:** Move to a dedicated schema (e.g., `extensions`).

**Impact:** Low - This is a best practice but not a critical security issue.

**Action Required:** Manual migration to move extension.

### 4. Leaked Password Protection Disabled (WARN)
**Issue:** Auth doesn't check passwords against HaveIBeenPwned database.

**Recommendation:** Enable in Supabase Auth settings.

**Impact:** Medium - Users can set compromised passwords.

**Action Required:** Enable in Supabase Dashboard:
1. Go to Authentication > Policies
2. Enable "Leaked Password Protection"
3. Configure minimum password strength

## Performance Impact

**Expected Impact:** Minimal to none

- Views without SECURITY DEFINER may be slightly faster (no permission elevation overhead)
- Functions with fixed search_path have negligible overhead
- No changes to query plans or indexes

## Rollback Plan

If issues occur after deployment:

1. **Immediate Rollback:**
   ```bash
   # Restore from backup
   psql -h <host> -U postgres -d postgres < backup_before_security_fixes.sql
   ```

2. **Partial Rollback:**
   - Recreate specific views with SECURITY DEFINER if needed
   - Remove search_path from specific functions if they break

3. **Investigation:**
   - Check application logs for errors
   - Verify RLS policies are correctly configured
   - Test with different user roles

## References

- [Supabase Security Definer Views](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view)
- [Supabase Function Search Path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/ddl-schemas.html#DDL-SCHEMAS-PATTERNS)

## Status

**Migration Status:** ✅ Ready for deployment

**Issues Fixed:**
- ✅ Security Definer Views (6 views)
- ✅ Function Search Path Mutable (21 functions)

**Issues Remaining:**
- ⚠️ Extension in Public Schema (manual fix required)
- ⚠️ Leaked Password Protection (enable in dashboard)

**Next Steps:**
1. Review and approve migration
2. Apply to staging environment
3. Test thoroughly
4. Apply to production
5. Verify with Supabase Advisor
6. Address remaining warnings
