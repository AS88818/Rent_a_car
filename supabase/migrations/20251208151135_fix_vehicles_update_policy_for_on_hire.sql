/*
  # Fix Vehicles Update Policy for On Hire Status
  
  ## Problem
  - When managers try to update a vehicle to on_hire status, the UPDATE policy fails
  - The WITH CHECK clause evaluates after the update and sees branch_id as NULL
  - This causes the policy check to fail for managers
  
  ## Solution
  - Update the policy to allow managers to update vehicles they previously had access to
  - Allow updates when on_hire is being set to true
  
  ## Security
  - Admins can still update any vehicle
  - Managers can update vehicles from their branch or when setting to on_hire
  - Staff cannot update vehicles
*/

-- Drop the existing UPDATE policy
DROP POLICY IF EXISTS "Admins and managers can update vehicles" ON vehicles;

-- Create a new UPDATE policy that handles on_hire status correctly
CREATE POLICY "Admins and managers can update vehicles"
  ON vehicles
  FOR UPDATE
  TO authenticated
  USING (
    -- Check permission based on CURRENT state (before update)
    (auth.jwt() ->> 'role') = 'admin'
    OR 
    (
      (auth.jwt() ->> 'role') = 'manager'
      AND (
        branch_id = (auth.jwt() ->> 'branch_id')::uuid
        OR on_hire = true
      )
    )
  )
  WITH CHECK (
    -- Check permission for NEW state (after update)
    (auth.jwt() ->> 'role') = 'admin'
    OR 
    (
      (auth.jwt() ->> 'role') = 'manager'
      AND (
        branch_id = (auth.jwt() ->> 'branch_id')::uuid
        OR on_hire = true
      )
    )
  );
