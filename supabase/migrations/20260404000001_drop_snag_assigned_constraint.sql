/*
  # Drop snags_closed_must_be_assigned constraint

  The constraint blocks resolving unassigned snags.
  snag_resolutions already tracks who resolved a snag — the constraint is redundant.
*/

ALTER TABLE snags DROP CONSTRAINT IF EXISTS snags_closed_must_be_assigned;
