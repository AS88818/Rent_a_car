/*
  # Fix Role Consistency

  1. Updates
    - Update user role from 'staff' to 'manager' for rossiandrea18@gmail.com
    - Update auth.users metadata to match
    - Update RLS policies to use 'manager' instead of 'fleet_manager'
    - Add branch_id to both users' metadata

  2. Security
    - Maintains proper access control with consistent role naming
*/

-- Update the user to manager role and assign to Nairobi Branch
UPDATE users
SET 
  role = 'manager',
  branch_id = '10c45122-9f29-46e7-8b09-a232647c462a'
WHERE email = 'rossiandrea18@gmail.com';

-- Update auth.users metadata to include role and branch_id
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || 
  jsonb_build_object(
    'role', 'manager',
    'branch_id', '10c45122-9f29-46e7-8b09-a232647c462a'
  )
WHERE email = 'rossiandrea18@gmail.com';

-- Also add branch_id to admin user
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || 
  jsonb_build_object(
    'branch_id', '10c45122-9f29-46e7-8b09-a232647c462a'
  )
WHERE email = 'admin@demo.com';

-- Update RLS policies to use 'manager' instead of 'fleet_manager'
DROP POLICY IF EXISTS "Fleet managers and admins can create vehicles" ON vehicles;

CREATE POLICY "Managers and admins can create vehicles"
  ON vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role') = ANY(ARRAY['admin', 'manager'])
    AND CASE
      WHEN (auth.jwt() ->> 'role') = 'admin' THEN true
      ELSE (
        branch_id = (auth.jwt() ->> 'branch_id')::uuid 
        OR branch_id = '00000000-0000-0000-0000-000000000001'::uuid
      )
    END
  );

DROP POLICY IF EXISTS "Fleet managers and admins can update vehicles" ON vehicles;

CREATE POLICY "Managers and admins can update vehicles"
  ON vehicles
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = ANY(ARRAY['admin', 'manager'])
    AND CASE
      WHEN (auth.jwt() ->> 'role') = 'admin' THEN true
      ELSE (
        branch_id = (auth.jwt() ->> 'branch_id')::uuid
        OR branch_id = '00000000-0000-0000-0000-000000000001'::uuid
      )
    END
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = ANY(ARRAY['admin', 'manager'])
    AND CASE
      WHEN (auth.jwt() ->> 'role') = 'admin' THEN true
      ELSE (
        branch_id = (auth.jwt() ->> 'branch_id')::uuid
        OR branch_id = '00000000-0000-0000-0000-000000000001'::uuid
      )
    END
  );
