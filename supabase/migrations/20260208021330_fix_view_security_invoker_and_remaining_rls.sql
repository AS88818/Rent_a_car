/*
  # Fix View Security and Ensure RLS Performance

  1. Fix active_vehicles view
    - Set security_invoker = true so view executes with calling user's permissions
    - This removes the SECURITY DEFINER behavior

  2. Verify all RLS policies use (select ...) wrapper for auth functions
    - Ensures optimal query performance at scale
*/

-- Recreate active_vehicles view with security_invoker = true
DROP VIEW IF EXISTS active_vehicles;
CREATE VIEW active_vehicles 
WITH (security_invoker = true)
AS
SELECT 
  id,
  reg_number,
  category_id,
  branch_id,
  status,
  health_flag,
  insurance_expiry,
  mot_expiry,
  current_mileage,
  last_mileage_update,
  market_value,
  created_at,
  updated_at,
  health_override,
  service_interval_km,
  last_service_mileage,
  next_service_mileage,
  make,
  model,
  colour,
  fuel_type,
  transmission,
  spare_key,
  owner_name,
  is_personal,
  current_location,
  spare_key_location,
  mot_not_applicable,
  chassis_number,
  no_of_passengers,
  luggage_space,
  is_draft,
  deleted_at
FROM vehicles
WHERE deleted_at IS NULL
  AND (status IS NULL OR status != 'sold');

-- Grant access to the view
GRANT SELECT ON active_vehicles TO authenticated;
GRANT SELECT ON active_vehicles TO anon;

-- Re-verify and fix any remaining RLS policies that might not have (select ...) wrapper
-- These are idempotent - will recreate with correct syntax

DROP POLICY IF EXISTS "Admin and manager can insert vehicles" ON vehicles;
CREATE POLICY "Admin and manager can insert vehicles" ON vehicles
  FOR INSERT TO authenticated
  WITH CHECK (
    (select (select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "Admins and managers can update vehicles" ON vehicles;
CREATE POLICY "Admins and managers can update vehicles" ON vehicles
  FOR UPDATE TO authenticated
  USING (
    (select (select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'manager', 'mechanic')
  )
  WITH CHECK (
    (select (select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'manager', 'mechanic')
  );

DROP POLICY IF EXISTS "Admins can delete vehicles" ON vehicles;
CREATE POLICY "Admins can delete vehicles" ON vehicles
  FOR DELETE TO authenticated
  USING (
    (select (select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Admin can delete bookings" ON bookings;
CREATE POLICY "Admin can delete bookings" ON bookings
  FOR DELETE TO authenticated
  USING (
    (select (select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Admin can delete maintenance logs" ON maintenance_logs;
CREATE POLICY "Admin can delete maintenance logs" ON maintenance_logs
  FOR DELETE TO authenticated
  USING (
    (select (select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Users can update snags" ON snags;
CREATE POLICY "Users can update snags" ON snags
  FOR UPDATE TO authenticated
  USING (
    assigned_to = (select auth.uid()) OR
    (select (select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'manager', 'mechanic')
  )
  WITH CHECK (
    assigned_to = (select auth.uid()) OR
    (select (select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'manager', 'mechanic')
  );

DROP POLICY IF EXISTS "Authenticated users can insert users" ON users;
CREATE POLICY "Authenticated users can insert users" ON users
  FOR INSERT TO authenticated
  WITH CHECK (
    (select (select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "Authenticated users can update users" ON users;
CREATE POLICY "Authenticated users can update users" ON users
  FOR UPDATE TO authenticated
  USING (
    id = (select auth.uid()) OR 
    (select (select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  )
  WITH CHECK (
    id = (select auth.uid()) OR 
    (select (select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "Authenticated users can delete quotes" ON quotes;
CREATE POLICY "Authenticated users can delete quotes" ON quotes
  FOR DELETE TO authenticated
  USING (
    (select (select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "Authenticated users can delete templates" ON email_templates;
CREATE POLICY "Authenticated users can delete templates" ON email_templates
  FOR DELETE TO authenticated
  USING (
    (select (select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "Authenticated users can update templates" ON email_templates;
CREATE POLICY "Authenticated users can update templates" ON email_templates
  FOR UPDATE TO authenticated
  USING (
    (select (select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  )
  WITH CHECK (
    (select (select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "Admin users can delete invoices" ON invoices;
CREATE POLICY "Admin users can delete invoices" ON invoices
  FOR DELETE TO authenticated
  USING (
    (select (select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Admin and managers can create assignments" ON snag_assignments;
CREATE POLICY "Admin and managers can create assignments" ON snag_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    (select (select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) OR
    (select (select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "Admins and managers can insert deposit records" ON booking_payments;
CREATE POLICY "Admins and managers can insert deposit records" ON booking_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    (select (select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "Admins can update company settings" ON company_settings;
CREATE POLICY "Admins can update company settings" ON company_settings
  FOR UPDATE TO authenticated
  USING (
    (select (select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (select (select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Only admin can insert company settings" ON company_settings;
CREATE POLICY "Only admin can insert company settings" ON company_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    (select (select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  );
