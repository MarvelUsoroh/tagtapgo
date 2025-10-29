# Security Guide

This document outlines security best practices for the TagTapGo backend.

---

## Secrets Management

### ⚠️ CRITICAL: Service Role Key

The Supabase service role key is **highly sensitive** and grants full access to your database. Never:

- ❌ Store it in database settings (`ALTER DATABASE SET`)
- ❌ Commit it to version control
- ❌ Share it in plain text
- ❌ Log it in application logs
- ❌ Expose it in client-side code

### ✅ Recommended: Supabase Vault

Use Supabase Vault to securely store sensitive credentials:

```sql
-- Enable Vault
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- Store secret
SELECT public.add_vault_secret(
  'service_role_key',
  'your-actual-key',
  'Supabase service role key (SENSITIVE)'
);

-- Retrieve secret (only in secure functions with proper access control)
-- Use the secure helper function instead of direct access
SELECT public.get_vault_secret('service_role_key');
```

**Security Best Practices:**
- ✅ Use `public.get_vault_secret()` helper with access control
- ✅ Never query `vault.decrypted_secrets` directly
- ✅ Restrict access to postgres/service_role only
- ✅ Log all secret access attempts

**Benefits:**
- Encrypted at rest
- Access controlled via helper function
- Audit trail of access
- Rotation support
- Role-based access control

### Alternative: Environment Variables

For Edge Functions, use environment variables:

```bash
# Set via Supabase CLI
supabase secrets set SERVICE_ROLE_KEY=your-key

# Access in Edge Function
const serviceKey = Deno.env.get('SERVICE_ROLE_KEY');
```

**Benefits:**
- Not stored in database
- Managed by Supabase platform
- Easy rotation

---

## Database Security

### Row Level Security (RLS)

Enable RLS on all tables:

```sql
-- Enable RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Policy: Students can only read their own data
CREATE POLICY "Students can read own data"
  ON students
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy: Service role has full access
CREATE POLICY "Service role full access"
  ON students
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### Function Security

Use `SECURITY DEFINER` carefully:

```sql
-- GOOD: Limited scope, validates input
CREATE OR REPLACE FUNCTION get_student_points(p_student_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate caller has access
  IF auth.uid() != p_student_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  RETURN (SELECT SUM(points) FROM points WHERE student_id = p_student_id);
END;
$$;

-- BAD: Too broad, no validation
CREATE OR REPLACE FUNCTION admin_delete_all()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER  -- ⚠️ Dangerous!
AS $$
BEGIN
  DELETE FROM students;  -- No access control!
END;
$$;
```

### SQL Injection Prevention

Always use parameterized queries:

```typescript
// GOOD: Parameterized query
const { data } = await supabase
  .from('students')
  .select('*')
  .eq('id', studentId);

// BAD: String concatenation
const query = `SELECT * FROM students WHERE id = '${studentId}'`;  // ⚠️ SQL injection risk!
```

---

## API Security

### Authentication

Verify JWT tokens in Edge Functions:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  {
    global: {
      headers: { Authorization: req.headers.get('Authorization')! },
    },
  }
);

// Verify user is authenticated
const { data: { user }, error } = await supabase.auth.getUser();

if (error || !user) {
  return new Response('Unauthorized', { status: 401 });
}
```

### Rate Limiting

Implement rate limiting for public endpoints:

```typescript
// Simple in-memory rate limiter (use Redis in production)
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const limit = rateLimits.get(ip);
  
  if (!limit || now > limit.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (limit.count >= maxRequests) {
    return false;
  }
  
  limit.count++;
  return true;
}

// Usage
const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
if (!checkRateLimit(clientIp, 100, 60000)) {  // 100 requests per minute
  return new Response('Rate limit exceeded', { status: 429 });
}
```

### Input Validation

Validate all user input:

```typescript
// GOOD: Validate input
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateStudentId(id: string): boolean {
  // UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// Usage
if (!validateEmail(email)) {
  return new Response('Invalid email', { status: 400 });
}
```

---

## Data Protection

### Encryption

- **At Rest:** Supabase encrypts all data at rest by default
- **In Transit:** All API calls use HTTPS/TLS
- **Sensitive Fields:** Consider additional encryption for PII

### Data Minimization

Only collect and store necessary data:

```typescript
// GOOD: Minimal data
interface Student {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

// BAD: Excessive data
interface Student {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  ssn: string;           // ⚠️ Don't store unless absolutely necessary
  creditCard: string;    // ⚠️ Never store credit card data
  password: string;      // ⚠️ Use Supabase Auth instead
}
```

### Data Retention

Implement data retention policies:

```sql
-- Delete old sync logs (keep 30 days)
DELETE FROM sync_logs 
WHERE created_at < NOW() - INTERVAL '30 days';

-- Anonymize old attendance records (keep 1 year)
UPDATE attendance 
SET student_id = NULL 
WHERE recorded_at < NOW() - INTERVAL '1 year';
```

---

## Access Control

### Principle of Least Privilege

Grant minimum necessary permissions:

```sql
-- Create read-only role for analytics
CREATE ROLE analytics_readonly;

-- Grant SELECT only on specific tables
GRANT SELECT ON students, attendance, points TO analytics_readonly;

-- Revoke all other permissions
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM analytics_readonly;
```

### Service Accounts

Use separate service accounts for different purposes:

- `service_role` - Full access (use sparingly)
- `sync_job_role` - Sync operations only
- `analytics_role` - Read-only access
- `backup_role` - Backup operations only

---

## Monitoring & Auditing

### Audit Logging

Log sensitive operations:

```sql
-- Create audit log table
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to log updates
CREATE OR REPLACE FUNCTION log_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO audit_log (
    user_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values
  )
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    NEW.id::TEXT,
    row_to_json(OLD),
    row_to_json(NEW)
  );
  
  RETURN NEW;
END;
$$;

-- Apply to sensitive tables
CREATE TRIGGER audit_students
  AFTER UPDATE OR DELETE ON students
  FOR EACH ROW
  EXECUTE FUNCTION log_audit();
```

### Security Monitoring

Monitor for suspicious activity:

```sql
-- Failed login attempts
SELECT 
  COUNT(*) AS failed_attempts,
  ip_address,
  user_agent
FROM auth.audit_log_entries
WHERE action = 'login'
  AND result = 'failure'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY ip_address, user_agent
HAVING COUNT(*) > 5;

-- Unusual data access patterns
SELECT 
  user_id,
  COUNT(*) AS access_count,
  COUNT(DISTINCT table_name) AS tables_accessed
FROM audit_log
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id
HAVING COUNT(*) > 1000;  -- Threshold for suspicious activity
```

---

## Incident Response

### Security Incident Checklist

If a security incident occurs:

1. **Contain**
   - Revoke compromised credentials immediately
   - Block suspicious IP addresses
   - Disable affected accounts

2. **Investigate**
   - Review audit logs
   - Identify scope of breach
   - Document timeline

3. **Remediate**
   - Patch vulnerabilities
   - Rotate all credentials
   - Update security policies

4. **Notify**
   - Inform affected users
   - Report to authorities (if required)
   - Document lessons learned

### Emergency Contacts

- **Supabase Support:** support@supabase.io
- **Security Team:** security@tagtapgo.com
- **On-Call Engineer:** [Phone number]

---

## Compliance

### GDPR

- **Right to Access:** Provide user data export
- **Right to Erasure:** Implement data deletion
- **Data Minimization:** Only collect necessary data
- **Consent:** Obtain explicit consent for data processing

### Data Sovereignty

- Store data in user's region when possible
- Document data flows across borders
- Comply with local data protection laws

---

## Security Checklist

### Development

- [ ] Use Supabase Vault for secrets
- [ ] Enable RLS on all tables
- [ ] Validate all user input
- [ ] Use parameterized queries
- [ ] Implement rate limiting
- [ ] Log security events
- [ ] Review code for vulnerabilities

### Deployment

- [ ] Rotate service role key
- [ ] Enable audit logging
- [ ] Configure firewall rules
- [ ] Set up monitoring alerts
- [ ] Test backup/restore procedures
- [ ] Document security policies

### Operations

- [ ] Monitor audit logs daily
- [ ] Review access permissions weekly
- [ ] Update dependencies monthly
- [ ] Conduct security audits quarterly
- [ ] Test incident response annually

---

## Resources

- [Supabase Security](https://supabase.com/docs/guides/platform/security)
- [Supabase Vault](https://supabase.com/docs/guides/database/vault)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)

---

## Contact

For security concerns or to report vulnerabilities:

- **Email:** security@tagtapgo.com
- **PGP Key:** [Public key]
- **Bug Bounty:** [Program details]
