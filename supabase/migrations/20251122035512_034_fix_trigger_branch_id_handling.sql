/*
  # Fix Trigger Function to Handle Null Metadata Properly

  1. Changes
    - Fix handle_new_user function to properly handle null/missing metadata fields
    - Use safer JSON extraction that won't fail on missing keys
    - Add proper null checks and coalesce handling

  2. Notes
    - The error was: record "new" has no field "branch_id"
    - Need to safely extract from JSONB without assuming keys exist
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_full_name text;
  user_role text;
  user_branch_id uuid;
BEGIN
  -- Safely extract metadata with proper null handling
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User');
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'staff');
  
  -- Handle branch_id carefully - it might not exist in metadata
  BEGIN
    IF NEW.raw_user_meta_data IS NOT NULL AND NEW.raw_user_meta_data ? 'branch_id' THEN
      user_branch_id := (NEW.raw_user_meta_data->>'branch_id')::uuid;
    ELSE
      user_branch_id := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    user_branch_id := NULL;
  END;
  
  -- Insert into public.users
  INSERT INTO public.users (id, email, full_name, role, branch_id)
  VALUES (
    NEW.id,
    NEW.email,
    user_full_name,
    user_role,
    user_branch_id
  );
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error for debugging
  RAISE WARNING 'Failed to create user profile for %: % (SQLSTATE: %)', 
    NEW.email, SQLERRM, SQLSTATE;
  -- Don't fail the auth signup
  RETURN NEW;
END;
$$;
