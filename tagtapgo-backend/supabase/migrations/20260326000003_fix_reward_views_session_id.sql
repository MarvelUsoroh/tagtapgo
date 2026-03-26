-- Fix reward_views session_id column type
-- Change from UUID to TEXT to support custom session ID formats

ALTER TABLE reward_views 
  ALTER COLUMN session_id TYPE TEXT;

COMMENT ON COLUMN reward_views.session_id IS 'User session identifier for behavior analysis (custom format supported)';
