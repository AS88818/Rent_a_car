/*
  # Fix snag_resolutions RLS + create vehicle_documents table

  1. snag_resolutions
     - Drop INSERT policy that joined users table (fragile, causes RLS failures)
     - Recreate INSERT policy using app_metadata (same pattern as all other tables)
     - Drop SELECT policy that joined users table, recreate with app_metadata

  2. vehicle_documents
     - Create table (was never migrated)
     - Enable RLS
     - Add policies for authenticated users
     - Add storage object policies for the 'documents' bucket
*/

-- =============================================
-- 1. FIX snag_resolutions RLS POLICIES
-- =============================================

DROP POLICY IF EXISTS "Staff can create resolutions" ON snag_resolutions;
DROP POLICY IF EXISTS "Users can view resolutions in their branch" ON snag_resolutions;
DROP POLICY IF EXISTS "Authenticated users can view snag resolutions" ON snag_resolutions;
DROP POLICY IF EXISTS "Staff can create snag resolutions" ON snag_resolutions;
DROP POLICY IF EXISTS "Staff can update snag resolutions" ON snag_resolutions;

CREATE POLICY "Authenticated users can view snag resolutions"
  ON snag_resolutions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can create snag resolutions"
  ON snag_resolutions FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager', 'staff', 'mechanic')
  );

CREATE POLICY "Staff can update snag resolutions"
  ON snag_resolutions FOR UPDATE
  TO authenticated
  USING (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager', 'staff', 'mechanic')
  )
  WITH CHECK (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager', 'staff', 'mechanic')
  );

-- =============================================
-- 2. CREATE vehicle_documents TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS vehicle_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('registration', 'insurance_certificate', 'mot_certificate', 'other')),
  document_name text NOT NULL,
  document_url text NOT NULL,
  file_size integer,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_vehicle_documents_vehicle_id ON vehicle_documents(vehicle_id);

ALTER TABLE vehicle_documents ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view documents
DROP POLICY IF EXISTS "Authenticated users can view vehicle documents" ON vehicle_documents;
CREATE POLICY "Authenticated users can view vehicle documents"
  ON vehicle_documents FOR SELECT
  TO authenticated
  USING (true);

-- Admin and manager can insert documents
DROP POLICY IF EXISTS "Admin and manager can upload vehicle documents" ON vehicle_documents;
CREATE POLICY "Admin and manager can upload vehicle documents"
  ON vehicle_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager', 'staff')
  );

-- Admin and manager can update documents
DROP POLICY IF EXISTS "Admin and manager can update vehicle documents" ON vehicle_documents;
CREATE POLICY "Admin and manager can update vehicle documents"
  ON vehicle_documents FOR UPDATE
  TO authenticated
  USING (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  )
  WITH CHECK (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

-- Admin can delete documents
DROP POLICY IF EXISTS "Admin can delete vehicle documents" ON vehicle_documents;
CREATE POLICY "Admin can delete vehicle documents"
  ON vehicle_documents FOR DELETE
  TO authenticated
  USING (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );

-- =============================================
-- 3. STORAGE POLICIES for 'documents' bucket
-- =============================================

-- Allow authenticated users to upload to the documents bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents');

DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;
CREATE POLICY "Authenticated users can view documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "Public can view documents" ON storage.objects;
CREATE POLICY "Public can view documents"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "Admin and manager can delete documents" ON storage.objects;
CREATE POLICY "Admin and manager can delete documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager')
  );
