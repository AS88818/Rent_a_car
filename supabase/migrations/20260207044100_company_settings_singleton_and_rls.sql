/*
  # Enforce Company Settings Singleton and Complete RLS

  1. Changes
    - Add unique constraint to enforce exactly one row in company_settings
    - Add INSERT policy (admin only, restricted)
    - Add DELETE policy (deny all - prevent accidental deletion)

  2. Security
    - INSERT restricted to admin role only
    - DELETE denied for all users (company settings should never be deleted)
    - Existing SELECT and UPDATE policies remain unchanged

  3. Important Notes
    - Uses a boolean column trick with unique constraint to enforce singleton
    - The singleton_guard column defaults to true and is constrained to only allow one row
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'singleton_guard'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN singleton_guard boolean NOT NULL DEFAULT true;
    ALTER TABLE company_settings ADD CONSTRAINT company_settings_singleton UNIQUE (singleton_guard);
    ALTER TABLE company_settings ADD CONSTRAINT company_settings_singleton_check CHECK (singleton_guard = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_settings' AND policyname = 'Only admin can insert company settings'
  ) THEN
    CREATE POLICY "Only admin can insert company settings"
      ON company_settings
      FOR INSERT
      TO authenticated
      WITH CHECK (
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_settings' AND policyname = 'Nobody can delete company settings'
  ) THEN
    CREATE POLICY "Nobody can delete company settings"
      ON company_settings
      FOR DELETE
      TO authenticated
      USING (false);
  END IF;
END $$;
