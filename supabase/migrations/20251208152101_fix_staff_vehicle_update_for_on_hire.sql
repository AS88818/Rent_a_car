/*
  # Fix Staff Vehicle Update Policy for On-Hire Vehicles
  
  ## Overview
  Updates the staff vehicle update policy to allow updating on-hire vehicles.
  
  ## Issue
  Staff couldn't update vehicles that are on hire because branch_id is NULL when on hire.
  
  ## Solution
  - Allow staff to update vehicles in their branch OR vehicles that are on hire
  - This mirrors the manager policy logic
  
  ## Security
  - Staff can update vehicles assigned to their branch
  - Staff can update vehicles currently on hire (regardless of branch)
  - Only maintenance-related fields should be updated
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Staff can update vehicle health in their branch" ON vehicles;

-- Recreate with support for on-hire vehicles
CREATE POLICY "Staff can update vehicle health in their branch"
  ON vehicles
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'staff'
    AND (
      branch_id = (auth.jwt() ->> 'branch_id')::uuid
      OR on_hire = true
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'staff'
    AND (
      branch_id = (auth.jwt() ->> 'branch_id')::uuid
      OR on_hire = true
    )
  );
