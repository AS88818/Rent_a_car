/*
  # Fix Metadata Sync Function

  1. Updates
    - Update sync_user_role() to sync both role and branch_id to auth.users metadata
    - Use raw_user_meta_data (not raw_app_meta_data) for consistency with signup flow
    - Ensure metadata is properly synced when users are updated

  2. Security
    - Maintains SECURITY DEFINER for proper permissions
*/

-- Update the function to sync role and branch_id changes
CREATE OR REPLACE FUNCTION sync_user_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'role', NEW.role,
      'branch_id', NEW.branch_id,
      'full_name', NEW.full_name
    )
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger with new name
DROP TRIGGER IF EXISTS on_user_role_changed ON users;
DROP TRIGGER IF EXISTS on_user_metadata_changed ON users;

CREATE TRIGGER on_user_metadata_changed
  AFTER INSERT OR UPDATE OF role, branch_id, full_name ON users
  FOR EACH ROW EXECUTE FUNCTION sync_user_metadata();
