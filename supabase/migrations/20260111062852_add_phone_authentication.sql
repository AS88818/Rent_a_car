/*
  # Add Phone Authentication Support

  1. Changes to Users Table
    - Add `phone` column to store phone numbers
    - Make `email` column nullable (users can have email OR phone)
    - Add constraint to ensure at least one contact method exists
    - Update unique constraint handling

  2. Function Updates
    - Update handle_new_user to support phone-based registration
    - Handle both email and phone authentication

  3. Security
    - Maintain existing RLS policies
    - Ensure data integrity with check constraints
*/

-- Step 1: Add phone column (without unique constraint first)
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;

-- Step 2: Make email nullable
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Step 3: Add unique constraint to phone
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_phone_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_phone_key UNIQUE (phone);
  END IF;
END $$;

-- Step 4: Add constraint to ensure at least one contact method exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_contact_method_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_contact_method_check
      CHECK (email IS NOT NULL OR phone IS NOT NULL);
  END IF;
END $$;

-- Step 5: Update the handle_new_user function to support phone authentication
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, phone, full_name, role, branch_id)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_app_meta_data->>'role', 'staff'),
    COALESCE((NEW.raw_app_meta_data->>'branch_id')::uuid, NULL)
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(EXCLUDED.email, users.email),
    phone = COALESCE(EXCLUDED.phone, users.phone),
    full_name = COALESCE(EXCLUDED.full_name, users.full_name),
    role = COALESCE(EXCLUDED.role, users.role),
    branch_id = COALESCE(EXCLUDED.branch_id, users.branch_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
