/*
  # Change Email Templates from Category to Multiple Vehicles

  1. Changes
    - Remove vehicle_category_id column from email_templates
    - Add vehicle_ids column as text array to support multiple vehicles
    - Update indexes to reflect new structure
    
  2. Migration Strategy
    - Drop existing foreign key constraint
    - Remove vehicle_category_id column
    - Add vehicle_ids array column
    - Create index on vehicle_ids for performance
    
  3. Security
    - No RLS policy changes needed
    - Existing policies continue to work
*/

-- Drop the foreign key constraint first
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_templates_vehicle_category_id_fkey'
  ) THEN
    ALTER TABLE email_templates DROP CONSTRAINT email_templates_vehicle_category_id_fkey;
  END IF;
END $$;

-- Drop the index
DROP INDEX IF EXISTS idx_email_templates_vehicle_category;

-- Remove the vehicle_category_id column
ALTER TABLE email_templates DROP COLUMN IF EXISTS vehicle_category_id;

-- Add vehicle_ids array column (nullable - empty means all vehicles)
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS vehicle_ids text[] DEFAULT '{}';

-- Create index for vehicle_ids array for performance
CREATE INDEX IF NOT EXISTS idx_email_templates_vehicle_ids 
  ON email_templates USING GIN(vehicle_ids);

-- Add comment explaining the column
COMMENT ON COLUMN email_templates.vehicle_ids IS 'Array of vehicle IDs this template applies to. Empty array means applies to all vehicles.';
