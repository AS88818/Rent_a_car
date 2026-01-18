/*
  # Fix JWT Paths in Invoice RLS Policies

  1. Problem
    - Invoice policies are checking `auth.jwt() ->> 'role'` 
    - But the role is actually at `auth.jwt() -> 'app_metadata' ->> 'role'`
    - This causes "row-level security policy" violations

  2. Changes
    - Drop all existing invoice policies
    - Recreate with correct JWT paths
    - Includes SELECT, INSERT, and UPDATE policies
    
  3. Security
    - Only admin and manager roles can access invoices
    - Maintains existing access control rules
*/

-- Drop existing invoice policies
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can create invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can update invoices" ON invoices;

-- Recreate with correct JWT paths
CREATE POLICY "Authenticated users can view invoices"
  ON invoices
  FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  );

CREATE POLICY "Authenticated users can create invoices"
  ON invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  );

CREATE POLICY "Authenticated users can update invoices"
  ON invoices
  FOR UPDATE
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  )
  WITH CHECK (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  );
