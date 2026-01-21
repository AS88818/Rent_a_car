/*
  # Fix Security Audit Issues

  ## Problem
  Supabase security audit identified 24 security issues:
  - 17 Function Search Path Mutable warnings
  - 6 RLS Policy Always True warnings

  ## Solution
  1. Add search_path protection to all functions (prevents search path attacks)
  2. Fix RLS policies with `WITH CHECK (true)` (prevents unauthorized access)
  3. Preserve mechanic cross-branch access to all vehicle-related data

  ## Security Impact
  - CRITICAL: Prevents privilege escalation via SECURITY DEFINER functions
  - HIGH: Prevents unauthorized access to booking documents, notifications, activity logs
  - MEDIUM: Hardens all database functions against search path attacks

  ## Mechanic Permissions
  All fixes preserve mechanics' cross-branch access to:
  - Vehicles, maintenance logs, mileage logs, vehicle images (already have)
  - Booking documents, snags (NEW - added in this migration)
*/

-- ============================================================================
-- Sections 1 & 2: Fix All Function Search Paths (Conditional)
-- ============================================================================
-- Add search_path protection to all functions (only if they exist)
-- CRITICAL functions (SECURITY DEFINER) are checked first

DO $$
DECLARE
  func_name text;
BEGIN
  -- ========== CRITICAL: SECURITY DEFINER Functions ==========
  -- These run with elevated privileges and MUST have search_path protection
  -- Using exception handling to continue even if individual functions fail

  -- create_default_pricing_for_category
  BEGIN
    ALTER FUNCTION public.create_default_pricing_for_category() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN
    NULL; -- Function doesn't exist, skip
  END;

  -- sync_category_name_to_pricing
  BEGIN
    ALTER FUNCTION public.sync_category_name_to_pricing() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  -- notify_snag_assignment
  BEGIN
    ALTER FUNCTION public.notify_snag_assignment() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  -- update_snag_on_assignment
  BEGIN
    ALTER FUNCTION public.update_snag_on_assignment() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  -- link_resolution_to_snag
  BEGIN
    ALTER FUNCTION public.link_resolution_to_snag() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  -- queue_booking_emails
  BEGIN
    ALTER FUNCTION public.queue_booking_emails() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  -- ========== Regular Functions ==========

  -- check_quote_expiration
  BEGIN
    ALTER FUNCTION public.check_quote_expiration() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  -- set_quote_reference_trigger
  BEGIN
    ALTER FUNCTION public.set_quote_reference_trigger() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  -- update_vehicle_on_hire_status
  BEGIN
    ALTER FUNCTION public.update_vehicle_on_hire_status() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  -- sync_vehicle_status_on_booking
  BEGIN
    ALTER FUNCTION public.sync_vehicle_status_on_booking() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  -- calculate_booking_balance
  BEGIN
    ALTER FUNCTION public.calculate_booking_balance() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  -- calculate_security_deposit
  BEGIN
    ALTER FUNCTION public.calculate_security_deposit() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;
END $$;

-- ============================================================================
-- Section 3: Fix booking_documents RLS Policies
-- ============================================================================
-- Replace insecure policies that allow ANY authenticated user to access ALL documents

DROP POLICY IF EXISTS "Authenticated users can insert booking documents" ON booking_documents;
DROP POLICY IF EXISTS "Authenticated users can view booking documents" ON booking_documents;

-- Secure INSERT policy: admins, mechanics (cross-branch), or users in same branch
CREATE POLICY "Users can insert documents for their branch bookings"
  ON booking_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin can insert any document
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR
    -- Mechanics can insert documents (they work on all vehicles across branches)
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'mechanic'
    OR
    -- User can insert documents for bookings in their branch
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
      AND (
        b.branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid
        OR b.branch_id IS NULL  -- Handle NULL branch bookings
      )
    )
  );

-- Secure SELECT policy: admins, mechanics (cross-branch), users in same branch, or uploader
CREATE POLICY "Users can view documents for their branch bookings"
  ON booking_documents
  FOR SELECT
  TO authenticated
  USING (
    -- Admin can view all documents
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR
    -- Mechanics can view all documents (they work on all vehicles across branches)
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'mechanic'
    OR
    -- User can view documents for bookings in their branch
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
      AND (
        b.branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid
        OR b.branch_id IS NULL
      )
    )
    OR
    -- User can view documents they uploaded
    uploaded_by = (auth.jwt() ->> 'sub')::uuid
  );

-- ============================================================================
-- Section 4: Fix notifications RLS Policy
-- ============================================================================
-- Replace insecure policy that allows ANY user to create notifications for ANYONE

DROP POLICY IF EXISTS "System can create notifications" ON notifications;

-- Secure policy: users can only create notifications for themselves, admins can create any
CREATE POLICY "Users can create their own notifications or admins can create any"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User creating notification for themselves
    user_id = (auth.jwt() ->> 'sub')::uuid
    OR
    -- Admin can create notifications for anyone
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ============================================================================
-- Section 5: Fix vehicle_activity_logs RLS Policy
-- ============================================================================
-- Replace insecure policy that allows ANY user to create activity logs

DROP POLICY IF EXISTS "Service role can insert activity logs" ON vehicle_activity_logs;

-- Secure policy: only admins and service_role can create activity logs
CREATE POLICY "Admins and service role can insert activity logs"
  ON vehicle_activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin users can insert logs
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR
    -- Service role (for automated processes)
    auth.role() = 'service_role'
  );

-- ============================================================================
-- Section 6: Add Mechanic Cross-Branch Access to Snags
-- ============================================================================
-- Grant mechanics ability to view all snags across all branches
-- (aligns with their existing cross-branch access to vehicles, maintenance, mileage)

DROP POLICY IF EXISTS "Users can view snags" ON snags;
DROP POLICY IF EXISTS "Manager and staff can view snags in their branch" ON snags;
DROP POLICY IF EXISTS "Authenticated users can view snags" ON snags;

-- New policy with mechanic cross-branch access
CREATE POLICY "Users can view snags with mechanic cross-branch access"
  ON snags
  FOR SELECT
  TO authenticated
  USING (
    -- Admin can view all snags
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR
    -- Mechanics can view all snags across all branches (for vehicle maintenance)
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'mechanic'
    OR
    -- Manager/Staff can view snags in their branch
    (
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('manager', 'staff')
      AND branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid
    )
  );

-- ============================================================================
-- Section 7: Additional Functions (Conditional)
-- ============================================================================
-- Fix additional functions that may or may not exist (potentially renamed/removed)

DO $$
BEGIN
  -- update_expired_quotes
  BEGIN
    ALTER FUNCTION public.update_expired_quotes() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  -- get_quote_status
  BEGIN
    ALTER FUNCTION public.get_quote_status() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  -- abbreviate_category
  BEGIN
    ALTER FUNCTION public.abbreviate_category() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  -- abbreviate_location
  BEGIN
    ALTER FUNCTION public.abbreviate_location() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  -- calculate_invoice_balance
  BEGIN
    ALTER FUNCTION public.calculate_invoice_balance() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  -- record_booking_deposit (likely renamed to record_booking_payment)
  BEGIN
    ALTER FUNCTION public.record_booking_deposit() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  -- handle_new_user
  BEGIN
    ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;
END $$;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON POLICY "Users can insert documents for their branch bookings" ON booking_documents IS
  'Admins have full access. Mechanics can insert for all branches (cross-branch maintenance). Others can insert for their branch only.';

COMMENT ON POLICY "Users can view documents for their branch bookings" ON booking_documents IS
  'Admins have full access. Mechanics can view all (cross-branch maintenance). Others can view their branch or documents they uploaded.';

COMMENT ON POLICY "Users can create their own notifications or admins can create any" ON notifications IS
  'Users can only create notifications for themselves. Admins can create notifications for anyone.';

COMMENT ON POLICY "Admins and service role can insert activity logs" ON vehicle_activity_logs IS
  'Only admins and service_role can create activity logs to maintain audit trail integrity.';

COMMENT ON POLICY "Users can view snags with mechanic cross-branch access" ON snags IS
  'Admins have full access. Mechanics can view all snags across branches (for vehicle maintenance). Manager/Staff can view their branch only.';
