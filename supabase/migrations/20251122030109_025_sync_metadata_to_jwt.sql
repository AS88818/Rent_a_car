/*
  # Sync User Metadata to JWT
  
  1. Problem
    - app_metadata is not accessible in RLS policies from JWT
    - Need to store role and branch_id in a way that's accessible to RLS
    
  2. Solution
    - Create a trigger to sync auth.users metadata when users are created/updated
    - Update existing users to have proper metadata
    - Simplify RLS policies to use user_metadata which IS in the JWT
    
  3. Security
    - Maintains same security model
    - User metadata will be read-only from client side
*/

-- Update existing users to have role and branch_id in user_metadata
UPDATE auth.users
SET raw_user_meta_data = 
  COALESCE(raw_user_meta_data, '{}'::jsonb) ||
  jsonb_build_object(
    'role', COALESCE(raw_app_meta_data->>'role', 'staff'),
    'branch_id', raw_app_meta_data->>'branch_id'
  )
WHERE raw_app_meta_data IS NOT NULL;

-- Create function to sync metadata on auth user changes
CREATE OR REPLACE FUNCTION public.sync_user_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync app_metadata to user_metadata for JWT access
  IF NEW.raw_app_meta_data IS NOT NULL THEN
    NEW.raw_user_meta_data := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb) ||
      jsonb_build_object(
        'role', COALESCE(NEW.raw_app_meta_data->>'role', 'staff'),
        'branch_id', NEW.raw_app_meta_data->>'branch_id'
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS sync_user_metadata_trigger ON auth.users;
CREATE TRIGGER sync_user_metadata_trigger
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_metadata();

-- =====================================================
-- Update ALL RLS Policies to use user_metadata instead
-- =====================================================

-- VEHICLES
DROP POLICY IF EXISTS "Admin can view all vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admin can insert vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admin can update all vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admin can delete vehicles" ON vehicles;
DROP POLICY IF EXISTS "Manager and staff can view vehicles in their branch" ON vehicles;
DROP POLICY IF EXISTS "Manager can insert vehicles in their branch" ON vehicles;
DROP POLICY IF EXISTS "Manager can update vehicles in their branch" ON vehicles;

CREATE POLICY "Admin can view all vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can insert vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can update all vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can delete vehicles"
  ON vehicles FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Manager and staff can view vehicles in their branch"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'staff')
    AND branch_id::text = (auth.jwt() -> 'user_metadata' ->> 'branch_id')
  );

CREATE POLICY "Manager can insert vehicles in their branch"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager'
    AND branch_id::text = (auth.jwt() -> 'user_metadata' ->> 'branch_id')
  );

CREATE POLICY "Manager can update vehicles in their branch"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager'
    AND branch_id::text = (auth.jwt() -> 'user_metadata' ->> 'branch_id')
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager'
    AND branch_id::text = (auth.jwt() -> 'user_metadata' ->> 'branch_id')
  );

-- MILEAGE_LOGS
DROP POLICY IF EXISTS "Admin can view all mileage logs" ON mileage_logs;
DROP POLICY IF EXISTS "Admin can insert mileage logs" ON mileage_logs;
DROP POLICY IF EXISTS "Manager and staff can view mileage logs in their branch" ON mileage_logs;
DROP POLICY IF EXISTS "Manager and staff can insert mileage logs in their branch" ON mileage_logs;

CREATE POLICY "Admin can view all mileage logs"
  ON mileage_logs FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can insert mileage logs"
  ON mileage_logs FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Manager and staff can view mileage logs in their branch"
  ON mileage_logs FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'staff')
    AND branch_id::text = (auth.jwt() -> 'user_metadata' ->> 'branch_id')
  );

CREATE POLICY "Manager and staff can insert mileage logs in their branch"
  ON mileage_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'staff')
    AND branch_id::text = (auth.jwt() -> 'user_metadata' ->> 'branch_id')
  );

-- BOOKINGS
DROP POLICY IF EXISTS "Admin can view all bookings" ON bookings;
DROP POLICY IF EXISTS "Admin can insert bookings" ON bookings;
DROP POLICY IF EXISTS "Admin can update all bookings" ON bookings;
DROP POLICY IF EXISTS "Admin can delete bookings" ON bookings;

CREATE POLICY "Admin can view all bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can insert bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can update all bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can delete bookings"
  ON bookings FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- MAINTENANCE_LOGS
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
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can insert maintenance logs"
  ON maintenance_logs FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can update all maintenance logs"
  ON maintenance_logs FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can delete maintenance logs"
  ON maintenance_logs FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Manager and staff can view maintenance for their branch vehicles"
  ON maintenance_logs FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'staff')
    AND EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.id = maintenance_logs.vehicle_id
      AND vehicles.branch_id::text = (auth.jwt() -> 'user_metadata' ->> 'branch_id')
    )
  );

CREATE POLICY "Manager can insert maintenance for their branch vehicles"
  ON maintenance_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager'
    AND EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.id = maintenance_logs.vehicle_id
      AND vehicles.branch_id::text = (auth.jwt() -> 'user_metadata' ->> 'branch_id')
    )
  );

CREATE POLICY "Manager can update maintenance for their branch vehicles"
  ON maintenance_logs FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager'
    AND EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.id = maintenance_logs.vehicle_id
      AND vehicles.branch_id::text = (auth.jwt() -> 'user_metadata' ->> 'branch_id')
    )
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager'
    AND EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.id = maintenance_logs.vehicle_id
      AND vehicles.branch_id::text = (auth.jwt() -> 'user_metadata' ->> 'branch_id')
    )
  );

-- BRANCHES
DROP POLICY IF EXISTS "Only admins can create branches" ON branches;
DROP POLICY IF EXISTS "Only admins can update branches" ON branches;

CREATE POLICY "Only admins can create branches"
  ON branches FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Only admins can update branches"
  ON branches FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- VEHICLE_CATEGORIES
DROP POLICY IF EXISTS "Only admins can manage categories" ON vehicle_categories;
DROP POLICY IF EXISTS "Only admins can update categories" ON vehicle_categories;

CREATE POLICY "Only admins can manage categories"
  ON vehicle_categories FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Only admins can update categories"
  ON vehicle_categories FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- SETTINGS
DROP POLICY IF EXISTS "Only admins can update settings" ON settings;

CREATE POLICY "Only admins can update settings"
  ON settings FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- SEASON_RULES
DROP POLICY IF EXISTS "Admin can insert season rules" ON season_rules;
DROP POLICY IF EXISTS "Admin can update season rules" ON season_rules;
DROP POLICY IF EXISTS "Admin can delete season rules" ON season_rules;

CREATE POLICY "Admin can insert season rules"
  ON season_rules FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can update season rules"
  ON season_rules FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can delete season rules"
  ON season_rules FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- CATEGORY_PRICING
DROP POLICY IF EXISTS "Admin can insert category pricing" ON category_pricing;
DROP POLICY IF EXISTS "Admin can update category pricing" ON category_pricing;
DROP POLICY IF EXISTS "Admin can delete category pricing" ON category_pricing;

CREATE POLICY "Admin can insert category pricing"
  ON category_pricing FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can update category pricing"
  ON category_pricing FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can delete category pricing"
  ON category_pricing FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- QUOTES
DROP POLICY IF EXISTS "Admin can view all quotes" ON quotes;
DROP POLICY IF EXISTS "Admin can update all quotes" ON quotes;
DROP POLICY IF EXISTS "Admin can delete quotes" ON quotes;

CREATE POLICY "Admin can view all quotes"
  ON quotes FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can update all quotes"
  ON quotes FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can delete quotes"
  ON quotes FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
