/*
  # Add On Hire Status to Vehicles
  
  ## Changes
  1. Add `on_hire` boolean field to vehicles table
  2. Add `on_hire_location` text field for storing location when on hire
  3. Update display logic to show "On Hire" instead of branch when vehicle is on hire
  
  ## Notes
  - When on_hire is true, the vehicle is not assigned to a branch
  - The on_hire_location field stores where the vehicle is currently hired out to
  - This allows tracking vehicles that are out on hire without treating it as a branch
*/

-- Add on_hire status field
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS on_hire BOOLEAN DEFAULT false;

-- Add location field for when vehicle is on hire
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS on_hire_location TEXT;

-- Add comment for clarity
COMMENT ON COLUMN vehicles.on_hire IS 'Indicates if the vehicle is currently on hire (not in a branch)';
COMMENT ON COLUMN vehicles.on_hire_location IS 'Location/customer details when vehicle is on hire';
