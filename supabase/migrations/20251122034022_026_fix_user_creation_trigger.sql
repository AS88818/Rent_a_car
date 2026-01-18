/*
  # Fix User Creation Trigger

  1. Updates
    - Fix handle_new_user() function to read from raw_user_meta_data instead of raw_app_meta_data
    - Add branch_id handling to the trigger function
    - Ensure role, full_name, and branch_id are properly extracted during signup

  2. Security
    - Maintains SECURITY DEFINER for proper permissions
*/

-- Drop and recreate the function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
