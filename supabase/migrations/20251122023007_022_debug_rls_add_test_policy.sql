/*
  # Debug RLS - Add Test Policy

  1. Temporary Changes
    - Add a test policy to allow any authenticated user to insert vehicles
    - This will help us determine if the issue is authentication or policy logic
  
  2. Notes
    - This is for debugging only
    - Will be removed once we identify the root cause
*/

-- Add a temporary catch-all policy for INSERT
CREATE POLICY "TEMP: Any authenticated user can insert vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
