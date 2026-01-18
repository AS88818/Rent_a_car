/*
  # Simplify Booking Documents RLS
  
  Simplify the RLS policies on booking_documents to match the simple pattern used for vehicle_images.
  Just check if user is authenticated - no complex branch checking needed during upload.
*/

-- Drop existing complex policies
DROP POLICY IF EXISTS "Users can insert documents for bookings in their branch" ON booking_documents;
DROP POLICY IF EXISTS "Users can view documents for bookings in their branch" ON booking_documents;
DROP POLICY IF EXISTS "Users can update documents they uploaded or admin" ON booking_documents;
DROP POLICY IF EXISTS "Users can delete documents they uploaded or admin" ON booking_documents;

-- Create simple policies like vehicle_images
CREATE POLICY "Authenticated users can insert booking documents"
  ON booking_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view booking documents"
  ON booking_documents
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update their own documents"
  ON booking_documents
  FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (uploaded_by = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Authenticated users can delete their own documents"
  ON booking_documents
  FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));
