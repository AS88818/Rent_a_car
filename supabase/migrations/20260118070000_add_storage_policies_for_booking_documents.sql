/*
  # Add Storage Policies for Booking Documents

  ## Problem
  - The 'documents' storage bucket exists but has NO RLS policies
  - Users cannot upload files because INSERT operations are blocked
  - Error: "new row violates row-level security policy" during storage upload

  ## Solution
  Add RLS policies to storage.objects table for the documents bucket:
  1. INSERT policy - Allow authenticated users to upload to booking-documents/
  2. SELECT policy - Allow authenticated users to view booking documents
  3. DELETE policy - Allow authenticated users to delete booking documents

  ## Security
  - Only authenticated users can upload/view/delete
  - Files are scoped to booking-documents/ folder
  - Maintains security while enabling functionality
*/

-- ============================================================================
-- Storage Policies for Booking Documents
-- ============================================================================

-- Policy 1: Allow authenticated users to INSERT (upload) files to booking-documents folder
CREATE POLICY "Authenticated users can upload booking documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'booking-documents'
  );

-- Policy 2: Allow authenticated users to SELECT (view/download) booking documents
CREATE POLICY "Authenticated users can view booking documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'booking-documents'
  );

-- Policy 3: Allow authenticated users to DELETE booking documents
CREATE POLICY "Authenticated users can delete booking documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'booking-documents'
  );

-- Policy 4: Allow authenticated users to UPDATE booking documents (for overwrites)
CREATE POLICY "Authenticated users can update booking documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'booking-documents'
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'booking-documents'
  );
