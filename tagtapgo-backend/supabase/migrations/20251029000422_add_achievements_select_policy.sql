-- Add RLS policy to allow authenticated users to view all achievements
-- This is needed for the RecentAchievements component to fetch achievement details

-- Policy: Authenticated users can view all achievements
CREATE POLICY "Authenticated users can view all achievements"
  ON public.achievements
  FOR SELECT
  TO authenticated
  USING (true);

-- Verify the policy was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE tablename = 'achievements' 
      AND policyname = 'Authenticated users can view all achievements'
  ) THEN
    RAISE NOTICE 'Policy created successfully';
  ELSE
    RAISE WARNING 'Policy creation failed';
  END IF;
END $$;

COMMENT ON TABLE public.achievements IS 'Achievement definitions. RLS policy added 2025-10-29 to allow authenticated users to view all achievements.';
