/*
  # Update User Roles to Include Mechanic and Driver

  1. Changes
    - Drop existing role check constraint on users table
    - Migrate existing 'staff' users to 'mechanic' role
    - Add new check constraint supporting: admin, manager, mechanic, driver
    - Update default role to 'mechanic' for new users

  2. Role Definitions
    - admin: Full app control across all branches
    - manager: Own branch control
    - mechanic: Maintenance and repair staff
    - driver: Vehicle operators and chauffeurs

  3. Notes
    - Existing 'staff' users will be converted to 'mechanic'
    - This aligns with the app's operational structure where mechanics and drivers are distinct roles
*/

-- First, drop the existing role check constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Update existing 'staff' users to 'mechanic'
UPDATE users 
SET role = 'mechanic' 
WHERE role = 'staff';

-- Add new check constraint with updated roles
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'manager', 'mechanic', 'driver'));

-- Update default role from 'staff' to 'mechanic' for new users
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'mechanic';