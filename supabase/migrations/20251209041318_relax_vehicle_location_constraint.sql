/*
  # Relax Vehicle Location Constraint

  1. Purpose
    - Allow vehicles to be unassigned (neither at a branch nor on hire)
    - This supports the workflow where vehicles return from bookings and need to be manually assigned

  2. Changes
    - Drop the strict vehicles_location_check constraint
    - Add a more relaxed constraint that allows three states:
      a) Vehicle at a branch: branch_id IS NOT NULL, on_hire = false/null
      b) Vehicle on hire: on_hire = true, branch_id IS NULL
      c) Vehicle unassigned: branch_id IS NULL, on_hire = false/null

  3. Important Notes
    - Vehicles can now be "Available" without a branch assignment
    - This is intentional to support the return-from-hire workflow
    - Staff should manually assign vehicles to branches after bookings end
*/

-- Drop the old constraint
ALTER TABLE vehicles
DROP CONSTRAINT IF EXISTS vehicles_location_check;

-- Add new relaxed constraint
-- This ensures that if on_hire is true, then branch_id must be null
-- But allows branch_id to be null even when on_hire is false (unassigned state)
ALTER TABLE vehicles
ADD CONSTRAINT vehicles_location_check
  CHECK (
    (on_hire = true AND branch_id IS NULL)
    OR
    (on_hire IS NULL OR on_hire = false)
  );

COMMENT ON CONSTRAINT vehicles_location_check ON vehicles IS 
  'Ensures that when vehicle is on hire, it has no branch assignment. Allows unassigned vehicles (neither at branch nor on hire).';
