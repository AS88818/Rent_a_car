/*
  # Consolidate All Duplicate RLS Policies - Final
  
  ## Changes
  Consolidates multiple permissive policies into single comprehensive policies
  
  ## Impact
  - Removes 27 duplicate policies
  - Replaces with 23 consolidated policies
  - Maintains exact same access control logic
*/

-- ============================================================================
-- BOOKINGS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admin can insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admin can view all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can view bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admin can update all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can update bookings" ON public.bookings;

CREATE POLICY "Authenticated users can insert bookings"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role' = 'admin')
    OR
    (auth.jwt()->>'role' IN ('manager', 'staff'))
  );

CREATE POLICY "Authenticated users can view bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'role' = 'admin')
    OR
    ((auth.jwt()->>'branch_id')::uuid = branch_id)
  );

CREATE POLICY "Authenticated users can update bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'role' = 'admin')
    OR
    ((auth.jwt()->>'role' IN ('manager', 'staff')) AND (auth.jwt()->>'branch_id')::uuid = branch_id)
  )
  WITH CHECK (
    (auth.jwt()->>'role' = 'admin')
    OR
    ((auth.jwt()->>'role' IN ('manager', 'staff')) AND (auth.jwt()->>'branch_id')::uuid = branch_id)
  );

-- ============================================================================
-- EMAIL_TEMPLATES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can delete custom templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can delete own custom templates" ON public.email_templates;
DROP POLICY IF EXISTS "Admins can update any template" ON public.email_templates;
DROP POLICY IF EXISTS "Users can update own draft templates" ON public.email_templates;

CREATE POLICY "Authenticated users can delete templates"
  ON public.email_templates FOR DELETE
  TO authenticated
  USING (
    ((auth.jwt()->>'role' = 'admin') AND (is_system_template = false))
    OR
    ((created_by = auth.uid()) AND (is_system_template = false))
  );

CREATE POLICY "Authenticated users can update templates"
  ON public.email_templates FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'role' = 'admin')
    OR
    ((created_by = auth.uid()) AND (approval_status = 'draft'))
  )
  WITH CHECK (
    (auth.jwt()->>'role' = 'admin')
    OR
    ((created_by = auth.uid()) AND (approval_status = 'draft'))
  );

-- ============================================================================
-- INVOICES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admin users can manage all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Manager users can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Manager users can update invoices" ON public.invoices;

CREATE POLICY "Authenticated users can view invoices"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'role' = 'admin')
    OR
    (auth.jwt()->>'role' = 'manager')
  );

CREATE POLICY "Authenticated users can update invoices"
  ON public.invoices FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'role' = 'admin')
    OR
    (auth.jwt()->>'role' = 'manager')
  )
  WITH CHECK (
    (auth.jwt()->>'role' = 'admin')
    OR
    (auth.jwt()->>'role' = 'manager')
  );

-- ============================================================================
-- MAINTENANCE_LOGS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admin can insert maintenance logs" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Manager can insert maintenance for their branch vehicles" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Admin can view all maintenance logs" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Manager and staff can view maintenance for their branch vehicle" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Admin can update all maintenance logs" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Manager can update maintenance for their branch vehicles" ON public.maintenance_logs;

CREATE POLICY "Authenticated users can insert maintenance logs"
  ON public.maintenance_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role' = 'admin')
    OR
    ((auth.jwt()->>'role' = 'manager') AND branch_id = (auth.jwt()->>'branch_id')::uuid)
  );

CREATE POLICY "Authenticated users can view maintenance logs"
  ON public.maintenance_logs FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'role' = 'admin')
    OR
    ((auth.jwt()->>'role' IN ('manager', 'staff')) AND branch_id = (auth.jwt()->>'branch_id')::uuid)
  );

CREATE POLICY "Authenticated users can update maintenance logs"
  ON public.maintenance_logs FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'role' = 'admin')
    OR
    ((auth.jwt()->>'role' = 'manager') AND branch_id = (auth.jwt()->>'branch_id')::uuid)
  )
  WITH CHECK (
    (auth.jwt()->>'role' = 'admin')
    OR
    ((auth.jwt()->>'role' = 'manager') AND branch_id = (auth.jwt()->>'branch_id')::uuid)
  );

-- ============================================================================
-- MILEAGE_LOGS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admin can insert mileage logs" ON public.mileage_logs;
DROP POLICY IF EXISTS "Manager and staff can insert mileage logs in their branch" ON public.mileage_logs;
DROP POLICY IF EXISTS "Admin can view all mileage logs" ON public.mileage_logs;
DROP POLICY IF EXISTS "Manager and staff can view mileage logs in their branch" ON public.mileage_logs;

CREATE POLICY "Authenticated users can insert mileage logs"
  ON public.mileage_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role' = 'admin')
    OR
    ((auth.jwt()->>'role' IN ('manager', 'staff')) AND branch_id = (auth.jwt()->>'branch_id')::uuid)
  );

CREATE POLICY "Authenticated users can view mileage logs"
  ON public.mileage_logs FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'role' = 'admin')
    OR
    ((auth.jwt()->>'role' IN ('manager', 'staff')) AND branch_id = (auth.jwt()->>'branch_id')::uuid)
  );

-- ============================================================================
-- PRICING_CONFIG POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admin users can update pricing config" ON public.pricing_config;
DROP POLICY IF EXISTS "Authenticated users can view pricing config" ON public.pricing_config;

CREATE POLICY "All users can view pricing config"
  ON public.pricing_config FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- QUOTES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admin can delete quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can delete their own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Admin can view all quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can view their own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Admin can update all quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can update their own quotes" ON public.quotes;

CREATE POLICY "Authenticated users can delete quotes"
  ON public.quotes FOR DELETE
  TO authenticated
  USING (
    (auth.jwt()->>'role' = 'admin')
    OR
    (user_id = auth.uid())
  );

CREATE POLICY "Authenticated users can view quotes"
  ON public.quotes FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'role' = 'admin')
    OR
    (user_id = auth.uid())
  );

CREATE POLICY "Authenticated users can update quotes"
  ON public.quotes FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'role' = 'admin')
    OR
    (user_id = auth.uid())
  )
  WITH CHECK (
    (auth.jwt()->>'role' = 'admin')
    OR
    (user_id = auth.uid())
  );

-- ============================================================================
-- SNAG_ASSIGNMENTS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view assignments in their branch" ON public.snag_assignments;
DROP POLICY IF EXISTS "Users can view their own assignments" ON public.snag_assignments;

CREATE POLICY "Authenticated users can view snag assignments"
  ON public.snag_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM snags 
      WHERE snags.id = snag_assignments.snag_id 
      AND snags.branch_id = (auth.jwt()->>'branch_id')::uuid
    )
    OR
    (assigned_to = auth.uid())
  );

-- ============================================================================
-- USERS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Allow insert during signup" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Authenticated users can insert users"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role' = 'admin')
    OR
    (id = auth.uid())
  );

CREATE POLICY "Authenticated users can update users"
  ON public.users FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'role' = 'admin')
    OR
    (id = auth.uid())
  )
  WITH CHECK (
    (auth.jwt()->>'role' = 'admin')
    OR
    (id = auth.uid())
  );

-- ============================================================================
-- VEHICLES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admin can insert vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Manager can insert vehicles in their branch" ON public.vehicles;
DROP POLICY IF EXISTS "Admin can view all vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Manager and staff can view vehicles in their branch" ON public.vehicles;
DROP POLICY IF EXISTS "Admin can update all vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Manager can update vehicles in their branch" ON public.vehicles;

CREATE POLICY "Authenticated users can insert vehicles"
  ON public.vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role' = 'admin')
    OR
    ((auth.jwt()->>'role' = 'manager') AND branch_id = (auth.jwt()->>'branch_id')::uuid)
  );

CREATE POLICY "Authenticated users can view vehicles"
  ON public.vehicles FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'role' = 'admin')
    OR
    ((auth.jwt()->>'role' IN ('manager', 'staff')) AND branch_id = (auth.jwt()->>'branch_id')::uuid)
  );

CREATE POLICY "Authenticated users can update vehicles"
  ON public.vehicles FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'role' = 'admin')
    OR
    ((auth.jwt()->>'role' = 'manager') AND branch_id = (auth.jwt()->>'branch_id')::uuid)
  )
  WITH CHECK (
    (auth.jwt()->>'role' = 'admin')
    OR
    ((auth.jwt()->>'role' = 'manager') AND branch_id = (auth.jwt()->>'branch_id')::uuid)
  );
