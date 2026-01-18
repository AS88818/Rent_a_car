/*
  # Add Vehicle Category Type Field

  1. Changes to vehicles table
    - Add `is_personal` (boolean) - Flag to mark vehicles as personal (not available for hire)
    - Default value is false (business vehicles available for hire)

  2. Notes
    - Personal vehicles should not appear in hire availability on dashboard or calendar
    - Personal vehicles will only show reminders for next service, MOT, and insurance renewals
    - Existing vehicles will default to business vehicles (is_personal = false)
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'is_personal'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN is_personal boolean DEFAULT false;
  END IF;
END $$;
