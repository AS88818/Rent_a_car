/*
  # Add automatic updated_at trigger for vehicles table

  1. Purpose
    - Automatically update the `updated_at` column in the vehicles table whenever a row is modified
    - Ensures the "Last Updated" column displays the correct timestamp for all vehicle updates

  2. Changes
    - Creates a reusable trigger function `update_updated_at_column()` if it doesn't exist
    - Adds a trigger on the vehicles table to call this function before any UPDATE operation

  3. Notes
    - This is a standard pattern for maintaining updated_at timestamps
    - The trigger fires BEFORE UPDATE to set the new timestamp
    - Works automatically for all vehicle updates (location, mileage, health, etc.)
*/

-- Create the trigger function (if it doesn't already exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS update_vehicles_updated_at ON vehicles;

-- Create the trigger for the vehicles table
CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
