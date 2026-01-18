/*
  # Make branch_id nullable in vehicles table
  
  ## Changes
  1. Make branch_id nullable to support on_hire vehicles
  2. Add check constraint to ensure either branch_id is set OR on_hire is true
  
  ## Rationale
  - When a vehicle is on hire, it's not at a branch location
  - branch_id should be null when on_hire is true
  - This prevents the need for a dummy "On Hire" branch
*/

-- Drop the foreign key constraint temporarily
ALTER TABLE vehicles
DROP CONSTRAINT IF EXISTS vehicles_branch_id_fkey;

-- Make branch_id nullable
ALTER TABLE vehicles
ALTER COLUMN branch_id DROP NOT NULL;

-- Re-add the foreign key constraint
ALTER TABLE vehicles
ADD CONSTRAINT vehicles_branch_id_fkey 
  FOREIGN KEY (branch_id) 
  REFERENCES branches(id)
  ON DELETE NO ACTION;

-- Add a check constraint to ensure data integrity
-- Either branch_id must be set (not on hire) OR on_hire must be true
ALTER TABLE vehicles
DROP CONSTRAINT IF EXISTS vehicles_location_check;

ALTER TABLE vehicles
ADD CONSTRAINT vehicles_location_check
  CHECK (
    (branch_id IS NOT NULL AND (on_hire IS NULL OR on_hire = false))
    OR
    (on_hire = true AND branch_id IS NULL)
  );

COMMENT ON CONSTRAINT vehicles_location_check ON vehicles IS 
  'Ensures vehicle is either at a branch (branch_id set) or on hire (on_hire=true), but not both';
