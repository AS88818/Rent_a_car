/*
  # Add photo_urls to snags table

  1. Changes
    - Add `photo_urls` column to snags table (optional text array)
    - Allows attaching photos when reporting a snag

  2. Notes
    - Field is optional (nullable/defaults to empty array)
    - Consistent with photo_urls on maintenance_logs and snag_resolutions
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snags' AND column_name = 'photo_urls'
  ) THEN
    ALTER TABLE snags ADD COLUMN photo_urls text[] DEFAULT '{}';
  END IF;
END $$;
