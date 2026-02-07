/*
  # Consolidate vehicle on-hire logic: use status only, decouple from location

  ## Problem
  - "On Hire" was treated as both a status AND a location
  - Two competing trigger systems caused inconsistent branch_id values
  - Redundant on_hire boolean column duplicated status = 'On Hire'
  - Frontend displayed "On Hire" in Location column instead of actual branch

  ## Changes

  1. Data Fix
    - Set branch_id for vehicles that currently have NULL branch_id
    - Derived from active booking start_location or booking's branch_id

  2. Trigger Consolidation
    - Drop all old competing triggers and functions
    - Create single trigger function `manage_vehicle_booking_status()`
    - Active booking -> status = 'On Hire', branch_id preserved (pickup branch)
    - Completed booking -> status = 'Available'/'Grounded', branch_id = drop-off branch
    - Cancelled booking -> status = 'Available'/'Grounded', branch_id unchanged

  3. Column Removal
    - Drop `on_hire` boolean (replaced by status = 'On Hire')
    - Drop `on_hire_location` (client info from active booking)

  4. RLS Policy Updates
    - Replace `on_hire = true` with `status = 'On Hire'` in vehicle update policies

  5. View Updates
    - Recreate `active_vehicles` view without dropped columns
*/

-- ============================================================
-- STEP 1: Fix NULL branch_ids for on-hire vehicles
-- ============================================================

-- For on-hire vehicles: derive branch from active booking start_location
WITH vehicle_branch_fix AS (
  SELECT DISTINCT ON (b.vehicle_id)
    b.vehicle_id,
    COALESCE(
      (SELECT br.id FROM branches br WHERE LOWER(br.branch_name) = LOWER(b.start_location) LIMIT 1),
      b.branch_id
    ) as derived_branch_id
  FROM bookings b
  JOIN vehicles v ON v.id = b.vehicle_id
  WHERE v.branch_id IS NULL
  AND b.status = 'Active'
  ORDER BY b.vehicle_id, b.created_at DESC
)
UPDATE vehicles v
SET branch_id = vbf.derived_branch_id
FROM vehicle_branch_fix vbf
WHERE v.id = vbf.vehicle_id
AND v.branch_id IS NULL
AND vbf.derived_branch_id IS NOT NULL;

-- For any remaining vehicles with NULL branch_id: derive from most recent booking
WITH vehicle_branch_fix2 AS (
  SELECT DISTINCT ON (b.vehicle_id)
    b.vehicle_id,
    COALESCE(
      (SELECT br.id FROM branches br WHERE LOWER(br.branch_name) = LOWER(b.end_location) LIMIT 1),
      b.branch_id
    ) as derived_branch_id
  FROM bookings b
  JOIN vehicles v ON v.id = b.vehicle_id
  WHERE v.branch_id IS NULL
  ORDER BY b.vehicle_id, b.updated_at DESC
)
UPDATE vehicles v
SET branch_id = vbf2.derived_branch_id
FROM vehicle_branch_fix2 vbf2
WHERE v.id = vbf2.vehicle_id
AND v.branch_id IS NULL
AND vbf2.derived_branch_id IS NOT NULL;

-- For any still remaining (no bookings at all): assign to first branch
UPDATE vehicles
SET branch_id = (SELECT id FROM branches ORDER BY branch_name LIMIT 1)
WHERE branch_id IS NULL;


-- ============================================================
-- STEP 2: Drop ALL old triggers on bookings related to vehicle status
-- ============================================================

DROP TRIGGER IF EXISTS trigger_manage_vehicle_on_hire_insert ON bookings;
DROP TRIGGER IF EXISTS trigger_manage_vehicle_on_hire_update ON bookings;
DROP TRIGGER IF EXISTS trigger_sync_vehicle_status_on_booking ON bookings;
DROP TRIGGER IF EXISTS trigger_update_vehicle_location ON bookings;


-- ============================================================
-- STEP 3: Drop old functions
-- ============================================================

DROP FUNCTION IF EXISTS manage_vehicle_on_hire_status() CASCADE;
DROP FUNCTION IF EXISTS sync_vehicle_status_on_booking() CASCADE;
DROP FUNCTION IF EXISTS update_vehicle_on_hire_status(uuid) CASCADE;
DROP FUNCTION IF EXISTS update_vehicle_location_on_booking_complete() CASCADE;


-- ============================================================
-- STEP 4: Create new consolidated trigger function
-- ============================================================

CREATE OR REPLACE FUNCTION manage_vehicle_booking_status()
RETURNS TRIGGER AS $$
DECLARE
  end_location_branch_id uuid;
  active_count integer;
BEGIN
  -- When a booking becomes Active: set vehicle status to On Hire, preserve branch_id
  IF (TG_OP = 'INSERT' AND NEW.status = 'Active') OR
     (TG_OP = 'UPDATE' AND NEW.status = 'Active' AND OLD.status != 'Active') THEN

    UPDATE vehicles
    SET status = 'On Hire'
    WHERE id = NEW.vehicle_id;

  -- When booking is Completed: clear On Hire, update branch to drop-off location
  ELSIF TG_OP = 'UPDATE' AND
        NEW.status = 'Completed' AND
        OLD.status != 'Completed' THEN

    SELECT COUNT(*) INTO active_count
    FROM bookings
    WHERE vehicle_id = NEW.vehicle_id
    AND status = 'Active'
    AND id != NEW.id;

    IF active_count = 0 THEN
      SELECT id INTO end_location_branch_id
      FROM branches
      WHERE LOWER(branch_name) = LOWER(NEW.end_location)
      LIMIT 1;

      UPDATE vehicles
      SET
        status = CASE WHEN health_flag = 'Grounded' THEN 'Grounded' ELSE 'Available' END,
        branch_id = COALESCE(end_location_branch_id, branch_id)
      WHERE id = NEW.vehicle_id;
    END IF;

  -- When booking is Cancelled: clear On Hire, keep branch unchanged
  ELSIF TG_OP = 'UPDATE' AND
        NEW.status = 'Cancelled' AND
        OLD.status NOT IN ('Completed', 'Cancelled') THEN

    SELECT COUNT(*) INTO active_count
    FROM bookings
    WHERE vehicle_id = NEW.vehicle_id
    AND status = 'Active'
    AND id != NEW.id;

    IF active_count = 0 THEN
      UPDATE vehicles
      SET status = CASE WHEN health_flag = 'Grounded' THEN 'Grounded' ELSE 'Available' END
      WHERE id = NEW.vehicle_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- ============================================================
-- STEP 5: Create new triggers
-- ============================================================

CREATE TRIGGER trigger_vehicle_booking_status_insert
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION manage_vehicle_booking_status();

CREATE TRIGGER trigger_vehicle_booking_status_update
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION manage_vehicle_booking_status();


-- ============================================================
-- STEP 6: Update RLS policies - replace on_hire = true with status = 'On Hire'
-- ============================================================

DROP POLICY IF EXISTS "Admins and managers can update vehicles" ON vehicles;
CREATE POLICY "Admins and managers can update vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role' = 'admin')
    OR (
      auth.jwt()->'app_metadata'->>'role' = 'manager'
      AND (
        branch_id = (auth.jwt()->'app_metadata'->>'branch_id')::uuid
        OR status = 'On Hire'
      )
    )
  )
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role' = 'admin')
    OR (
      auth.jwt()->'app_metadata'->>'role' = 'manager'
      AND (
        branch_id = (auth.jwt()->'app_metadata'->>'branch_id')::uuid
        OR status = 'On Hire'
      )
    )
  );

DROP POLICY IF EXISTS "Staff can update vehicle health in their branch" ON vehicles;
CREATE POLICY "Staff can update vehicle health in their branch"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    auth.jwt()->'app_metadata'->>'role' = 'staff'
    AND (
      branch_id = (auth.jwt()->'app_metadata'->>'branch_id')::uuid
      OR status = 'On Hire'
    )
  )
  WITH CHECK (
    auth.jwt()->'app_metadata'->>'role' = 'staff'
    AND (
      branch_id = (auth.jwt()->'app_metadata'->>'branch_id')::uuid
      OR status = 'On Hire'
    )
  );


-- ============================================================
-- STEP 7: Drop the active_vehicles view (references on_hire columns)
-- ============================================================

DROP VIEW IF EXISTS active_vehicles;


-- ============================================================
-- STEP 8: Drop on_hire and on_hire_location columns
-- ============================================================

ALTER TABLE vehicles DROP COLUMN IF EXISTS on_hire;
ALTER TABLE vehicles DROP COLUMN IF EXISTS on_hire_location;


-- ============================================================
-- STEP 9: Recreate active_vehicles view without dropped columns
-- ============================================================

CREATE OR REPLACE VIEW active_vehicles AS
SELECT
  id, reg_number, category_id, branch_id, status, health_flag,
  insurance_expiry, mot_expiry, current_mileage, last_mileage_update,
  market_value, created_at, updated_at, health_override, service_interval_km,
  last_service_mileage, next_service_mileage, make, model, colour, fuel_type,
  transmission, spare_key, owner_name, is_personal, current_location,
  spare_key_location, mot_not_applicable, chassis_number, no_of_passengers,
  luggage_space, is_draft, deleted_at
FROM vehicles
WHERE deleted_at IS NULL;
