/*
  # Remove Broken Metadata Sync Triggers

  1. Changes
    - Drop all sync_user_metadata triggers from both auth.users and public.users
    - Remove the broken sync_user_metadata function
    - These triggers were causing signup failures

  2. Notes
    - Error: record "new" has no field "branch_id" on auth.users
    - The sync logic was incorrectly trying to access columns that don't exist
    - We only need the handle_new_user trigger for signup
*/

-- Drop triggers on both tables
DROP TRIGGER IF EXISTS sync_user_metadata_trigger ON auth.users;
DROP TRIGGER IF EXISTS on_user_metadata_changed ON public.users;

-- Now drop the function
DROP FUNCTION IF EXISTS public.sync_user_metadata() CASCADE;
