/*
  # Sync branch_id to JWT

  1. Updates
    - Add trigger to sync branch_id changes to auth.users.raw_app_meta_data
    - This ensures branch_id is available in JWT for RLS policies
  
  2. Notes
    - The existing sync_user_role function only syncs role
    - We need to sync both role and branch_id together
*/

-- Update the sync function to handle both role and branch_id
CREATE OR REPLACE FUNCTION sync_user_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) 
    || jsonb_build_object('role', NEW.role)
    || jsonb_build_object('branch_id', NEW.branch_id)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger
DROP TRIGGER IF EXISTS on_user_role_changed ON users;

-- Create new trigger that handles both role and branch_id
CREATE TRIGGER on_user_metadata_changed
  AFTER INSERT OR UPDATE OF role, branch_id ON users
  FOR EACH ROW EXECUTE FUNCTION sync_user_metadata();

-- Manually sync existing users to ensure their metadata is correct
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id, role, branch_id FROM public.users
  LOOP
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) 
      || jsonb_build_object('role', user_record.role)
      || jsonb_build_object('branch_id', user_record.branch_id)
    WHERE id = user_record.id;
  END LOOP;
END $$;