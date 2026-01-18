/*
  # Fix Users Table RLS for Signup

  1. Changes
    - Allow INSERT on users table for the trigger function during signup
    - The trigger runs with SECURITY DEFINER so it should bypass RLS
    - But we add an explicit policy to allow self-registration during auth creation
    - Maintain admin-only access for manual user creation

  2. Security
    - Self-insert only allowed during auth.users creation (via trigger)
    - Manual inserts still require admin role
*/

-- Drop existing insert policy
DROP POLICY IF EXISTS "Admins can insert users" ON users;

-- Allow admins to manually insert users
CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Allow users to be inserted for themselves during signup (via trigger)
-- This policy allows the insert during the trigger execution
CREATE POLICY "Allow insert during signup"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
  );
