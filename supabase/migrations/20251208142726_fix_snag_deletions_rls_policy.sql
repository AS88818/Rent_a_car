/*
  # Fix snag_deletions RLS policy

  1. Changes
    - Add INSERT policy for snag_deletions table
    - Allow authenticated users to insert deletion records

  2. Purpose
    - Enable users to delete snags by logging them in snag_deletions
    - Maintain audit trail of who deleted what and when
*/

-- Add INSERT policy for snag_deletions
CREATE POLICY "Authenticated users can log snag deletions"
  ON snag_deletions FOR INSERT
  TO authenticated
  WITH CHECK (
    deleted_by = auth.uid()
  );