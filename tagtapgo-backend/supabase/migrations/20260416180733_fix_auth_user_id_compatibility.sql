-- Fix RLS policies to support both legacy users (where auth.uid() = students.id) 
-- and new invited users (where auth.uid() = students.auth_user_id)

-- Drop the policies recently created that restricted access only to auth_user_id
DROP POLICY IF EXISTS "Students can view own data" ON students;
DROP POLICY IF EXISTS "Students can update own data" ON students;

-- Create hybrid policies
CREATE POLICY "Students can view own data" 
  ON students 
  FOR SELECT 
  TO public 
  USING (auth.uid() = auth_user_id OR auth.uid() = id);

CREATE POLICY "Students can update own data" 
  ON students 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = auth_user_id OR auth.uid() = id) 
  WITH CHECK (auth.uid() = auth_user_id OR auth.uid() = id);

-- Backfill auth_user_id for legacy users so the system converges on using auth_user_id over time
UPDATE students 
SET auth_user_id = id 
WHERE auth_user_id IS NULL 
  AND id IN (SELECT id FROM auth.users);