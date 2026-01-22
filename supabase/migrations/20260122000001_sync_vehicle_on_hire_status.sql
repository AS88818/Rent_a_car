/*
  # Sync Vehicle On-Hire Status

  Fixes data inconsistency where vehicles have mismatched on_hire and status fields.

  ## Changes
  1. For vehicles WITHOUT active bookings: set on_hire = false, status = 'Available' (unless Grounded)
  2. For vehicles WITH active bookings: set on_hire = true, status = 'On Hire', branch_id = NULL
*/

-- First, reset all vehicles that are marked on_hire=true OR status='On Hire' but have no active booking
-- Keep health_flag = 'Grounded' vehicles as 'Grounded' status
UPDATE vehicles v
SET
  on_hire = false,
  on_hire_location = NULL,
  status = CASE
    WHEN v.health_flag = 'Grounded' THEN 'Grounded'
    ELSE 'Available'
  END
WHERE (v.on_hire = true OR v.status = 'On Hire')
  AND NOT EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.vehicle_id = v.id
      AND b.status = 'Active'
  );

-- Then, ensure vehicles with active bookings are properly marked
-- Note: The vehicles_location_check constraint requires branch_id = NULL when on_hire = true
UPDATE vehicles v
SET
  on_hire = true,
  status = 'On Hire',
  branch_id = NULL,
  on_hire_location = (
    SELECT b.client_name
    FROM bookings b
    WHERE b.vehicle_id = v.id
      AND b.status = 'Active'
    LIMIT 1
  )
WHERE EXISTS (
  SELECT 1 FROM bookings b
  WHERE b.vehicle_id = v.id
    AND b.status = 'Active'
);
