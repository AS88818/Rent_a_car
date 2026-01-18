/*
  # Add status column to users table

  1. Changes
    - Add `status` column to `users` table with default value 'active'
    - Add check constraint to ensure status is either 'active' or 'inactive'
    - Update existing users to have 'active' status

  2. Purpose
    - Track whether users are active or inactive in the system
    - Allow filtering of active users in assignment dropdowns
*/

-- Add status column with default 'active'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'status'
  ) THEN
    ALTER TABLE users ADD COLUMN status text DEFAULT 'active' CHECK (status IN ('active', 'inactive'));
    
    -- Update existing users to be active
    UPDATE users SET status = 'active' WHERE status IS NULL;
  END IF;
END $$;