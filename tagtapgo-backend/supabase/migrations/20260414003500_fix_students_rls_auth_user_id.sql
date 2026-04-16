-- Fix RLS policies to use auth_user_id instead of id
-- The 'id' column is the student ID (UUID), not the auth user ID
-- The 'auth_user_id' column links to auth.users(id)

-- Drop old policies that incorrectly checked auth.uid() = id
DROP POLICY IF EXISTS "Students can view own data" ON students;
DROP POLICY IF EXISTS "Students can update own data" ON students;

-- Create new policies with correct auth_user_id check
CREATE POLICY "Students can view own data" 
  ON students 
  FOR SELECT 
  TO public 
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Students can update own data" 
  ON students 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = auth_user_id) 
  WITH CHECK (auth.uid() = auth_user_id);
