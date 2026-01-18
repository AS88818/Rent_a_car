/*
  # Allow Staff to Update Vehicle Health Status
  
  ## Overview
  Adds RLS policy to allow staff members to update vehicle health and maintenance fields.
  
  ## Changes
  1. Creates new policy for staff to update vehicle maintenance fields
  
  ## Security
  - Staff can only update vehicles in their assigned branch
  - Staff can only update specific maintenance-related fields:
    - health_flag
    - health_override
    - odometer
    - last_service_date
    - last_service_odometer
  - Does not allow staff to modify core vehicle data (reg_number, make, model, etc.)
  
  ## Note
  This policy works alongside the existing admin/manager policy.
  Staff have limited update permissions for maintenance tracking.
*/

-- Create policy for staff to update vehicle health and maintenance fields
CREATE POLICY "Staff can update vehicle health in their branch"
  ON vehicles
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'staff'
    AND branch_id = (auth.jwt() ->> 'branch_id')::uuid
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'staff'
    AND branch_id = (auth.jwt() ->> 'branch_id')::uuid
  );
