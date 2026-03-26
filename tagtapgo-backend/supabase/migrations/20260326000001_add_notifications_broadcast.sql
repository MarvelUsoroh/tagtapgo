-- ============================================================================
-- Add Notifications to Unified Realtime Broadcast
-- ============================================================================
-- Purpose:
--   Extend the unified broadcast pattern to include notifications table
--   This is a follow-up to 20260326000000_unified_realtime_broadcast.sql
-- ============================================================================

-- Update the generic broadcast function to handle notifications
CREATE OR REPLACE FUNCTION public.broadcast_user_update()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  user_id UUID;
  event_name TEXT;
BEGIN
  -- Determine user_id based on table
  IF TG_TABLE_NAME = 'attendance' THEN
    user_id := COALESCE(NEW.student_id, OLD.student_id);
  ELSIF TG_TABLE_NAME = 'points' THEN
    user_id := COALESCE(NEW.student_id, OLD.student_id);
  ELSIF TG_TABLE_NAME = 'streaks' THEN
    user_id := COALESCE(NEW.student_id, OLD.student_id);
  ELSIF TG_TABLE_NAME = 'student_achievements' THEN
    user_id := COALESCE(NEW.student_id, OLD.student_id);
  ELSIF TG_TABLE_NAME = 'leaderboards' THEN
    user_id := COALESCE(NEW.student_id, OLD.student_id);
  ELSIF TG_TABLE_NAME = 'notifications' THEN
    user_id := COALESCE(NEW.student_id, OLD.student_id);
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Build event name: table_operation (e.g., points_insert, attendance_update)
  event_name := TG_TABLE_NAME || '_' || lower(TG_OP);

  -- Broadcast to user-specific topic
  PERFORM realtime.broadcast_changes(
    'user:' || user_id::text || ':updates',
    TG_OP,
    event_name,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Add trigger for notifications
DROP TRIGGER IF EXISTS notifications_realtime_trigger ON public.notifications;
CREATE TRIGGER notifications_realtime_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_user_update();

-- Completion notice
DO $$
BEGIN
  RAISE NOTICE '✓ Notifications added to unified realtime broadcast';
  RAISE NOTICE '→ Trigger added: notifications';
END $$;
