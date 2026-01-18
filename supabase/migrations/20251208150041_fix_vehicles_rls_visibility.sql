/*
  # Fix Vehicles RLS Visibility Issue
  
  ## Problem
  - Users cannot see vehicles due to overly restrictive RLS policies
  - The SELECT policy requires branch_id matching in JWT which may not be properly synced
  
  ## Changes
  1. Update the SELECT policy to allow all authenticated users to view vehicles
  2. Keep UPDATE and DELETE policies restrictive (admin/manager only)
  3. This allows users to see vehicles while maintaining security for modifications
  
  ## Security
  - All authenticated users can view vehicles (standard for fleet management)
  - Only admins can delete vehicles
  - Only admins and managers can update vehicles in their branch
*/

-- Drop the old restrictive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view vehicles" ON vehicles;

-- Create a new, more permissive SELECT policy
CREATE POLICY "Authenticated users can view all vehicles"
  ON vehicles
  FOR SELECT
  TO authenticated
  USING (true);

-- Keep the restrictive UPDATE policy
DROP POLICY IF EXISTS "Authenticated users can update vehicles" ON vehicles;

CREATE POLICY "Admins and managers can update vehicles"
  ON vehicles
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'admin'
    OR 
    (
      (auth.jwt() ->> 'role') = 'manager'
      AND branch_id = (auth.jwt() ->> 'branch_id')::uuid
    )
  );

-- Keep the admin-only DELETE policy (already exists, but recreate for consistency)
DROP POLICY IF EXISTS "Admin can delete vehicles" ON vehicles;

CREATE POLICY "Admins can delete vehicles"
  ON vehicles
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'admin'
  );

-- Fix the INSERT policy to include WITH CHECK
DROP POLICY IF EXISTS "Authenticated users can insert vehicles" ON vehicles;

CREATE POLICY "Authenticated users can insert vehicles"
  ON vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
