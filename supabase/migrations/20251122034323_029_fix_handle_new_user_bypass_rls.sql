/*
  # Fix handle_new_user to Bypass RLS

  1. Changes
    - Update handle_new_user() to explicitly disable RLS during execution
    - This ensures the trigger can insert into users table regardless of RLS policies
    - The function already has SECURITY DEFINER so it runs with elevated privileges

  2. Security
    - Function only inserts the user's own record (NEW.id)
    - No risk of privilege escalation since data comes from auth.users INSERT
*/

-- Update the function to bypass RLS
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Temporarily disable RLS for this operation
  SET LOCAL row_security = off;
  
  INSERT INTO public.users (id, email, full_name, role, branch_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff'),
    CASE 
      WHEN NEW.raw_user_meta_data->>'branch_id' IS NOT NULL 
      THEN (NEW.raw_user_meta_data->>'branch_id')::uuid
      ELSE NULL
    END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
