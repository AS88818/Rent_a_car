/*
  # Fix RLS Policies Comprehensively

  1. Re-enable RLS on vehicles and snags tables
  2. Drop all existing policies
  3. Create proper policies for:
     - Admin: Full access to all branches
     - Manager: Full access to their own branch
     - Staff: Read-only access (to be expanded later)
  
  4. Security Model:
     - All policies use auth.jwt() to get user role and branch_id
     - Admin role bypasses branch restrictions
     - Manager and staff restricted to their branch
*/

-- Re-enable RLS on tables that had it disabled
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE snags ENABLE ROW LEVEL SECURITY;

-- ====================
-- VEHICLES POLICIES
-- ====================

DROP POLICY IF EXISTS "Users can view vehicles in their branch" ON vehicles;
DROP POLICY IF EXISTS "Authenticated users can insert vehicles" ON vehicles;
DROP POLICY IF EXISTS "Authenticated users can update vehicles" ON vehicles;
DROP POLICY IF EXISTS "Authenticated users can delete vehicles" ON vehicles;

CREATE POLICY "Admin can view all vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'admin'
  );

CREATE POLICY "Manager and staff can view vehicles in their branch"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') IN ('manager', 'staff')
    AND branch_id::text = (auth.jwt() ->> 'branch_id')
  );

CREATE POLICY "Admin can insert vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'admin'
  );

CREATE POLICY "Manager can insert vehicles in their branch"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'manager'
    AND branch_id::text = (auth.jwt() ->> 'branch_id')
  );

CREATE POLICY "Admin can update all vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Manager can update vehicles in their branch"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'manager'
    AND branch_id::text = (auth.jwt() ->> 'branch_id')
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'manager'
    AND branch_id::text = (auth.jwt() ->> 'branch_id')
  );

CREATE POLICY "Admin can delete vehicles"
  ON vehicles FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

-- ====================
-- MILEAGE LOGS POLICIES
-- ====================

DROP POLICY IF EXISTS "Users can view mileage logs in their branch" ON mileage_logs;
DROP POLICY IF EXISTS "Users can log mileage in their branch" ON mileage_logs;

CREATE POLICY "Admin can view all mileage logs"
  ON mileage_logs FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Manager and staff can view mileage logs in their branch"
  ON mileage_logs FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') IN ('manager', 'staff')
    AND branch_id::text = (auth.jwt() ->> 'branch_id')
  );

CREATE POLICY "Admin can insert mileage logs"
  ON mileage_logs FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Manager and staff can insert mileage logs in their branch"
  ON mileage_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role') IN ('manager', 'staff')
    AND branch_id::text = (auth.jwt() ->> 'branch_id')
  );

-- ====================
-- MAINTENANCE LOGS POLICIES
-- ====================

DROP POLICY IF EXISTS "Users can view maintenance logs in their branch" ON maintenance_logs;
DROP POLICY IF EXISTS "Users can create maintenance logs in their branch" ON maintenance_logs;

CREATE POLICY "Admin can view all maintenance logs"
  ON maintenance_logs FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Manager and staff can view maintenance logs in their branch"
  ON maintenance_logs FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') IN ('manager', 'staff')
    AND branch_id::text = (auth.jwt() ->> 'branch_id')
  );

CREATE POLICY "Admin can insert maintenance logs"
  ON maintenance_logs FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Manager and staff can insert maintenance logs in their branch"
  ON maintenance_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role') IN ('manager', 'staff')
    AND branch_id::text = (auth.jwt() ->> 'branch_id')
  );

-- ====================
-- SNAGS POLICIES
-- ====================

DROP POLICY IF EXISTS "Users can view snags in their branch" ON snags;
DROP POLICY IF EXISTS "Users can create snags in their branch" ON snags;
DROP POLICY IF EXISTS "Users can update snags in their branch" ON snags;

CREATE POLICY "Admin can view all snags"
  ON snags FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Manager and staff can view snags in their branch"
  ON snags FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') IN ('manager', 'staff')
    AND branch_id::text = (auth.jwt() ->> 'branch_id')
  );

CREATE POLICY "Admin can insert snags"
  ON snags FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Manager and staff can insert snags in their branch"
  ON snags FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role') IN ('manager', 'staff')
    AND branch_id::text = (auth.jwt() ->> 'branch_id')
  );

CREATE POLICY "Admin can update all snags"
  ON snags FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Manager can update snags in their branch"
  ON snags FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'manager'
    AND branch_id::text = (auth.jwt() ->> 'branch_id')
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'manager'
    AND branch_id::text = (auth.jwt() ->> 'branch_id')
  );

-- ====================
-- BOOKINGS POLICIES
-- ====================

DROP POLICY IF EXISTS "Authenticated users can view all bookings" ON bookings;
DROP POLICY IF EXISTS "Authenticated users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Authenticated users can update bookings" ON bookings;
DROP POLICY IF EXISTS "Authenticated users can delete bookings" ON bookings;

CREATE POLICY "Admin can view all bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Manager and staff can view bookings in their branch"
  ON bookings FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') IN ('manager', 'staff')
    AND (branch_id::text = (auth.jwt() ->> 'branch_id') OR branch_id IS NULL)
  );

CREATE POLICY "Admin can insert bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Manager and staff can insert bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role') IN ('manager', 'staff')
  );

CREATE POLICY "Admin can update all bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Manager can update bookings in their branch"
  ON bookings FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'manager'
    AND (branch_id::text = (auth.jwt() ->> 'branch_id') OR branch_id IS NULL)
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'manager'
  );

CREATE POLICY "Admin can delete bookings"
  ON bookings FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

-- ====================
-- CATEGORY PRICING POLICIES
-- ====================

DROP POLICY IF EXISTS "Authenticated users can view category pricing" ON category_pricing;
DROP POLICY IF EXISTS "Authenticated users can update category pricing" ON category_pricing;

CREATE POLICY "All authenticated users can view category pricing"
  ON category_pricing FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert category pricing"
  ON category_pricing FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Admin can update category pricing"
  ON category_pricing FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Admin can delete category pricing"
  ON category_pricing FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

-- ====================
-- SEASON RULES POLICIES
-- ====================

DROP POLICY IF EXISTS "Authenticated users can view season rules" ON season_rules;

CREATE POLICY "All authenticated users can view season rules"
  ON season_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert season rules"
  ON season_rules FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Admin can update season rules"
  ON season_rules FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Admin can delete season rules"
  ON season_rules FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

-- ====================
-- QUOTES POLICIES
-- ====================

DROP POLICY IF EXISTS "Authenticated users can view all quotes" ON quotes;
DROP POLICY IF EXISTS "Authenticated users can create quotes" ON quotes;
DROP POLICY IF EXISTS "Authenticated users can update quotes" ON quotes;
DROP POLICY IF EXISTS "Authenticated users can delete quotes" ON quotes;

CREATE POLICY "Admin can view all quotes"
  ON quotes FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Users can view their own quotes"
  ON quotes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert quotes"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can update all quotes"
  ON quotes FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Users can update their own quotes"
  ON quotes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can delete quotes"
  ON quotes FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Users can delete their own quotes"
  ON quotes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());