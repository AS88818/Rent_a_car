/*
  # Add soft delete to users table

  1. Changes
    - Add `deleted_at` column to `users` table for soft delete functionality
    - Update RLS policies to exclude deleted users from queries

  2. Purpose
    - Allow admins to "delete" users without requiring auth admin privileges
    - Preserve user data for audit trail
    - Deleted users won't appear in user lists or be able to log in
*/

-- Add deleted_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE users ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- Create index for faster queries filtering deleted users
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
