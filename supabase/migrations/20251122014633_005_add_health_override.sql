/*
  # Add Manual Health Override Feature

  1. Changes
    - Add `health_override` column to vehicles table
      - Boolean field to indicate if health is manually set
      - Defaults to false (auto-calculated)
    
  2. Notes
    - When health_override is true, health_flag is manually set by admin/fleet_manager
    - When health_override is false, health_flag is auto-calculated from snags
    - Existing vehicles will have health_override = false (auto mode)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'health_override'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN health_override BOOLEAN DEFAULT false;
  END IF;
END $$;