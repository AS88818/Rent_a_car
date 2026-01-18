/*
  # Sync Branch ID to JWT Metadata

  1. Changes
    - Update sync_user_role function to also sync branch_id to auth.users metadata
    - This ensures the JWT token contains both role and branch_id for RLS policies
    - Trigger the sync for all existing users to populate their metadata

  2. Security
    - Function runs with SECURITY DEFINER to allow updating auth.users
    - Only syncs data from the users table, no external input
*/

-- Update the function to sync both role and branch_id
CREATE OR REPLACE FUNCTION sync_user_role()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'role', NEW.role,
      'branch_id', NEW.branch_id::text
    )
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the trigger to also fire on branch_id changes
DROP TRIGGER IF EXISTS on_user_role_changed ON users;
CREATE TRIGGER on_user_role_changed
  AFTER INSERT OR UPDATE OF role, branch_id ON users
  FOR EACH ROW EXECUTE FUNCTION sync_user_role();

-- Sync metadata for all existing users
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
  jsonb_build_object(
    'role', u.role,
    'branch_id', u.branch_id::text
  )
FROM users u
WHERE auth.users.id = u.id;