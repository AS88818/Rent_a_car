/*
  # Fix Trigger Function Schema and Permissions

  1. Changes
    - Recreate handle_new_user function with explicit public schema
    - Grant execute permissions on the function
    - Ensure function runs with proper privileges to bypass RLS
*/

-- Drop and recreate the function with proper settings
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert directly into public.users, bypassing RLS
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
EXCEPTION WHEN OTHERS THEN
  -- Log the error for debugging
  RAISE WARNING 'Failed to create user profile for %: %', NEW.email, SQLERRM;
  -- Don't fail the auth signup
  RETURN NEW;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();
