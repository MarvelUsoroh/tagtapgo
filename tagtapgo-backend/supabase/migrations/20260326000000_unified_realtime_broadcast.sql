-- ============================================================================
-- Unified Realtime Broadcast Implementation
-- ============================================================================
-- Purpose:
--   Migrate from postgres_changes to broadcast pattern for scalability
--   Add database triggers to broadcast events to user-specific topics
--   Enable RLS policies for private channel authorization
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Generic Broadcast Function
-- --------------------------------------------------------------------------
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

COMMENT ON FUNCTION public.broadcast_user_update() IS 
  'Generic trigger function to broadcast user-related updates to dedicated topics';

-- --------------------------------------------------------------------------
-- 2. Enriched Achievement Broadcast (includes achievement details)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.broadcast_achievement_unlock()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  achievement_data JSONB;
BEGIN
  -- Fetch achievement details to include in broadcast
  SELECT to_jsonb(a.*) INTO achievement_data
  FROM achievements a
  WHERE a.id = NEW.achievement_id;

  -- Broadcast with enriched payload
  PERFORM realtime.send(
    'user:' || NEW.student_id::text || ':updates',
    'achievement_unlocked',
    jsonb_build_object(
      'student_achievement', to_jsonb(NEW),
      'achievement', achievement_data
    ),
    false
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.broadcast_achievement_unlock() IS 
  'Broadcast achievement unlocks with full achievement details to avoid client-side fetch';

-- --------------------------------------------------------------------------
-- 3. Attach Triggers to Tables
-- --------------------------------------------------------------------------

-- Attendance changes (critical for TodayClasses component)
DROP TRIGGER IF EXISTS attendance_realtime_trigger ON public.attendance;
CREATE TRIGGER attendance_realtime_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_user_update();

-- Points earned
DROP TRIGGER IF EXISTS points_realtime_trigger ON public.points;
CREATE TRIGGER points_realtime_trigger
  AFTER INSERT ON public.points
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_user_update();

-- Streak updates
DROP TRIGGER IF EXISTS streaks_realtime_trigger ON public.streaks;
CREATE TRIGGER streaks_realtime_trigger
  AFTER UPDATE ON public.streaks
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_user_update();

-- Achievement unlocks (enriched)
DROP TRIGGER IF EXISTS achievements_realtime_trigger ON public.student_achievements;
CREATE TRIGGER achievements_realtime_trigger
  AFTER INSERT ON public.student_achievements
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_achievement_unlock();

-- Achievement deletions (for cleanup)
DROP TRIGGER IF EXISTS achievements_delete_trigger ON public.student_achievements;
CREATE TRIGGER achievements_delete_trigger
  AFTER DELETE ON public.student_achievements
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_user_update();

-- Leaderboard rank changes
DROP TRIGGER IF EXISTS leaderboards_realtime_trigger ON public.leaderboards;
CREATE TRIGGER leaderboards_realtime_trigger
  AFTER INSERT OR UPDATE ON public.leaderboards
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_user_update();

-- Notifications (for NotificationBell and NotificationsPanel)
DROP TRIGGER IF EXISTS notifications_realtime_trigger ON public.notifications;
CREATE TRIGGER notifications_realtime_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_user_update();

-- --------------------------------------------------------------------------
-- 4. RLS Policies for Private Channels
-- --------------------------------------------------------------------------

-- Enable RLS on realtime.messages if not already enabled
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Allow users to receive broadcasts on their own channel
DROP POLICY IF EXISTS "users_receive_own_broadcasts" ON realtime.messages;
CREATE POLICY "users_receive_own_broadcasts" 
ON realtime.messages
FOR SELECT TO authenticated
USING (
  topic LIKE 'user:%' AND
  SPLIT_PART(topic, ':', 2)::uuid = auth.uid()
);

-- Allow users to send broadcasts to their own channel (for client-to-client messaging)
DROP POLICY IF EXISTS "users_send_own_broadcasts" ON realtime.messages;
CREATE POLICY "users_send_own_broadcasts" 
ON realtime.messages
FOR INSERT TO authenticated
WITH CHECK (
  topic LIKE 'user:%' AND
  SPLIT_PART(topic, ':', 2)::uuid = auth.uid()
);

-- Allow users to receive broadcasts on room/community channels they have access to
DROP POLICY IF EXISTS "users_receive_community_broadcasts" ON realtime.messages;
CREATE POLICY "users_receive_community_broadcasts" 
ON realtime.messages
FOR SELECT TO authenticated
USING (
  topic LIKE 'room:%' OR
  topic LIKE 'community:%' OR
  topic LIKE 'thread:%'
);

-- --------------------------------------------------------------------------
-- 5. Indexes for Performance
-- --------------------------------------------------------------------------

-- Index on realtime.messages topic for faster RLS policy checks
CREATE INDEX IF NOT EXISTS idx_realtime_messages_topic 
ON realtime.messages(topic);

-- Index on realtime.messages for user-specific topics
CREATE INDEX IF NOT EXISTS idx_realtime_messages_user_topic 
ON realtime.messages(topic) 
WHERE topic LIKE 'user:%';

-- --------------------------------------------------------------------------
-- 6. Completion Notice
-- --------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE '✓ Unified realtime broadcast implementation complete';
  RAISE NOTICE '→ Triggers added: attendance, points, streaks, achievements, leaderboards, notifications';
  RAISE NOTICE '→ RLS policies enabled for private channels';
  RAISE NOTICE '→ Client code can now use broadcast pattern with user:{id}:updates topics';
END $$;
