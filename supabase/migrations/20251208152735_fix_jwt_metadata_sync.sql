/*
  # Fix JWT Metadata Sync for RLS Policies
  
  ## Overview
  Fixes the issue where role and branch_id are not available in auth.jwt()
  which causes RLS policies to fail.
  
  ## Problem
  - RLS policies check auth.jwt() ->> 'role' and auth.jwt() ->> 'branch_id'
  - These values need to be in auth.users.raw_app_meta_data to appear in JWT
  - Currently only public.users table has this data
  
  ## Solution
  1. Create function to sync public.users data to auth.users app_metadata
  2. Create trigger to run on INSERT/UPDATE of public.users
  3. Sync all existing users immediately
  
  ## Security
  - Function runs with SECURITY DEFINER to update auth.users
  - Only syncs role and branch_id fields
  - Preserves existing app_metadata (provider, providers, etc.)
*/

-- Create function to sync user metadata to JWT
CREATE OR REPLACE FUNCTION public.sync_user_to_jwt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update auth.users app_metadata with role and branch_id from public.users
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) 
    || jsonb_build_object(
      'role', NEW.role,
      'branch_id', NEW.branch_id
    )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Create trigger on public.users to sync metadata
DROP TRIGGER IF EXISTS sync_user_to_jwt_trigger ON public.users;
CREATE TRIGGER sync_user_to_jwt_trigger
  AFTER INSERT OR UPDATE OF role, branch_id
  ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_to_jwt();

-- Sync all existing users immediately
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT id, role, branch_id FROM public.users
  LOOP
    UPDATE auth.users
    SET raw_app_meta_data = 
      COALESCE(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'role', user_record.role,
        'branch_id', user_record.branch_id
      )
    WHERE id = user_record.id;
  END LOOP;
END $$;
