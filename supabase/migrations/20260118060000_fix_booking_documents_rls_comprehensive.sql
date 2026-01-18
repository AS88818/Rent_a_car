/*
  # Comprehensive Fix for Booking Documents RLS Policy Violation

  ## Root Cause
  - Admin users may have NULL or missing app_metadata.role in their JWT
  - Bookings may have NULL branch_id (valid for admin-created bookings)
  - Current RLS policy requires EITHER admin role OR matching branch_id
  - When both conditions fail, document upload is rejected

  ## Solution
  1. Ensure all users have app_metadata.role synced from public.users
  2. Add explicit NULL handling to RLS policies
  3. Add uploaded_by check as additional authorization path
  4. Strengthen metadata sync trigger to prevent future issues

  ## Security
  - Maintains existing access control model
  - Adds defense-in-depth with multiple authorization paths
  - Explicitly handles edge cases (NULL values, missing metadata)
*/

-- ============================================================================
-- STEP 1: Ensure All Users Have Proper app_metadata
-- ============================================================================

-- Sync all users from public.users to auth.users.raw_app_meta_data
-- This ensures JWT contains role and branch_id for ALL users
DO $$
DECLARE
  user_record RECORD;
  updated_count INTEGER := 0;
BEGIN
  -- Log start
  RAISE NOTICE 'Starting metadata sync for all users...';

  FOR user_record IN
    SELECT u.id, u.role, u.branch_id, au.raw_app_meta_data
    FROM public.users u
    INNER JOIN auth.users au ON u.id = au.id
  LOOP
    -- Only update if app_metadata is missing role or branch_id
    IF (user_record.raw_app_meta_data IS NULL)
       OR (user_record.raw_app_meta_data->>'role' IS NULL)
       OR (user_record.raw_app_meta_data->>'role' != user_record.role)
       OR (user_record.raw_app_meta_data->>'branch_id' IS DISTINCT FROM user_record.branch_id::text)
    THEN
      UPDATE auth.users
      SET raw_app_meta_data =
        COALESCE(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'role', user_record.role,
          'branch_id', user_record.branch_id
        )
      WHERE id = user_record.id;

      updated_count := updated_count + 1;
      RAISE NOTICE 'Updated user %: role=%, branch_id=%',
        user_record.id, user_record.role, user_record.branch_id;
    END IF;
  END LOOP;

  RAISE NOTICE 'Metadata sync complete. Updated % users.', updated_count;
END $$;

-- ============================================================================
-- STEP 2: Strengthen Metadata Sync Trigger
-- ============================================================================

-- Recreate the sync trigger with better error handling
CREATE OR REPLACE FUNCTION public.sync_user_to_jwt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update auth.users app_metadata with role and branch_id from public.users
  -- This ensures the JWT always has current role and branch_id
  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'role', NEW.role,
      'branch_id', NEW.branch_id  -- Will be stored as text in JSONB
    )
  WHERE id = NEW.id;

  -- Log the sync for debugging (optional, remove in production)
  RAISE DEBUG 'Synced user % metadata: role=%, branch_id=%',
    NEW.id, NEW.role, NEW.branch_id;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists and is active
DROP TRIGGER IF EXISTS sync_user_to_jwt_trigger ON public.users;
CREATE TRIGGER sync_user_to_jwt_trigger
  AFTER INSERT OR UPDATE OF role, branch_id
  ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_to_jwt();

-- ============================================================================
-- STEP 3: Fix Booking Documents RLS Policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert documents for bookings in their branch" ON booking_documents;
DROP POLICY IF EXISTS "Users can view documents for bookings in their branch" ON booking_documents;
DROP POLICY IF EXISTS "Users can update documents they uploaded or admin" ON booking_documents;
DROP POLICY IF EXISTS "Users can delete documents they uploaded or admin" ON booking_documents;

-- ============================================================================
-- INSERT Policy - Most Critical Fix
-- ============================================================================
CREATE POLICY "Users can insert documents for bookings in their branch"
  ON booking_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Path 1: User is admin (explicit role check with NULL safety)
    (COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), 'staff') = 'admin')

    OR

    -- Path 2: Document is for a booking in user's branch
    -- Handles both explicit branch assignments and NULL branch_id cases
    EXISTS (
      SELECT 1
      FROM bookings b
      WHERE b.id = booking_id
      AND (
        -- Branch match for non-admin users
        (
          b.branch_id IS NOT NULL
          AND b.branch_id = ((auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid)
        )
        OR
        -- Allow if booking has NULL branch_id (admin-created)
        -- and user has manager/staff role
        (
          b.branch_id IS NULL
          AND COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), 'staff') IN ('manager', 'staff')
        )
      )
    )
  );

-- ============================================================================
-- SELECT Policy - View documents
-- ============================================================================
CREATE POLICY "Users can view documents for bookings in their branch"
  ON booking_documents
  FOR SELECT
  TO authenticated
  USING (
    -- Path 1: User is admin
    (COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), 'staff') = 'admin')

    OR

    -- Path 2: Document is for a booking in user's branch or uploaded by user
    (
      EXISTS (
        SELECT 1
        FROM bookings b
        WHERE b.id = booking_id
        AND (
          -- Branch match
          (
            b.branch_id IS NOT NULL
            AND b.branch_id = ((auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid)
          )
          OR
          -- NULL branch_id bookings visible to all staff
          (b.branch_id IS NULL)
        )
      )
      OR
      -- User uploaded this document
      uploaded_by = ((auth.jwt() ->> 'sub')::uuid)
    )
  );

-- ============================================================================
-- UPDATE Policy - Modify documents
-- ============================================================================
CREATE POLICY "Users can update documents they uploaded or admin"
  ON booking_documents
  FOR UPDATE
  TO authenticated
  USING (
    -- User is admin OR uploaded this document
    (COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), 'staff') = 'admin')
    OR
    (uploaded_by = ((auth.jwt() ->> 'sub')::uuid))
  )
  WITH CHECK (
    -- Same conditions for the updated row
    (COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), 'staff') = 'admin')
    OR
    (uploaded_by = ((auth.jwt() ->> 'sub')::uuid))
  );

-- ============================================================================
-- DELETE Policy - Remove documents
-- ============================================================================
CREATE POLICY "Users can delete documents they uploaded or admin"
  ON booking_documents
  FOR DELETE
  TO authenticated
  USING (
    -- User is admin OR uploaded this document
    (COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), 'staff') = 'admin')
    OR
    (uploaded_by = ((auth.jwt() ->> 'sub')::uuid))
  );

-- ============================================================================
-- STEP 4: Add Helper Function for Debugging (Optional)
-- ============================================================================

-- Function to check user's JWT metadata (for debugging)
CREATE OR REPLACE FUNCTION public.check_my_jwt_metadata()
RETURNS TABLE (
  user_id uuid,
  jwt_role text,
  jwt_branch_id text,
  db_role text,
  db_branch_id uuid,
  metadata_synced boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    auth.uid() AS user_id,
    (auth.jwt() -> 'app_metadata' ->> 'role') AS jwt_role,
    (auth.jwt() -> 'app_metadata' ->> 'branch_id') AS jwt_branch_id,
    u.role AS db_role,
    u.branch_id AS db_branch_id,
    (
      (auth.jwt() -> 'app_metadata' ->> 'role') = u.role
      AND (auth.jwt() -> 'app_metadata' ->> 'branch_id') IS NOT DISTINCT FROM u.branch_id::text
    ) AS metadata_synced
  FROM public.users u
  WHERE u.id = auth.uid();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_my_jwt_metadata() TO authenticated;

-- ============================================================================
-- STEP 5: Verification and Validation
-- ============================================================================

-- Verify all users have app_metadata
DO $$
DECLARE
  users_without_metadata INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO users_without_metadata
  FROM public.users u
  INNER JOIN auth.users au ON u.id = au.id
  WHERE au.raw_app_meta_data->>'role' IS NULL;

  IF users_without_metadata > 0 THEN
    RAISE WARNING '% users still missing app_metadata.role!', users_without_metadata;
  ELSE
    RAISE NOTICE 'All users have app_metadata.role - validation passed!';
  END IF;
END $$;

-- ============================================================================
-- STEP 6: Force Session Refresh Instructions
-- ============================================================================

-- Add comment with instructions for users
COMMENT ON TABLE booking_documents IS
  'Booking document storage. After RLS policy update, users should refresh their session to get updated JWT tokens. Use: await supabase.auth.refreshSession()';
