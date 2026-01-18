/*
  # Fix JWT Paths in All RLS Policies

  1. Problem
    - RLS policies are checking `auth.jwt() ->> 'role'` 
    - But the role is actually at `auth.jwt() -> 'app_metadata' ->> 'role'`
    - This causes "row-level security policy" violations

  2. Changes
    - Drop and recreate all RLS policies with correct JWT paths
    - Vehicles table: UPDATE, DELETE policies
    - Bookings table: INSERT, UPDATE, DELETE, SELECT policies
    
  3. Security
    - Maintains existing access control rules
    - Only fixes the path to access JWT claims correctly
*/

-- ============================================================================
-- VEHICLES TABLE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins and managers can update vehicles" ON vehicles;
DROP POLICY IF EXISTS "Staff can update vehicle health in their branch" ON vehicles;
DROP POLICY IF EXISTS "Admins can delete vehicles" ON vehicles;
DROP POLICY IF EXISTS "Temp: Allow all authenticated updates" ON vehicles;

-- Recreate with correct JWT paths
CREATE POLICY "Admins and managers can update vehicles"
  ON vehicles
  FOR UPDATE
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR (
      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
      AND (
        branch_id = ((auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid)
        OR on_hire = true
      )
    )
  )
  WITH CHECK (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR (
      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
      AND (
        branch_id = ((auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid)
        OR on_hire = true
      )
    )
  );

CREATE POLICY "Staff can update vehicle health in their branch"
  ON vehicles
  FOR UPDATE
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff')
    AND (
      branch_id = ((auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid)
      OR on_hire = true
    )
  )
  WITH CHECK (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff')
    AND (
      branch_id = ((auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid)
      OR on_hire = true
    )
  );

CREATE POLICY "Admins can delete vehicles"
  ON vehicles
  FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ============================================================================
-- BOOKINGS TABLE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can insert bookings" ON bookings;
DROP POLICY IF EXISTS "Authenticated users can update bookings" ON bookings;
DROP POLICY IF EXISTS "Authenticated users can view bookings" ON bookings;
DROP POLICY IF EXISTS "Admin can delete bookings" ON bookings;
DROP POLICY IF EXISTS "Temp: Allow all authenticated inserts" ON bookings;

-- Recreate with correct JWT paths
CREATE POLICY "Authenticated users can insert bookings"
  ON bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR ((auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['manager', 'staff']))
  );

CREATE POLICY "Authenticated users can update bookings"
  ON bookings
  FOR UPDATE
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR (
      ((auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['manager', 'staff']))
      AND (((auth.jwt() -> 'app_metadata' ->> 'branch_id'))::uuid = branch_id)
    )
  )
  WITH CHECK (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR (
      ((auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['manager', 'staff']))
      AND (((auth.jwt() -> 'app_metadata' ->> 'branch_id'))::uuid = branch_id)
    )
  );

CREATE POLICY "Authenticated users can view bookings"
  ON bookings
  FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR (((auth.jwt() -> 'app_metadata' ->> 'branch_id'))::uuid = branch_id)
  );

CREATE POLICY "Admin can delete bookings"
  ON bookings
  FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
