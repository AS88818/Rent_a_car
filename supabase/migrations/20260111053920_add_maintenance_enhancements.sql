/*
  # Add Maintenance Log Enhancements

  1. New Fields
    - `performed_by_user_id` (uuid, nullable) - Reference to registered mechanic
    - `checked_by_user_id` (uuid, nullable) - Reference to user who checked the work
    - `work_category` (text, nullable) - Category of maintenance work performed

  2. Purpose
    - Track which registered mechanics perform maintenance work
    - Track quality control via "checked by" field
    - Categorize maintenance work for better tracking and diagnostics
    - Support external/unregistered mechanics via existing performed_by text field

  3. Work Categories
    - Engine / Fuel
    - Gearbox
    - Suspension
    - Electrical
    - Body
    - Accessories
*/

-- Add new columns to maintenance_logs table
DO $$
BEGIN
  -- Add performed_by_user_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenance_logs' AND column_name = 'performed_by_user_id'
  ) THEN
    ALTER TABLE maintenance_logs 
    ADD COLUMN performed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  -- Add checked_by_user_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenance_logs' AND column_name = 'checked_by_user_id'
  ) THEN
    ALTER TABLE maintenance_logs 
    ADD COLUMN checked_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  -- Add work_category column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenance_logs' AND column_name = 'work_category'
  ) THEN
    ALTER TABLE maintenance_logs 
    ADD COLUMN work_category text CHECK (
      work_category IS NULL OR 
      work_category IN ('Engine / Fuel', 'Gearbox', 'Suspension', 'Electrical', 'Body', 'Accessories')
    );
  END IF;
END $$;

-- Create indexes for the new foreign key columns
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_performed_by_user_id 
  ON maintenance_logs(performed_by_user_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_logs_checked_by_user_id 
  ON maintenance_logs(checked_by_user_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_logs_work_category 
  ON maintenance_logs(work_category);