/*
  # Fix JWT Paths in Booking Documents RLS Policies

  1. Problem
    - RLS policies are checking `auth.jwt() ->> 'role'` and `auth.jwt() ->> 'branch_id'`
    - But these are actually at `auth.jwt() -> 'app_metadata' ->> 'role'` and `auth.jwt() -> 'app_metadata' ->> 'branch_id'`
    - This causes "new row violates row-level security policy" errors

  2. Changes
    - Drop and recreate all booking_documents RLS policies with correct JWT paths
    - Fix INSERT, SELECT, UPDATE, and DELETE policies
    
  3. Security
    - Maintains existing access control rules
    - Only fixes the path to access JWT claims correctly
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert documents for bookings in their branch" ON booking_documents;
DROP POLICY IF EXISTS "Users can view documents for bookings in their branch" ON booking_documents;
DROP POLICY IF EXISTS "Users can update documents they uploaded or admin" ON booking_documents;
DROP POLICY IF EXISTS "Users can delete documents they uploaded or admin" ON booking_documents;

-- Recreate INSERT policy with correct JWT paths
CREATE POLICY "Users can insert documents for bookings in their branch"
  ON booking_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM bookings b
      WHERE b.id = booking_id
      AND (
        ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
        OR (b.branch_id = ((auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid))
      )
    )
  );

-- Recreate SELECT policy with correct JWT paths
CREATE POLICY "Users can view documents for bookings in their branch"
  ON booking_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM bookings b
      WHERE b.id = booking_id
      AND (
        ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
        OR (b.branch_id = ((auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid))
      )
    )
  );

-- Recreate UPDATE policy with correct JWT paths
CREATE POLICY "Users can update documents they uploaded or admin"
  ON booking_documents
  FOR UPDATE
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR (uploaded_by = ((auth.jwt() ->> 'sub')::uuid))
  )
  WITH CHECK (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR (uploaded_by = ((auth.jwt() ->> 'sub')::uuid))
  );

-- Recreate DELETE policy with correct JWT paths
CREATE POLICY "Users can delete documents they uploaded or admin"
  ON booking_documents
  FOR DELETE
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR (uploaded_by = ((auth.jwt() ->> 'sub')::uuid))
  );
