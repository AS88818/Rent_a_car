/*
  # Fix All Remaining JWT Paths in RLS Policies

  1. Problem
    - Multiple tables still using incorrect JWT paths
    - Checking `auth.jwt() ->> 'role'` instead of `auth.jwt() -> 'app_metadata' ->> 'role'`
    - Same issue with branch_id
    - Causes "row-level security policy" violations

  2. Tables Fixed
    - email_templates (2 policies)
    - mileage_logs (2 policies)
    - quotes (3 policies)
    - snag_assignments (1 policy)
    - users (2 policies)
    
  3. Security
    - Maintains existing access control rules
    - Only fixes JWT path structure
*/

-- ============================================================================
-- EMAIL_TEMPLATES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can update templates" ON email_templates;
DROP POLICY IF EXISTS "Authenticated users can delete templates" ON email_templates;

CREATE POLICY "Authenticated users can update templates"
  ON email_templates
  FOR UPDATE
  TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'))
  WITH CHECK (((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'));

CREATE POLICY "Authenticated users can delete templates"
  ON email_templates
  FOR DELETE
  TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'));

-- ============================================================================
-- MILEAGE_LOGS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can view mileage logs" ON mileage_logs;
DROP POLICY IF EXISTS "Authenticated users can insert mileage logs" ON mileage_logs;

CREATE POLICY "Authenticated users can view mileage logs"
  ON mileage_logs
  FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR (
      ((auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['manager', 'staff']))
      AND (branch_id = ((auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid))
    )
  );

CREATE POLICY "Authenticated users can insert mileage logs"
  ON mileage_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR (
      ((auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['manager', 'staff']))
      AND (branch_id = ((auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid))
    )
  );

-- ============================================================================
-- QUOTES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can view quotes" ON quotes;
DROP POLICY IF EXISTS "Authenticated users can update quotes" ON quotes;
DROP POLICY IF EXISTS "Authenticated users can delete quotes" ON quotes;

CREATE POLICY "Authenticated users can view quotes"
  ON quotes
  FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  );

CREATE POLICY "Authenticated users can update quotes"
  ON quotes
  FOR UPDATE
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  )
  WITH CHECK (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  );

CREATE POLICY "Authenticated users can delete quotes"
  ON quotes
  FOR DELETE
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  );

-- ============================================================================
-- SNAG_ASSIGNMENTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can view snag assignments" ON snag_assignments;

CREATE POLICY "Authenticated users can view snag assignments"
  ON snag_assignments
  FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR (
      ((auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['manager', 'staff']))
      AND (
        EXISTS (
          SELECT 1 FROM snags
          WHERE snags.id = snag_assignments.snag_id
          AND snags.branch_id = ((auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid)
        )
        OR assigned_to = auth.uid()
      )
    )
  );

-- ============================================================================
-- USERS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can insert users" ON users;
DROP POLICY IF EXISTS "Authenticated users can update users" ON users;

CREATE POLICY "Authenticated users can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR (
      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
      AND branch_id = ((auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid)
    )
  );

CREATE POLICY "Authenticated users can update users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR (
      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
      AND branch_id = ((auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid)
    )
    OR id = auth.uid()
  )
  WITH CHECK (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR (
      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
      AND branch_id = ((auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid)
    )
    OR id = auth.uid()
  );
