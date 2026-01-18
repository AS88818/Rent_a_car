/*
  # Allow Mechanics to View All Vehicles and Maintenance Data

  1. Problem
    - Mechanics currently can only see vehicles and maintenance in their assigned branch
    - They need access to all vehicles across all branches to perform their work

  2. Changes
    - Update vehicles SELECT policy to allow mechanics to view all vehicles
    - Update maintenance_logs SELECT policy to allow mechanics to view all logs
    - Update mileage_logs SELECT policy to allow mechanics to view all logs

  3. Security
    - Mechanics can view all vehicles, maintenance logs, and mileage logs
    - Mechanics can still only create/edit within their branch (existing policies)
    - Admins maintain full access
    - Managers and other staff still limited to their branch
*/

-- ============================================================================
-- VEHICLES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can view vehicles" ON vehicles;

CREATE POLICY "Authenticated users can view vehicles"
  ON vehicles
  FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'mechanic')
    OR (
      ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('manager', 'staff', 'driver'))
      AND branch_id = ((auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid)
    )
  );

-- ============================================================================
-- MAINTENANCE_LOGS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can view maintenance logs" ON maintenance_logs;

CREATE POLICY "Authenticated users can view maintenance logs"
  ON maintenance_logs
  FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'mechanic')
    OR (
      ((auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['manager', 'staff', 'driver']))
      AND (branch_id = ((auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid))
    )
  );

-- ============================================================================
-- MILEAGE_LOGS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can view mileage logs" ON mileage_logs;

CREATE POLICY "Authenticated users can view mileage logs"
  ON mileage_logs
  FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'mechanic')
    OR (
      ((auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['manager', 'staff', 'driver']))
      AND (branch_id = ((auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid))
    )
  );