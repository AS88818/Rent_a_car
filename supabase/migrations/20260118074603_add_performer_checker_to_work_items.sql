/*
  # Add Performer and Checker fields to Maintenance Work Items

  1. Changes to `maintenance_work_items` table
    - Add `performed_by` (text) - Name of person/service center who performed this work item
    - Add `performed_by_user_id` (uuid, nullable) - Reference to user who performed the work (if registered)
    - Add `checked_by_user_id` (uuid, nullable) - Reference to user who checked the work (if applicable)
  
  2. Purpose
    - Allow each work item to have its own performer and checker
    - Support both registered mechanics and external service centers
    - Enable better tracking of who did what work
  
  3. Notes
    - These fields are independent from the parent maintenance_logs table
    - performed_by is always required, but performed_by_user_id is only set for registered mechanics
    - checked_by_user_id is optional (quality check may not always be performed)
*/

-- Add new columns to maintenance_work_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenance_work_items' AND column_name = 'performed_by'
  ) THEN
    ALTER TABLE maintenance_work_items ADD COLUMN performed_by text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenance_work_items' AND column_name = 'performed_by_user_id'
  ) THEN
    ALTER TABLE maintenance_work_items ADD COLUMN performed_by_user_id uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenance_work_items' AND column_name = 'checked_by_user_id'
  ) THEN
    ALTER TABLE maintenance_work_items ADD COLUMN checked_by_user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;