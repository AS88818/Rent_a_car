/*
  # Rename Roles: manager → user, mechanic → member

  1. Role Renames
    - 'manager' → 'user'
    - 'mechanic' → 'member'
    - 'admin' and 'driver' unchanged
    - Legacy 'staff' (if any rows still exist) → 'member'

  2. Permission Notes
    - 'user' has same permissions as 'manager' had: admin minus User Management,
      Pricing Admin, Company Settings, Settings.
    - 'member' = 'user' minus Create Invoice, Emails, Reports.
      Members gain access to Bookings, Quotation, Quotes (mechanics did not have these).

  3. Changes
    - Drop existing users_role_check constraint
    - Migrate role values in public.users
    - Sync auth.users.raw_app_meta_data.role for migrated rows so RLS picks up new values
    - Add new constraint: ('admin', 'user', 'member', 'driver')
    - Set new default role 'member'
    - Re-emit every RLS policy from 20260208021016 with the new literals
    - Fix stale snag_assignments INSERT policy from 20251208132055 which still
      referenced the long-removed 'staff' role
    - Update handle_new_user() default fallback from 'staff' to 'member'

  4. Rollback Notes
    - To revert, run reverse UPDATEs ('user' → 'manager', 'member' → 'mechanic'),
      restore the old CHECK constraint, and re-deploy the prior code commit.
*/

-- =========================================================================
-- 1. Migrate role values + constraint
-- =========================================================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

UPDATE users SET role = 'user'   WHERE role = 'manager';
UPDATE users SET role = 'member' WHERE role = 'mechanic';
UPDATE users SET role = 'member' WHERE role = 'staff';   -- legacy safety net

ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'user', 'member', 'driver'));

ALTER TABLE users ALTER COLUMN role SET DEFAULT 'member';

-- =========================================================================
-- 2. Sync auth.users.raw_app_meta_data.role for migrated rows
--    RLS policies key off (auth.jwt() -> 'app_metadata' ->> 'role'), so the
--    auth metadata must reflect the new values for already-logged-in sessions.
-- =========================================================================

UPDATE auth.users au
SET raw_app_meta_data =
  COALESCE(au.raw_app_meta_data, '{}'::jsonb) ||
  jsonb_build_object('role', u.role)
FROM public.users u
WHERE au.id = u.id
  AND COALESCE(au.raw_app_meta_data->>'role', '') <> u.role;

-- =========================================================================
-- 3. Re-emit RLS policies with new role literals
--    (Mirrors 20260208021016_fix_rls_use_app_metadata.sql)
-- =========================================================================

-- vehicles
DROP POLICY IF EXISTS "Admin and manager can insert vehicles" ON vehicles;
CREATE POLICY "Admin and manager can insert vehicles" ON vehicles
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user')
  );

DROP POLICY IF EXISTS "Admins and managers can update vehicles" ON vehicles;
CREATE POLICY "Admins and managers can update vehicles" ON vehicles
  FOR UPDATE TO authenticated
  USING (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user', 'member')
  )
  WITH CHECK (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user', 'member')
  );

-- snags
DROP POLICY IF EXISTS "Users can update snags" ON snags;
CREATE POLICY "Users can update snags" ON snags
  FOR UPDATE TO authenticated
  USING (
    assigned_to = (select auth.uid()) OR
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user', 'member')
  )
  WITH CHECK (
    assigned_to = (select auth.uid()) OR
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user', 'member')
  );

-- users
DROP POLICY IF EXISTS "Authenticated users can insert users" ON users;
CREATE POLICY "Authenticated users can insert users" ON users
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user')
  );

DROP POLICY IF EXISTS "Authenticated users can update users" ON users;
CREATE POLICY "Authenticated users can update users" ON users
  FOR UPDATE TO authenticated
  USING (
    id = (select auth.uid()) OR
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user')
  )
  WITH CHECK (
    id = (select auth.uid()) OR
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user')
  );

-- quotes
DROP POLICY IF EXISTS "Authenticated users can delete quotes" ON quotes;
CREATE POLICY "Authenticated users can delete quotes" ON quotes
  FOR DELETE TO authenticated
  USING (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user')
  );

-- email_templates
DROP POLICY IF EXISTS "Authenticated users can delete templates" ON email_templates;
CREATE POLICY "Authenticated users can delete templates" ON email_templates
  FOR DELETE TO authenticated
  USING (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user')
  );

DROP POLICY IF EXISTS "Authenticated users can update templates" ON email_templates;
CREATE POLICY "Authenticated users can update templates" ON email_templates
  FOR UPDATE TO authenticated
  USING (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user')
  )
  WITH CHECK (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user')
  );

-- notifications
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) OR
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user')
  );

-- booking_payments
DROP POLICY IF EXISTS "Admins and managers can insert deposit records" ON booking_payments;
CREATE POLICY "Admins and managers can insert deposit records" ON booking_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user')
  );

-- snag_assignments INSERT
-- Original policy in 20251208132055 listed ('admin','manager','staff') and was
-- never updated when 'staff' was migrated to 'mechanic'. That made mechanics
-- effectively unable to create assignments via direct INSERT. Fix and broaden
-- to ('admin','user','member') so Members can self-assign / assign others / reassign.
DROP POLICY IF EXISTS "Staff and managers can create assignments" ON snag_assignments;
DROP POLICY IF EXISTS "Admin and managers can create assignments" ON snag_assignments;
CREATE POLICY "Admin user and member can create assignments" ON snag_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user', 'member')
  );

-- =========================================================================
-- 4. Update handle_new_user trigger fallback from 'staff' to 'member'
-- =========================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_branch_id uuid;
  user_role text;
  user_branch_id uuid;
BEGIN
  SELECT id INTO default_branch_id FROM branches LIMIT 1;

  user_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    NEW.raw_app_meta_data->>'role',
    'member'
  );

  user_branch_id := COALESCE(
    (NEW.raw_user_meta_data->>'branch_id')::uuid,
    (NEW.raw_app_meta_data->>'branch_id')::uuid,
    default_branch_id
  );

  INSERT INTO public.users (id, email, full_name, role, branch_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    user_role,
    user_branch_id
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, users.full_name),
    role = COALESCE(EXCLUDED.role, users.role),
    branch_id = COALESCE(EXCLUDED.branch_id, users.branch_id);

  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object('role', user_role, 'branch_id', user_branch_id::text)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;
