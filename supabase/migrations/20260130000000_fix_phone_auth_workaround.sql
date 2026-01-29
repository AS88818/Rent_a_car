/*
  # Fix Phone Auth Workaround

  Since Supabase phone auth requires SMS verification, we use a workaround:
  - Phone numbers are converted to email format: phone@phone.local
  - The actual phone number is stored in user_metadata.phone_number

  This migration updates the handle_new_user trigger to:
  1. Extract phone_number from user_metadata when login_type is 'phone'
  2. Store it in the users.phone column
  3. Handle the @phone.local email format gracefully
*/

-- Update the handle_new_user function to support the phone auth workaround
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_email text;
  v_phone text;
  v_login_type text;
BEGIN
  -- Get login_type from user metadata
  v_login_type := NEW.raw_user_meta_data->>'login_type';

  -- If login_type is 'phone', extract phone from metadata and don't use the fake email
  IF v_login_type = 'phone' THEN
    v_phone := NEW.raw_user_meta_data->>'phone_number';
    v_email := NULL;  -- Don't store the fake @phone.local email
  ELSE
    v_email := NEW.email;
    v_phone := NEW.phone;  -- Use actual phone if provided via native phone auth
  END IF;

  INSERT INTO public.users (id, email, phone, full_name, role, branch_id)
  VALUES (
    NEW.id,
    v_email,
    v_phone,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'role', NEW.raw_app_meta_data->>'role', 'staff'),
    COALESCE((NEW.raw_user_meta_data->>'branch_id')::uuid, (NEW.raw_app_meta_data->>'branch_id')::uuid, NULL)
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
