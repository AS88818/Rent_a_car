/*
  # Revert Security Audit Changes

  This migration reverts the restrictive RLS policies back to the original
  permissive state so we can fix issues one by one.
*/

-- ============================================================================
-- Section 1: Revert vehicle_activity_logs Policy
-- ============================================================================

DROP POLICY IF EXISTS "Admins and service role can insert activity logs" ON vehicle_activity_logs;

-- Restore original permissive policy
CREATE POLICY "Service role can insert activity logs"
  ON vehicle_activity_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- Section 2: Revert snags Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view snags with mechanic cross-branch access" ON snags;
DROP POLICY IF EXISTS "Users can create snags in their branch" ON snags;
DROP POLICY IF EXISTS "Users can update snags in their branch" ON snags;

-- Restore original permissive policies
CREATE POLICY "Authenticated users can view snags"
  ON snags FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create snags"
  ON snags FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update snags"
  ON snags FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Section 3: Revert booking_documents Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert documents for their branch bookings" ON booking_documents;
DROP POLICY IF EXISTS "Users can view documents for their branch bookings" ON booking_documents;

-- Restore original permissive policies
CREATE POLICY "Authenticated users can insert booking documents"
  ON booking_documents FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view booking documents"
  ON booking_documents FOR SELECT TO authenticated
  USING (true);

-- ============================================================================
-- Section 4: Revert notifications Policy
-- ============================================================================

DROP POLICY IF EXISTS "Users can create their own notifications or admins can create any" ON notifications;

-- Restore original permissive policy
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- Section 5: Revert vehicles INSERT Policy
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert vehicles in their branch" ON vehicles;

-- Restore original permissive policy
CREATE POLICY "Authenticated users can insert vehicles"
  ON vehicles FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- Done - All policies reverted to original state
-- ============================================================================
