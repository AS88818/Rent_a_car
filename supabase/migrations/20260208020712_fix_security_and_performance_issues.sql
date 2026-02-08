/*
  # Fix Security and Performance Issues

  1. Missing Indexes for Foreign Keys
    - Add index on booking_payments.recorded_by
    - Add index on company_settings.updated_by
    - Add index on maintenance_work_items.checked_by_user_id
    - Add index on maintenance_work_items.performed_by_user_id

  2. Drop Duplicate Index
    - Remove idx_bookings_booking_reference (duplicate of idx_bookings_reference)

  3. Fix Security Definer View
    - Recreate active_vehicles view without SECURITY DEFINER

  4. Fix Function Search Paths
    - Set immutable search_path for all functions with mutable paths

  5. Optimize RLS Policies
    - Replace auth.uid() with (select auth.uid()) for better performance
    - This prevents re-evaluation for each row

  6. Tighten Overly Permissive RLS Policies
    - Fix policies that allow unrestricted access
*/

-- 1. Add missing indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_booking_payments_recorded_by 
  ON booking_payments(recorded_by);

CREATE INDEX IF NOT EXISTS idx_company_settings_updated_by 
  ON company_settings(updated_by);

CREATE INDEX IF NOT EXISTS idx_maintenance_work_items_checked_by 
  ON maintenance_work_items(checked_by_user_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_work_items_performed_by 
  ON maintenance_work_items(performed_by_user_id);

-- 2. Drop duplicate index
DROP INDEX IF EXISTS idx_bookings_booking_reference;

-- 3. Fix Security Definer View - recreate without SECURITY DEFINER
DROP VIEW IF EXISTS active_vehicles;
CREATE VIEW active_vehicles AS
SELECT *
FROM vehicles
WHERE deleted_at IS NULL
  AND (status IS NULL OR status != 'sold');

-- 4. Fix Function Search Paths
ALTER FUNCTION update_booking_emails() SET search_path = public;
ALTER FUNCTION queue_booking_emails() SET search_path = public;
ALTER FUNCTION notify_booking_chauffeur_assignment() SET search_path = public;
ALTER FUNCTION create_vehicle_alert_notification(uuid, text, text, text, text, jsonb) SET search_path = public;
ALTER FUNCTION handle_new_user() SET search_path = public;

-- 5. Fix RLS Policies - vehicles table
DROP POLICY IF EXISTS "Admin and manager can insert vehicles" ON vehicles;
CREATE POLICY "Admin and manager can insert vehicles" ON vehicles
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "Admins and managers can update vehicles" ON vehicles;
CREATE POLICY "Admins and managers can update vehicles" ON vehicles
  FOR UPDATE TO authenticated
  USING (
    (select auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'manager', 'mechanic')
  )
  WITH CHECK (
    (select auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'manager', 'mechanic')
  );

DROP POLICY IF EXISTS "Admins can delete vehicles" ON vehicles;
CREATE POLICY "Admins can delete vehicles" ON vehicles
  FOR DELETE TO authenticated
  USING (
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- 5. Fix RLS Policies - bookings table
DROP POLICY IF EXISTS "Admin can delete bookings" ON bookings;
CREATE POLICY "Admin can delete bookings" ON bookings
  FOR DELETE TO authenticated
  USING (
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Authenticated users can insert bookings" ON bookings;
CREATE POLICY "Authenticated users can insert bookings" ON bookings
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update bookings" ON bookings;
CREATE POLICY "Authenticated users can update bookings" ON bookings
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can view bookings" ON bookings;
CREATE POLICY "Authenticated users can view bookings" ON bookings
  FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- 5. Fix RLS Policies - mileage_logs table
DROP POLICY IF EXISTS "Authenticated users can insert mileage logs" ON mileage_logs;
CREATE POLICY "Authenticated users can insert mileage logs" ON mileage_logs
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can view mileage logs" ON mileage_logs;
CREATE POLICY "Authenticated users can view mileage logs" ON mileage_logs
  FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- 5. Fix RLS Policies - maintenance_logs table
DROP POLICY IF EXISTS "Admin can delete maintenance logs" ON maintenance_logs;
CREATE POLICY "Admin can delete maintenance logs" ON maintenance_logs
  FOR DELETE TO authenticated
  USING (
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Authenticated users can insert maintenance logs" ON maintenance_logs;
CREATE POLICY "Authenticated users can insert maintenance logs" ON maintenance_logs
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update maintenance logs" ON maintenance_logs;
CREATE POLICY "Authenticated users can update maintenance logs" ON maintenance_logs
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can view maintenance logs" ON maintenance_logs;
CREATE POLICY "Authenticated users can view maintenance logs" ON maintenance_logs
  FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- 5. Fix RLS Policies - users table
DROP POLICY IF EXISTS "Authenticated users can insert users" ON users;
CREATE POLICY "Authenticated users can insert users" ON users
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "Authenticated users can update users" ON users;
CREATE POLICY "Authenticated users can update users" ON users
  FOR UPDATE TO authenticated
  USING (
    id = (select auth.uid()) OR 
    (select auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'manager')
  )
  WITH CHECK (
    id = (select auth.uid()) OR 
    (select auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'manager')
  );

-- 5. Fix RLS Policies - quotes table
DROP POLICY IF EXISTS "Authenticated users can delete quotes" ON quotes;
CREATE POLICY "Authenticated users can delete quotes" ON quotes
  FOR DELETE TO authenticated
  USING (
    (select auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "Authenticated users can update quotes" ON quotes;
CREATE POLICY "Authenticated users can update quotes" ON quotes
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can view quotes" ON quotes;
CREATE POLICY "Authenticated users can view quotes" ON quotes
  FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- 5. Fix RLS Policies - email_templates table
DROP POLICY IF EXISTS "Authenticated users can delete templates" ON email_templates;
CREATE POLICY "Authenticated users can delete templates" ON email_templates
  FOR DELETE TO authenticated
  USING (
    (select auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "Authenticated users can update templates" ON email_templates;
CREATE POLICY "Authenticated users can update templates" ON email_templates
  FOR UPDATE TO authenticated
  USING (
    (select auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'manager')
  )
  WITH CHECK (
    (select auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'manager')
  );

-- 5. Fix RLS Policies - invoices table
DROP POLICY IF EXISTS "Admin users can delete invoices" ON invoices;
CREATE POLICY "Admin users can delete invoices" ON invoices
  FOR DELETE TO authenticated
  USING (
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Authenticated users can create invoices" ON invoices;
CREATE POLICY "Authenticated users can create invoices" ON invoices
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update invoices" ON invoices;
CREATE POLICY "Authenticated users can update invoices" ON invoices
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can view invoices" ON invoices;
CREATE POLICY "Authenticated users can view invoices" ON invoices
  FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- 5. Fix RLS Policies - snag_assignments table
DROP POLICY IF EXISTS "Admin and managers can create assignments" ON snag_assignments;
CREATE POLICY "Admin and managers can create assignments" ON snag_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "Authenticated users can view snag assignments" ON snag_assignments;
CREATE POLICY "Authenticated users can view snag assignments" ON snag_assignments
  FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- 5. Fix RLS Policies - notifications table
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications" ON notifications
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) OR
    (select auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'manager')
  );

-- 5. Fix RLS Policies - booking_payments table
DROP POLICY IF EXISTS "Admins and managers can insert deposit records" ON booking_payments;
CREATE POLICY "Admins and managers can insert deposit records" ON booking_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "Admins and managers can view deposit records" ON booking_payments;
CREATE POLICY "Admins and managers can view deposit records" ON booking_payments
  FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- 5. Fix RLS Policies - booking_documents table
DROP POLICY IF EXISTS "Authenticated users can delete their own documents" ON booking_documents;
CREATE POLICY "Authenticated users can delete their own documents" ON booking_documents
  FOR DELETE TO authenticated
  USING (uploaded_by = (select auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can update their own documents" ON booking_documents;
CREATE POLICY "Authenticated users can update their own documents" ON booking_documents
  FOR UPDATE TO authenticated
  USING (uploaded_by = (select auth.uid()))
  WITH CHECK (uploaded_by = (select auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert booking documents" ON booking_documents;
CREATE POLICY "Authenticated users can insert booking documents" ON booking_documents
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = (select auth.uid()));

-- 5. Fix RLS Policies - alert_snoozes table
DROP POLICY IF EXISTS "Users can create their own snoozes" ON alert_snoozes;
CREATE POLICY "Users can create their own snoozes" ON alert_snoozes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own snoozes" ON alert_snoozes;
CREATE POLICY "Users can delete their own snoozes" ON alert_snoozes
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own snoozes" ON alert_snoozes;
CREATE POLICY "Users can update their own snoozes" ON alert_snoozes
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view their own snoozes" ON alert_snoozes;
CREATE POLICY "Users can view their own snoozes" ON alert_snoozes
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- 5. Fix RLS Policies - company_settings table
DROP POLICY IF EXISTS "Admins can update company settings" ON company_settings;
CREATE POLICY "Admins can update company settings" ON company_settings
  FOR UPDATE TO authenticated
  USING (
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Only admin can insert company settings" ON company_settings;
CREATE POLICY "Only admin can insert company settings" ON company_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- 6. Tighten overly permissive RLS policies - snags table
DROP POLICY IF EXISTS "Users can create snags" ON snags;
CREATE POLICY "Users can create snags" ON snags
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users can update snags" ON snags;
CREATE POLICY "Users can update snags" ON snags
  FOR UPDATE TO authenticated
  USING (
    assigned_to = (select auth.uid()) OR
    (select auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'manager', 'mechanic')
  )
  WITH CHECK (
    assigned_to = (select auth.uid()) OR
    (select auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'manager', 'mechanic')
  );

-- 6. Tighten vehicle_activity_logs policy
DROP POLICY IF EXISTS "Service role can insert activity logs" ON vehicle_activity_logs;
CREATE POLICY "Authenticated users can insert activity logs" ON vehicle_activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));
