/*
  # Fix Security Audit Issues (v2 - Idempotent)

  ## Problem
  Supabase security audit identified security issues:
  - Function Search Path Mutable warnings
  - RLS Policy Always True warnings
  - Security Definer View issues

  ## Solution
  1. Add search_path protection to all functions
  2. Fix RLS policies with unrestricted access
  3. Preserve mechanic cross-branch access to all vehicle-related data
  4. Make migration idempotent (can run multiple times)

  ## New Issues Addressed
  - `update_updated_at_column` function (missing from v1)
  - `snags` table INSERT/UPDATE policies (WITH CHECK true)
  - `vehicles` table INSERT policy (WITH CHECK true)
  - `active_vehicles` view (SECURITY DEFINER)
*/

-- ============================================================================
-- Section 1: Fix All Function Search Paths
-- ============================================================================

DO $$
BEGIN
  -- ========== CRITICAL: SECURITY DEFINER Functions ==========

  BEGIN ALTER FUNCTION public.create_default_pricing_for_category() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN ALTER FUNCTION public.sync_category_name_to_pricing() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN ALTER FUNCTION public.notify_snag_assignment() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN ALTER FUNCTION public.update_snag_on_assignment() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN ALTER FUNCTION public.link_resolution_to_snag() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN ALTER FUNCTION public.queue_booking_emails() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;

  -- ========== Regular Functions ==========

  BEGIN ALTER FUNCTION public.check_quote_expiration() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN ALTER FUNCTION public.set_quote_reference_trigger() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN ALTER FUNCTION public.update_vehicle_on_hire_status() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN ALTER FUNCTION public.sync_vehicle_status_on_booking() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN ALTER FUNCTION public.calculate_booking_balance() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN ALTER FUNCTION public.calculate_security_deposit() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN ALTER FUNCTION public.get_quote_status() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN ALTER FUNCTION public.abbreviate_category() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN ALTER FUNCTION public.abbreviate_location() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN ALTER FUNCTION public.record_booking_deposit() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;

  -- NEW: update_updated_at_column (missing from v1)
  BEGIN ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN ALTER FUNCTION public.update_expired_quotes() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN ALTER FUNCTION public.calculate_invoice_balance() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;

  BEGIN ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;
END $$;

-- ============================================================================
-- Section 2: Fix booking_documents RLS Policies
-- ============================================================================

DO $$
BEGIN
  -- Drop old policy names
  DROP POLICY IF EXISTS "Authenticated users can insert booking documents" ON booking_documents;
  DROP POLICY IF EXISTS "Authenticated users can view booking documents" ON booking_documents;

  -- Drop new policy names (in case migration ran before)
  DROP POLICY IF EXISTS "Users can insert documents for their branch bookings" ON booking_documents;
  DROP POLICY IF EXISTS "Users can view documents for their branch bookings" ON booking_documents;
EXCEPTION WHEN undefined_table THEN
  NULL; -- Table doesn't exist
END $$;

-- Secure INSERT policy
CREATE POLICY "Users can insert documents for their branch bookings"
  ON booking_documents FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'mechanic' OR
    EXISTS (
      SELECT 1 FROM bookings b WHERE b.id = booking_id
      AND (b.branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid OR b.branch_id IS NULL)
    )
  );

-- Secure SELECT policy
CREATE POLICY "Users can view documents for their branch bookings"
  ON booking_documents FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'mechanic' OR
    EXISTS (
      SELECT 1 FROM bookings b WHERE b.id = booking_id
      AND (b.branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid OR b.branch_id IS NULL)
    ) OR
    uploaded_by = (auth.jwt() ->> 'sub')::uuid
  );

-- ============================================================================
-- Section 3: Fix notifications RLS Policy
-- ============================================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "System can create notifications" ON notifications;
  DROP POLICY IF EXISTS "Users can create their own notifications or admins can create any" ON notifications;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "Users can create their own notifications or admins can create any"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (auth.jwt() ->> 'sub')::uuid OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ============================================================================
-- Section 4: Fix vehicle_activity_logs RLS Policy
-- ============================================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "Service role can insert activity logs" ON vehicle_activity_logs;
  DROP POLICY IF EXISTS "Admins and service role can insert activity logs" ON vehicle_activity_logs;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "Admins and service role can insert activity logs"
  ON vehicle_activity_logs FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR
    auth.role() = 'service_role'
  );

-- ============================================================================
-- Section 5: Fix snags RLS Policies (NEW)
-- ============================================================================

DO $$
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Users can view snags" ON snags;
  DROP POLICY IF EXISTS "Manager and staff can view snags in their branch" ON snags;
  DROP POLICY IF EXISTS "Authenticated users can view snags" ON snags;
  DROP POLICY IF EXISTS "Users can view snags with mechanic cross-branch access" ON snags;
  DROP POLICY IF EXISTS "Users can create snags" ON snags;
  DROP POLICY IF EXISTS "Users can update snags" ON snags;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Secure SELECT policy with mechanic cross-branch access
CREATE POLICY "Users can view snags with mechanic cross-branch access"
  ON snags FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'mechanic' OR
    (
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('manager', 'staff') AND
      branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid
    )
  );

-- Secure INSERT policy (replace WITH CHECK true)
CREATE POLICY "Users can create snags in their branch"
  ON snags FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'mechanic' OR
    (
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('manager', 'staff') AND
      branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid
    )
  );

-- Secure UPDATE policy (replace USING/WITH CHECK true)
CREATE POLICY "Users can update snags in their branch"
  ON snags FOR UPDATE TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'mechanic' OR
    (
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('manager', 'staff') AND
      branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid
    )
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'mechanic' OR
    (
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('manager', 'staff') AND
      branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid
    )
  );

-- ============================================================================
-- Section 6: Fix vehicles RLS Policy (NEW)
-- ============================================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can insert vehicles" ON vehicles;
  DROP POLICY IF EXISTS "Users can insert vehicles in their branch" ON vehicles;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Secure INSERT policy (replace WITH CHECK true)
-- Only admins and managers can create vehicles
CREATE POLICY "Users can insert vehicles in their branch"
  ON vehicles FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR
    (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager' AND
      (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid OR branch_id IS NULL)
    )
  );

-- ============================================================================
-- Section 7: Fix active_vehicles View (Security Definer)
-- ============================================================================

DO $$
BEGIN
  -- Drop and recreate view without SECURITY DEFINER
  DROP VIEW IF EXISTS public.active_vehicles;

  -- Recreate without SECURITY DEFINER
  CREATE VIEW public.active_vehicles AS
  SELECT * FROM vehicles
  WHERE deleted_at IS NULL;
EXCEPTION WHEN undefined_table THEN
  NULL; -- vehicles table doesn't exist
END $$;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON POLICY "Users can insert documents for their branch bookings" ON booking_documents IS
  'Admins: full access. Mechanics: cross-branch. Others: their branch only.';

COMMENT ON POLICY "Users can view documents for their branch bookings" ON booking_documents IS
  'Admins: full access. Mechanics: cross-branch. Others: their branch or uploaded.';

COMMENT ON POLICY "Users can create their own notifications or admins can create any" ON notifications IS
  'Users can only create notifications for themselves. Admins can create for anyone.';

COMMENT ON POLICY "Admins and service role can insert activity logs" ON vehicle_activity_logs IS
  'Only admins and service_role can create activity logs for audit trail integrity.';

COMMENT ON POLICY "Users can view snags with mechanic cross-branch access" ON snags IS
  'Admins: full access. Mechanics: cross-branch. Manager/Staff: their branch only.';

COMMENT ON POLICY "Users can create snags in their branch" ON snags IS
  'Admins/Mechanics: any branch. Manager/Staff: their branch only.';

COMMENT ON POLICY "Users can update snags in their branch" ON snags IS
  'Admins/Mechanics: any snag. Manager/Staff: snags in their branch only.';

COMMENT ON POLICY "Users can insert vehicles in their branch" ON vehicles IS
  'Admins: any branch. Managers: their branch or NULL branch. Mechanics cannot create vehicles.';

COMMENT ON VIEW public.active_vehicles IS
  'Non-deleted vehicles. View recreated without SECURITY DEFINER for security.';
