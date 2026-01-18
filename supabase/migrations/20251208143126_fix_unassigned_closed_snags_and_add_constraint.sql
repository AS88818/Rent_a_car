/*
  # Fix unassigned closed snags and add constraint

  1. Changes
    - Reopen any closed snags that don't have an assignment
    - Add check constraint to prevent closing unassigned snags in the future

  2. Purpose
    - Maintain data integrity by ensuring all closed snags have an assignee
    - Enforce business rule: snags must be assigned before they can be closed
*/

-- First, reopen any closed snags that don't have an assignment
UPDATE snags 
SET status = 'Open'
WHERE status = 'Closed' AND assigned_to IS NULL;

-- Add constraint to snags table
-- A snag can only have status 'Closed' if it has an assigned_to value
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'snags_closed_must_be_assigned'
  ) THEN
    ALTER TABLE snags 
    ADD CONSTRAINT snags_closed_must_be_assigned 
    CHECK (
      (status = 'Closed' AND assigned_to IS NOT NULL) OR 
      (status != 'Closed')
    );
  END IF;
END $$;