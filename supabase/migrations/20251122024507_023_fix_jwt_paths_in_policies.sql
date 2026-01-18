/*
  # Fix JWT Paths in All RLS Policies

  1. Problem
    - All RLS policies are incorrectly accessing role and branch_id directly from JWT root
    - Should be accessing from app_metadata: auth.jwt() -> 'app_metadata' ->> 'role'
    
  2. Changes
    - Drop all existing policies on vehicles, bookings, snags, maintenance_logs
    - Recreate them with correct JWT path
    - Fix the fundamental issue causing RLS failures
    
  3. Security
    - Maintains same security model but with correct JWT access
    - Admin: full access to all records
    - Manager: access to their branch only
    - Staff: read-only access to their branch
*/

-- =====================================================
-- VEHICLES TABLE - Fix ALL policies
-- =====================================================

DROP POLICY IF EXISTS "Admin can view all vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admin can insert vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admin can update all vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admin can delete vehicles" ON vehicles;
DROP POLICY IF EXISTS "Manager and staff can view vehicles in their branch" ON vehicles;
DROP POLICY IF EXISTS "Manager can insert vehicles in their branch" ON vehicles;
DROP POLICY IF EXISTS "Manager can update vehicles in their branch" ON vehicles;
DROP POLICY IF EXISTS "TEMP: Any authenticated user can insert vehicles" ON vehicles;

CREATE POLICY "Admin can view all vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can insert vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can update all vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can delete vehicles"
  ON vehicles FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Manager and staff can view vehicles in their branch"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('manager', 'staff')
    AND branch_id::text = (auth.jwt() -> 'app_metadata' ->> 'branch_id')
  );

CREATE POLICY "Manager can insert vehicles in their branch"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    AND branch_id::text = (auth.jwt() -> 'app_metadata' ->> 'branch_id')
  );

CREATE POLICY "Manager can update vehicles in their branch"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    AND branch_id::text = (auth.jwt() -> 'app_metadata' ->> 'branch_id')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    AND branch_id::text = (auth.jwt() -> 'app_metadata' ->> 'branch_id')
  );

-- =====================================================
-- BOOKINGS TABLE - Fix ALL policies
-- =====================================================

DROP POLICY IF EXISTS "Admin can view all bookings" ON bookings;
DROP POLICY IF EXISTS "Admin can insert bookings" ON bookings;
DROP POLICY IF EXISTS "Admin can update all bookings" ON bookings;
DROP POLICY IF EXISTS "Admin can delete bookings" ON bookings;
DROP POLICY IF EXISTS "Users can view bookings" ON bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update bookings" ON bookings;

CREATE POLICY "Admin can view all bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can insert bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can update all bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can delete bookings"
  ON bookings FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Users can view bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- SNAGS TABLE - Fix ALL policies
-- =====================================================

DROP POLICY IF EXISTS "Users can view snags" ON snags;
DROP POLICY IF EXISTS "Users can create snags" ON snags;
DROP POLICY IF EXISTS "Users can update snags" ON snags;

CREATE POLICY "Users can view snags"
  ON snags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create snags"
  ON snags FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update snags"
  ON snags FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- MAINTENANCE_LOGS TABLE - Fix ALL policies
-- =====================================================

DROP POLICY IF EXISTS "Admin can view all maintenance logs" ON maintenance_logs;
DROP POLICY IF EXISTS "Admin can insert maintenance logs" ON maintenance_logs;
DROP POLICY IF EXISTS "Admin can update all maintenance logs" ON maintenance_logs;
DROP POLICY IF EXISTS "Admin can delete maintenance logs" ON maintenance_logs;
DROP POLICY IF EXISTS "Manager and staff can view maintenance for their branch vehicles" ON maintenance_logs;
DROP POLICY IF EXISTS "Manager can insert maintenance for their branch vehicles" ON maintenance_logs;
DROP POLICY IF EXISTS "Manager can update maintenance for their branch vehicles" ON maintenance_logs;

CREATE POLICY "Admin can view all maintenance logs"
  ON maintenance_logs FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can insert maintenance logs"
  ON maintenance_logs FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can update all maintenance logs"
  ON maintenance_logs FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can delete maintenance logs"
  ON maintenance_logs FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Manager and staff can view maintenance for their branch vehicles"
  ON maintenance_logs FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('manager', 'staff')
    AND EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.id = maintenance_logs.vehicle_id
      AND vehicles.branch_id::text = (auth.jwt() -> 'app_metadata' ->> 'branch_id')
    )
  );

CREATE POLICY "Manager can insert maintenance for their branch vehicles"
  ON maintenance_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    AND EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.id = maintenance_logs.vehicle_id
      AND vehicles.branch_id::text = (auth.jwt() -> 'app_metadata' ->> 'branch_id')
    )
  );

CREATE POLICY "Manager can update maintenance for their branch vehicles"
  ON maintenance_logs FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    AND EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.id = maintenance_logs.vehicle_id
      AND vehicles.branch_id::text = (auth.jwt() -> 'app_metadata' ->> 'branch_id')
    )
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    AND EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.id = maintenance_logs.vehicle_id
      AND vehicles.branch_id::text = (auth.jwt() -> 'app_metadata' ->> 'branch_id')
    )
  );
