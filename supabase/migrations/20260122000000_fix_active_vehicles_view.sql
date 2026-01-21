/*
  # Fix Security Issues

  This migration addresses multiple security warnings:

  ## 1. active_vehicles View (SECURITY DEFINER)
  - Ensures all authenticated users can SELECT from vehicles table
  - Recreates view without SECURITY DEFINER

  ## 2. Vehicles INSERT Policy
  - Restricts vehicle creation to admin and manager roles only

  ## 3. Functions with Mutable Search Path
  - Dynamically finds and fixes ALL functions in public schema with mutable search_path
  - Uses pg_proc catalog to get correct function signatures
*/

-- ============================================================================
-- Step 1: Clean up any restrictive SELECT policies on vehicles
-- ============================================================================

DROP POLICY IF EXISTS "Admin can view all vehicles" ON vehicles;
DROP POLICY IF EXISTS "Manager and staff can view vehicles in their branch" ON vehicles;

-- ============================================================================
-- Step 2: Ensure permissive SELECT policy exists for all authenticated users
-- ============================================================================

-- Drop existing permissive policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Users can view vehicles in their branch" ON vehicles;
DROP POLICY IF EXISTS "All authenticated users can view vehicles" ON vehicles;

-- Create simple permissive policy - all authenticated users can view all vehicles
CREATE POLICY "All authenticated users can view vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- Step 3: Recreate active_vehicles view without SECURITY DEFINER
-- ============================================================================

-- Drop the existing view (CASCADE to drop dependent objects)
DROP VIEW IF EXISTS public.active_vehicles CASCADE;

-- Recreate view without SECURITY DEFINER (defaults to SECURITY INVOKER)
-- This view will now respect the RLS policy above
CREATE VIEW public.active_vehicles AS
SELECT * FROM public.vehicles WHERE deleted_at IS NULL;

-- Grant access to authenticated users
GRANT SELECT ON public.active_vehicles TO authenticated;

-- ============================================================================
-- Step 4: Restrict vehicle INSERT to admin and manager only
-- ============================================================================

-- Drop permissive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admin can insert vehicles" ON vehicles;
DROP POLICY IF EXISTS "Manager can insert vehicles in their branch" ON vehicles;

-- Create restricted INSERT policy - only admin and manager can add vehicles
CREATE POLICY "Admin and manager can insert vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('admin', 'manager')
  );

-- ============================================================================
-- Step 5: Fix ALL functions with mutable search_path
-- ============================================================================

-- This dynamically finds all functions in public schema that don't have
-- an immutable search_path and fixes them with the correct signature
DO $$
DECLARE
  func_record RECORD;
  alter_stmt TEXT;
BEGIN
  -- Find all functions in public schema without a fixed search_path
  FOR func_record IN
    SELECT
      p.proname AS func_name,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'  -- Only regular functions
      AND NOT EXISTS (
        -- Check if search_path is already set
        SELECT 1 FROM pg_options_to_table(p.proconfig)
        WHERE option_name = 'search_path'
      )
  LOOP
    -- Build ALTER statement with correct signature
    alter_stmt := format(
      'ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp',
      func_record.func_name,
      func_record.args
    );

    BEGIN
      EXECUTE alter_stmt;
      RAISE NOTICE 'Fixed search_path for: %(%)', func_record.func_name, func_record.args;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not fix %(%): %', func_record.func_name, func_record.args, SQLERRM;
    END;
  END LOOP;
END $$;
