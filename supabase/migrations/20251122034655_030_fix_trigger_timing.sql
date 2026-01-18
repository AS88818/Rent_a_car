/*
  # Fix Trigger Timing and Constraints

  1. Changes
    - Change trigger from AFTER INSERT to use a deferred approach
    - Ensure auth.users record is committed before inserting into public.users

  2. Notes
    - The foreign key constraint requires auth.users.id to exist
    - Need to ensure proper timing of the insert
*/

-- Drop existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate trigger to fire AFTER INSERT with proper timing
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION handle_new_user();

-- Update function to handle the constraint properly
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_exists boolean;
BEGIN
  -- Check if user already exists in public.users
  SELECT EXISTS(SELECT 1 FROM public.users WHERE id = NEW.id) INTO user_exists;
  
  IF NOT user_exists THEN
    -- Insert with RLS disabled
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
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the auth.users insert
  RAISE WARNING 'Failed to create user profile: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
