/*
  # Allow all authenticated users to view other users

  1. Changes
    - Add policy to allow all authenticated users to view all users
    - This is needed for assignment dropdowns where users need to see other users

  2. Security
    - Still maintains authentication requirement
    - Only allows SELECT (read) operations
    - Does not allow modification of other users' data
*/

-- Drop the restrictive policy that only allows users to view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON users;

-- Create a new policy that allows all authenticated users to view all users
CREATE POLICY "Authenticated users can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (true);