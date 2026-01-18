/*
  # Add soft delete functionality to snags

  1. Changes
    - Add `deleted_at` column to track when a snag was deleted
    - Add `deleted_by` column to track who deleted the snag
    - Snags will no longer be permanently deleted, just marked as deleted

  2. Purpose
    - Keep historical record of all snags including deleted ones
    - Allow viewing deleted snags for audit purposes
    - Track who deleted each snag and when
*/

-- Add soft delete columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snags' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE snags ADD COLUMN deleted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snags' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE snags ADD COLUMN deleted_by uuid REFERENCES users(id);
  END IF;
END $$;

-- Add index for efficient querying of non-deleted snags
CREATE INDEX IF NOT EXISTS idx_snags_deleted_at ON snags(deleted_at) WHERE deleted_at IS NULL;