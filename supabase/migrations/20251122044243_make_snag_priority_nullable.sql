/*
  # Make snag priority optional

  1. Changes
    - Alter the `snags` table to make the `priority` column nullable
    - Remove the NOT NULL constraint from `priority` column
    - Keep the CHECK constraint for valid priority values when provided

  2. Notes
    - This allows users to create snags without assigning a priority
    - Priority can still only be one of: 'Dangerous', 'Important', 'Nice to Fix', 'Aesthetic' when set
*/

-- Make priority column nullable
ALTER TABLE snags
  ALTER COLUMN priority DROP NOT NULL;

-- Update the check constraint to allow null values
ALTER TABLE snags
  DROP CONSTRAINT IF EXISTS snags_priority_check;

ALTER TABLE snags
  ADD CONSTRAINT snags_priority_check
  CHECK (priority IS NULL OR priority IN ('Dangerous', 'Important', 'Nice to Fix', 'Aesthetic'));
