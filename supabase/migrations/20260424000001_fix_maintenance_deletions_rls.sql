-- Fix overly permissive INSERT policy on maintenance_deletions.
-- Drops any existing INSERT policy (either name) then recreates with a
-- proper check: the inserting user must be the one recorded as deleted_by.

drop policy if exists "Authenticated users can insert maintenance deletions" on maintenance_deletions;
drop policy if exists "Users can insert own maintenance deletions" on maintenance_deletions;

create policy "Users can insert own maintenance deletions"
  on maintenance_deletions for insert
  to authenticated
  with check (deleted_by = auth.uid());
