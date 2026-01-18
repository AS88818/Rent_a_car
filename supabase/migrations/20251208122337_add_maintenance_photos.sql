/*
  # Add Photo Storage to Maintenance Logs

  1. Changes
    - Add `photo_urls` column to maintenance_logs table to store array of photo URLs
    - Photos will be stored in Supabase storage bucket

  2. Security
    - Existing RLS policies continue to apply
    - Photos are stored as an array of text URLs
*/

-- Add photo_urls column to maintenance_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenance_logs' AND column_name = 'photo_urls'
  ) THEN
    ALTER TABLE maintenance_logs ADD COLUMN photo_urls text[] DEFAULT '{}';
  END IF;
END $$;