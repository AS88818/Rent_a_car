/*
  # Fix JWT Paths in Maintenance Logs RLS Policies

  1. Problem
    - Maintenance logs policies are checking `auth.jwt() ->> 'role'` 
    - But the role is actually at `auth.jwt() -> 'app_metadata' ->> 'role'`
    - Same issue with branch_id
    - This causes "row-level security policy" violations

  2. Changes
    - Drop all existing maintenance_logs policies
    - Recreate with correct JWT paths for role and branch_id
    - Includes SELECT, INSERT, UPDATE, and DELETE policies
    
  3. Security
    - Admin can access all maintenance logs
    - Managers can access logs in their branch
    - Staff can view logs in their branch
    - Maintains existing access control rules
*/

-- Drop existing maintenance_logs policies
DROP POLICY IF EXISTS "Authenticated users can view maintenance logs" ON maintenance_logs;
DROP POLICY IF EXISTS "Authenticated users can insert maintenance logs" ON maintenance_logs;
DROP POLICY IF EXISTS "Authenticated users can update maintenance logs" ON maintenance_logs;
DROP POLICY IF EXISTS "Admin can delete maintenance logs" ON maintenance_logs;

-- Recreate with correct JWT paths
CREATE POLICY "Authenticated users can view maintenance logs"
  ON maintenance_logs
  FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR (
      ((auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['manager', 'staff']))
      AND (branch_id = ((auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid))
    )
  );

CREATE POLICY "Authenticated users can insert maintenance logs"
  ON maintenance_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR (
      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
      AND (branch_id = ((auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid))
    )
  );

CREATE POLICY "Authenticated users can update maintenance logs"
  ON maintenance_logs
  FOR UPDATE
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR (
      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
      AND (branch_id = ((auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid))
    )
  )
  WITH CHECK (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR (
      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
      AND (branch_id = ((auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid))
    )
  );

CREATE POLICY "Admin can delete maintenance logs"
  ON maintenance_logs
  FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
