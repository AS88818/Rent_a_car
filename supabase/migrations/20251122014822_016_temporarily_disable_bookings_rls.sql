/*
  # Temporarily Disable Bookings RLS

  1. Changes
    - Drop existing RLS policies on bookings table
    - Keep RLS enabled but with permissive policies
    - Allow authenticated users full access to bookings
  
  2. Notes
    - This is a temporary solution to unblock development
    - Proper RLS policies should be implemented later based on actual business requirements
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view bookings in their branch" ON bookings;
DROP POLICY IF EXISTS "Users can create bookings in their branch" ON bookings;
DROP POLICY IF EXISTS "Users can update bookings in their branch" ON bookings;

-- Create permissive policies for authenticated users
CREATE POLICY "Authenticated users can view all bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete bookings"
  ON bookings FOR DELETE
  TO authenticated
  USING (true);