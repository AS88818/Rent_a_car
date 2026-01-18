/*
  # Add Mileage Tracking to Snags

  1. Changes
    - Add `mileage_reported` column to snags table (optional integer field)
    - This allows tracking at what vehicle mileage a snag was reported
    - Can be compared with current mileage to see how long ago the snag occurred

  2. Notes
    - Field is optional (nullable) as not all historical snags will have this data
    - No default value - will be NULL if not provided
    - Useful for tracking snag lifecycle and maintenance intervals
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snags' AND column_name = 'mileage_reported'
  ) THEN
    ALTER TABLE snags ADD COLUMN mileage_reported integer;
  END IF;
END $$;
