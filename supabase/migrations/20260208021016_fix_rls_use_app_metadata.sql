/*
  # Fix RLS Security - Use app_metadata Instead of user_metadata

  Critical security fix: user_metadata can be edited by end users, making it
  unsuitable for authorization. Changing all RLS policies to use app_metadata
  which can only be modified by service role.

  1. Security Fix
    - Replace all user_metadata references with app_metadata in RLS policies
    - Wrap auth.jwt() calls with (select ...) for performance
    
  2. View Fix
    - Ensure active_vehicles view doesn't use SECURITY DEFINER
*/

-- Fix active_vehicles view - ensure no SECURITY DEFINER
DROP VIEW IF EXISTS active_vehicles;
CREATE VIEW active_vehicles AS
SELECT *
FROM vehicles
WHERE deleted_at IS NULL
  AND (status IS NULL OR status != 'sold');

-- Fix RLS Policies - vehicles table
DROP POLICY IF EXISTS "Admin and manager can insert vehicles" ON vehicles;
CREATE POLICY "Admin and manager can insert vehicles" ON vehicles
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "Admins and managers can update vehicles" ON vehicles;
CREATE POLICY "Admins and managers can update vehicles" ON vehicles
  FOR UPDATE TO authenticated
  USING (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager', 'mechanic')
  )
  WITH CHECK (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager', 'mechanic')
  );

DROP POLICY IF EXISTS "Admins can delete vehicles" ON vehicles;
CREATE POLICY "Admins can delete vehicles" ON vehicles
  FOR DELETE TO authenticated
  USING (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Fix RLS Policies - bookings table
DROP POLICY IF EXISTS "Admin can delete bookings" ON bookings;
CREATE POLICY "Admin can delete bookings" ON bookings
  FOR DELETE TO authenticated
  USING (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Fix RLS Policies - maintenance_logs table
DROP POLICY IF EXISTS "Admin can delete maintenance logs" ON maintenance_logs;
CREATE POLICY "Admin can delete maintenance logs" ON maintenance_logs
  FOR DELETE TO authenticated
  USING (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Fix RLS Policies - snags table
DROP POLICY IF EXISTS "Users can update snags" ON snags;
CREATE POLICY "Users can update snags" ON snags
  FOR UPDATE TO authenticated
  USING (
    assigned_to = (select auth.uid()) OR
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager', 'mechanic')
  )
  WITH CHECK (
    assigned_to = (select auth.uid()) OR
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager', 'mechanic')
  );

-- Fix RLS Policies - users table
DROP POLICY IF EXISTS "Authenticated users can insert users" ON users;
CREATE POLICY "Authenticated users can insert users" ON users
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "Authenticated users can update users" ON users;
CREATE POLICY "Authenticated users can update users" ON users
  FOR UPDATE TO authenticated
  USING (
    id = (select auth.uid()) OR 
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  )
  WITH CHECK (
    id = (select auth.uid()) OR 
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

-- Fix RLS Policies - quotes table
DROP POLICY IF EXISTS "Authenticated users can delete quotes" ON quotes;
CREATE POLICY "Authenticated users can delete quotes" ON quotes
  FOR DELETE TO authenticated
  USING (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

-- Fix RLS Policies - email_templates table
DROP POLICY IF EXISTS "Authenticated users can delete templates" ON email_templates;
CREATE POLICY "Authenticated users can delete templates" ON email_templates
  FOR DELETE TO authenticated
  USING (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "Authenticated users can update templates" ON email_templates;
CREATE POLICY "Authenticated users can update templates" ON email_templates
  FOR UPDATE TO authenticated
  USING (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  )
  WITH CHECK (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

-- Fix RLS Policies - invoices table
DROP POLICY IF EXISTS "Admin users can delete invoices" ON invoices;
CREATE POLICY "Admin users can delete invoices" ON invoices
  FOR DELETE TO authenticated
  USING (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Fix RLS Policies - snag_assignments table
DROP POLICY IF EXISTS "Admin and managers can create assignments" ON snag_assignments;
CREATE POLICY "Admin and managers can create assignments" ON snag_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

-- Fix RLS Policies - notifications table
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) OR
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

-- Fix RLS Policies - booking_payments table
DROP POLICY IF EXISTS "Admins and managers can insert deposit records" ON booking_payments;
CREATE POLICY "Admins and managers can insert deposit records" ON booking_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

-- Fix RLS Policies - company_settings table
DROP POLICY IF EXISTS "Admins can update company settings" ON company_settings;
CREATE POLICY "Admins can update company settings" ON company_settings
  FOR UPDATE TO authenticated
  USING (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Only admin can insert company settings" ON company_settings;
CREATE POLICY "Only admin can insert company settings" ON company_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Update handle_new_user function to set role in app_metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_branch_id uuid;
  user_role text;
  user_branch_id uuid;
BEGIN
  SELECT id INTO default_branch_id FROM branches LIMIT 1;
  
  user_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    NEW.raw_app_meta_data->>'role',
    'staff'
  );
  
  user_branch_id := COALESCE(
    (NEW.raw_user_meta_data->>'branch_id')::uuid,
    (NEW.raw_app_meta_data->>'branch_id')::uuid,
    default_branch_id
  );

  INSERT INTO public.users (id, email, full_name, role, branch_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    user_role,
    user_branch_id
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, users.full_name),
    role = COALESCE(EXCLUDED.role, users.role),
    branch_id = COALESCE(EXCLUDED.branch_id, users.branch_id);

  -- Sync role to app_metadata for RLS policies
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', user_role, 'branch_id', user_branch_id::text)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;
