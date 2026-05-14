-- Fix snag_resolutions RLS policies after role rename (20260428000000).
--
-- 20260428000000 renamed manager→user and mechanic/staff→member but did not
-- update the snag_resolutions policies, so users with role 'user' or 'member'
-- were blocked from resolving snags.

DROP POLICY IF EXISTS "Staff can create snag resolutions" ON snag_resolutions;
CREATE POLICY "Staff can create snag resolutions"
  ON snag_resolutions FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user', 'member')
  );

DROP POLICY IF EXISTS "Staff can update snag resolutions" ON snag_resolutions;
CREATE POLICY "Staff can update snag resolutions"
  ON snag_resolutions FOR UPDATE
  TO authenticated
  USING (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user', 'member')
  )
  WITH CHECK (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user', 'member')
  );
