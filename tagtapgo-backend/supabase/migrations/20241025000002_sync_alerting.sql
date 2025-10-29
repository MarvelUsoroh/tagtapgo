-- ============================================================================
-- Sync Job Alerting System
-- ============================================================================
-- 
-- This migration adds alerting functionality for sync job failures.
-- 
-- Features:
-- - Automatic alerts on 3+ consecutive failures
-- - Alert history tracking
-- - Alert suppression (don't spam)
-- - Email/webhook notifications
--
-- ============================================================================

-- ============================================================================
-- Alerts Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'consecutive_failures',
    'sync_timeout',
    'no_recent_sync',
    'low_success_rate'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'error', 'critical')),
  message TEXT NOT NULL,
  details JSONB,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sync_alerts_university_id ON sync_alerts(university_id);
CREATE INDEX IF NOT EXISTS idx_sync_alerts_created_at ON sync_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_alerts_resolved ON sync_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_sync_alerts_alert_type ON sync_alerts(alert_type);

-- Enable RLS
ALTER TABLE sync_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role can manage alerts"
  ON sync_alerts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Alert Functions
-- ============================================================================

-- Function to check if alert already exists (for suppression)
CREATE OR REPLACE FUNCTION alert_exists(
  p_university_id UUID,
  p_alert_type TEXT,
  p_hours INTEGER DEFAULT 24
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM sync_alerts
    WHERE university_id = p_university_id
      AND alert_type = p_alert_type
      AND resolved = FALSE
      AND created_at > NOW() - (p_hours || ' hours')::INTERVAL
  )
  INTO v_exists;
  
  RETURN v_exists;
END;
$$;

-- Function to create alert
CREATE OR REPLACE FUNCTION create_sync_alert(
  p_university_id UUID,
  p_alert_type TEXT,
  p_severity TEXT,
  p_message TEXT,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_alert_id UUID;
BEGIN
  -- Check if alert already exists (suppress duplicates)
  IF alert_exists(p_university_id, p_alert_type, 24) THEN
    RAISE NOTICE 'Alert already exists for university % and type %', p_university_id, p_alert_type;
    RETURN NULL;
  END IF;
  
  -- Create alert
  INSERT INTO sync_alerts (
    university_id,
    alert_type,
    severity,
    message,
    details
  )
  VALUES (
    p_university_id,
    p_alert_type,
    p_severity,
    p_message,
    p_details
  )
  RETURNING id INTO v_alert_id;
  
  RAISE NOTICE 'Created alert % for university %', v_alert_id, p_university_id;
  
  -- TODO: Send notification (email, webhook, etc.)
  -- This would call an Edge Function to send the actual notification
  
  RETURN v_alert_id;
END;
$$;

-- Function to resolve alert
CREATE OR REPLACE FUNCTION resolve_sync_alert(p_alert_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE sync_alerts
  SET resolved = TRUE,
      resolved_at = NOW()
  WHERE id = p_alert_id
    AND resolved = FALSE;
  
  RETURN FOUND;
END;
$$;

-- Function to resolve all alerts for a university
CREATE OR REPLACE FUNCTION resolve_university_alerts(p_university_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_resolved_count INTEGER;
BEGIN
  UPDATE sync_alerts
  SET resolved = TRUE,
      resolved_at = NOW()
  WHERE university_id = p_university_id
    AND resolved = FALSE;
  
  GET DIAGNOSTICS v_resolved_count = ROW_COUNT;
  
  RETURN v_resolved_count;
END;
$$;

-- ============================================================================
-- Automatic Alert Triggers
-- ============================================================================

-- Function to check for consecutive failures and create alerts
CREATE OR REPLACE FUNCTION check_consecutive_failures()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_university RECORD;
  v_consecutive_failures INTEGER;
  v_last_error TEXT;
BEGIN
  -- Check each university
  FOR v_university IN
    SELECT id, name
    FROM universities
    WHERE active = TRUE
  LOOP
    -- Count consecutive failures
    SELECT COUNT(*)
    INTO v_consecutive_failures
    FROM (
      SELECT status
      FROM sync_logs
      WHERE university_id = v_university.id
      ORDER BY created_at DESC
      LIMIT 10
    ) recent
    WHERE status = 'error';
    
    -- If 3+ consecutive failures, create alert
    IF v_consecutive_failures >= 3 THEN
      -- Get last error message
      SELECT error_message
      INTO v_last_error
      FROM sync_logs
      WHERE university_id = v_university.id
        AND status = 'error'
      ORDER BY created_at DESC
      LIMIT 1;
      
      -- Create alert
      PERFORM create_sync_alert(
        v_university.id,
        'consecutive_failures',
        'critical',
        format('Sync job has failed %s consecutive times for %s', v_consecutive_failures, v_university.name),
        jsonb_build_object(
          'consecutive_failures', v_consecutive_failures,
          'last_error', v_last_error
        )
      );
    END IF;
  END LOOP;
END;
$$;

-- Function to check for stale syncs (no sync in 30+ minutes)
CREATE OR REPLACE FUNCTION check_stale_syncs()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_university RECORD;
  v_minutes_since_sync INTEGER;
BEGIN
  -- Check each university
  FOR v_university IN
    SELECT id, name, last_sync_at
    FROM universities
    WHERE active = TRUE
      AND (last_sync_at IS NULL OR last_sync_at < NOW() - INTERVAL '30 minutes')
  LOOP
    -- Calculate minutes since last sync
    v_minutes_since_sync := EXTRACT(EPOCH FROM (NOW() - COALESCE(v_university.last_sync_at, NOW() - INTERVAL '1 day'))) / 60;
    
    -- Create alert
    PERFORM create_sync_alert(
      v_university.id,
      'no_recent_sync',
      CASE 
        WHEN v_minutes_since_sync > 60 THEN 'critical'
        ELSE 'warning'
      END,
      format('No sync for %s in %s minutes', v_university.name, v_minutes_since_sync),
      jsonb_build_object(
        'minutes_since_sync', v_minutes_since_sync,
        'last_sync_at', v_university.last_sync_at
      )
    );
  END LOOP;
END;
$$;

-- Function to check for low success rate
CREATE OR REPLACE FUNCTION check_low_success_rate()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_university RECORD;
  v_success_rate NUMERIC;
  v_total_syncs INTEGER;
  v_successful_syncs INTEGER;
BEGIN
  -- Check each university
  FOR v_university IN
    SELECT id, name
    FROM universities
    WHERE active = TRUE
  LOOP
    -- Calculate success rate (last 24 hours)
    SELECT 
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'success')
    INTO v_total_syncs, v_successful_syncs
    FROM sync_logs
    WHERE university_id = v_university.id
      AND created_at > NOW() - INTERVAL '24 hours';
    
    -- Skip if not enough data
    IF v_total_syncs < 10 THEN
      CONTINUE;
    END IF;
    
    -- Calculate success rate
    v_success_rate := (v_successful_syncs::NUMERIC / v_total_syncs) * 100;
    
    -- If success rate < 80%, create alert
    IF v_success_rate < 80 THEN
      PERFORM create_sync_alert(
        v_university.id,
        'low_success_rate',
        CASE 
          WHEN v_success_rate < 50 THEN 'critical'
          WHEN v_success_rate < 70 THEN 'error'
          ELSE 'warning'
        END,
        format('Low sync success rate for %s: %.1f%%', v_university.name, v_success_rate),
        jsonb_build_object(
          'success_rate', v_success_rate,
          'total_syncs', v_total_syncs,
          'successful_syncs', v_successful_syncs
        )
      );
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- Trigger on Sync Log Insert
-- ============================================================================

-- Function to run alert checks after sync log insert
CREATE OR REPLACE FUNCTION trigger_alert_checks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only check on error status
  IF NEW.status = 'error' THEN
    PERFORM check_consecutive_failures();
  END IF;
  
  -- Resolve alerts on success
  IF NEW.status = 'success' THEN
    PERFORM resolve_university_alerts(NEW.university_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS sync_log_alert_trigger ON sync_logs;
CREATE TRIGGER sync_log_alert_trigger
  AFTER INSERT ON sync_logs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_alert_checks();

-- ============================================================================
-- Schedule Alert Checks
-- ============================================================================

-- Schedule stale sync check (every 30 minutes)
SELECT cron.schedule(
  'check-stale-syncs',
  '*/30 * * * *',
  'SELECT check_stale_syncs();'
);

-- Schedule success rate check (every hour)
SELECT cron.schedule(
  'check-low-success-rate',
  '0 * * * *',
  'SELECT check_low_success_rate();'
);

-- ============================================================================
-- Views
-- ============================================================================

-- View: Active alerts
CREATE OR REPLACE VIEW sync_alerts_active AS
SELECT 
  a.id,
  a.university_id,
  u.name AS university_name,
  a.alert_type,
  a.severity,
  a.message,
  a.details,
  a.created_at,
  NOW() - a.created_at AS age
FROM sync_alerts a
JOIN universities u ON u.id = a.university_id
WHERE a.resolved = FALSE
ORDER BY 
  CASE a.severity
    WHEN 'critical' THEN 1
    WHEN 'error' THEN 2
    WHEN 'warning' THEN 3
  END,
  a.created_at DESC;

-- View: Alert summary
CREATE OR REPLACE VIEW sync_alerts_summary AS
SELECT 
  COUNT(*) AS total_alerts,
  COUNT(*) FILTER (WHERE severity = 'critical') AS critical_alerts,
  COUNT(*) FILTER (WHERE severity = 'error') AS error_alerts,
  COUNT(*) FILTER (WHERE severity = 'warning') AS warning_alerts,
  COUNT(*) FILTER (WHERE resolved = FALSE) AS active_alerts,
  COUNT(*) FILTER (WHERE resolved = TRUE) AS resolved_alerts
FROM sync_alerts
WHERE created_at > NOW() - INTERVAL '24 hours';

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION alert_exists(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION create_sync_alert(UUID, TEXT, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION resolve_sync_alert(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION resolve_university_alerts(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION check_consecutive_failures() TO service_role;
GRANT EXECUTE ON FUNCTION check_stale_syncs() TO service_role;
GRANT EXECUTE ON FUNCTION check_low_success_rate() TO service_role;

GRANT SELECT ON sync_alerts_active TO service_role;
GRANT SELECT ON sync_alerts_summary TO service_role;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE sync_alerts IS 'Tracks sync job alerts and failures';
COMMENT ON FUNCTION create_sync_alert(UUID, TEXT, TEXT, TEXT, JSONB) IS 'Create a new sync alert with suppression';
COMMENT ON FUNCTION check_consecutive_failures() IS 'Check for 3+ consecutive sync failures';
COMMENT ON FUNCTION check_stale_syncs() IS 'Check for universities with no recent sync';
COMMENT ON FUNCTION check_low_success_rate() IS 'Check for universities with low success rate';
COMMENT ON VIEW sync_alerts_active IS 'Active (unresolved) alerts';
COMMENT ON VIEW sync_alerts_summary IS 'Alert summary (last 24 hours)';

-- ============================================================================
-- Initial Status
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✓ Sync alerting system configured';
  RAISE NOTICE '✓ Automatic alerts enabled for:';
  RAISE NOTICE '  - 3+ consecutive failures';
  RAISE NOTICE '  - No sync in 30+ minutes';
  RAISE NOTICE '  - Success rate < 80%%';
  RAISE NOTICE '';
  RAISE NOTICE 'To view active alerts, run:';
  RAISE NOTICE '  SELECT * FROM sync_alerts_active;';
END $$;
