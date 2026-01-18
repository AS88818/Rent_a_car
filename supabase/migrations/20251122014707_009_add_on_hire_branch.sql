/*
  # Add On Hire Virtual Branch

  1. New Branch
    - Add 'On Hire' as a special branch to handle vehicles currently on hire
    - This allows branch_id to remain a UUID while supporting the 'On Hire' location

  2. Update RLS Policy
    - Update INSERT policy to allow fleet managers to create vehicles in 'On Hire' location
    - Admins can create vehicles anywhere
    - Fleet managers can create vehicles in their branch or in 'On Hire' location
*/

-- Create 'On Hire' branch with a specific UUID
INSERT INTO branches (id, branch_name, location, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'On Hire',
  'Various Locations',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Drop and recreate the INSERT policy to allow 'On Hire' location
DROP POLICY IF EXISTS "Fleet managers and admins can create vehicles" ON vehicles;

CREATE POLICY "Fleet managers and admins can create vehicles"
  ON vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role') = ANY(ARRAY['admin', 'fleet_manager'])
    AND CASE
      WHEN (auth.jwt() ->> 'role') = 'admin' THEN true
      ELSE (
        branch_id = (auth.jwt() ->> 'branch_id')::uuid 
        OR branch_id = '00000000-0000-0000-0000-000000000001'::uuid
      )
    END
  );

-- Update the UPDATE policy as well
DROP POLICY IF EXISTS "Fleet managers and admins can update vehicles" ON vehicles;

CREATE POLICY "Fleet managers and admins can update vehicles"
  ON vehicles
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = ANY(ARRAY['admin', 'fleet_manager'])
    AND CASE
      WHEN (auth.jwt() ->> 'role') = 'admin' THEN true
      ELSE (
        branch_id = (auth.jwt() ->> 'branch_id')::uuid
        OR branch_id = '00000000-0000-0000-0000-000000000001'::uuid
      )
    END
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = ANY(ARRAY['admin', 'fleet_manager'])
    AND CASE
      WHEN (auth.jwt() ->> 'role') = 'admin' THEN true
      ELSE (
        branch_id = (auth.jwt() ->> 'branch_id')::uuid
        OR branch_id = '00000000-0000-0000-0000-000000000001'::uuid
      )
    END
  );