/*
  # Make branch_id nullable in bookings table

  1. Changes
    - Alter bookings table to allow NULL values for branch_id
    - This allows admin users (who don't belong to a specific branch) to create bookings
  
  2. Notes
    - Admin users can create bookings across all branches
    - Branch-specific users will still have their branch_id set
*/

-- Make branch_id nullable in bookings table
ALTER TABLE bookings ALTER COLUMN branch_id DROP NOT NULL;
