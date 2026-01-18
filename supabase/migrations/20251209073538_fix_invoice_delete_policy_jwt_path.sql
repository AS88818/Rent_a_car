/*
  # Fix Invoice DELETE Policy JWT Path

  ## Overview
  The invoice DELETE policy was checking `auth.jwt()->>'role'` 
  but it should check `auth.jwt()->'app_metadata'->>'role'` to match
  the other policies (INSERT, SELECT, UPDATE).

  ## Changes
  - Drop existing DELETE policy
  - Recreate with correct JWT path: auth.jwt()->'app_metadata'->>'role'
  
  ## Security
  - Only admin users can delete invoices
  - Uses consistent JWT path across all invoice policies
*/

-- Drop the incorrect DELETE policy
DROP POLICY IF EXISTS "Admin users can delete invoices" ON invoices;

-- Recreate with correct JWT path
CREATE POLICY "Admin users can delete invoices"
  ON invoices
  FOR DELETE
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text
  );
