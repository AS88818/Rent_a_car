/*
  Security remediation, staged-compatible:
  - Add storage_path columns while keeping document_url fallback.
  - Backfill storage_path from existing public URLs.
  - Make documents bucket private.
  - Replace broad document policies with current role names.
*/

ALTER TABLE booking_documents
  ADD COLUMN IF NOT EXISTS storage_path text;

ALTER TABLE vehicle_documents
  ADD COLUMN IF NOT EXISTS storage_path text;

UPDATE booking_documents
SET storage_path = substring(document_url from '(booking-documents/.*)$')
WHERE storage_path IS NULL
  AND document_url LIKE '%booking-documents/%';

UPDATE vehicle_documents
SET storage_path = substring(document_url from '(vehicle-documents/.*)$')
WHERE storage_path IS NULL
  AND document_url LIKE '%vehicle-documents/%';

UPDATE storage.buckets
SET public = false
WHERE id = 'documents';

-- Remove legacy/broad booking document policies.
DROP POLICY IF EXISTS "Authenticated users can insert booking documents" ON booking_documents;
DROP POLICY IF EXISTS "Authenticated users can view booking documents" ON booking_documents;
DROP POLICY IF EXISTS "Authenticated users can update their own documents" ON booking_documents;
DROP POLICY IF EXISTS "Authenticated users can delete their own documents" ON booking_documents;
DROP POLICY IF EXISTS "Users can insert documents for their branch bookings" ON booking_documents;
DROP POLICY IF EXISTS "Users can view documents for their branch bookings" ON booking_documents;
DROP POLICY IF EXISTS "Users can insert documents for bookings in their branch" ON booking_documents;
DROP POLICY IF EXISTS "Users can view documents for bookings in their branch" ON booking_documents;
DROP POLICY IF EXISTS "Users can update documents they uploaded or admin" ON booking_documents;
DROP POLICY IF EXISTS "Users can delete documents they uploaded or admin" ON booking_documents;
DROP POLICY IF EXISTS "Current roles can insert booking documents" ON booking_documents;
DROP POLICY IF EXISTS "Current roles can view booking documents" ON booking_documents;
DROP POLICY IF EXISTS "Current roles can update booking documents" ON booking_documents;
DROP POLICY IF EXISTS "Current roles can delete booking documents" ON booking_documents;

CREATE POLICY "Current roles can insert booking documents"
  ON booking_documents FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = (select auth.uid())
    AND (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user', 'member')
  );

CREATE POLICY "Current roles can view booking documents"
  ON booking_documents FOR SELECT TO authenticated
  USING (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user', 'member')
    OR EXISTS (
      SELECT 1
      FROM bookings b
      WHERE b.id = booking_documents.booking_id
        AND b.chauffeur_id = (select auth.uid())
    )
    OR uploaded_by = (select auth.uid())
  );

CREATE POLICY "Current roles can update booking documents"
  ON booking_documents FOR UPDATE TO authenticated
  USING (
    uploaded_by = (select auth.uid())
    OR (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user')
  )
  WITH CHECK (
    uploaded_by = (select auth.uid())
    OR (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user')
  );

CREATE POLICY "Current roles can delete booking documents"
  ON booking_documents FOR DELETE TO authenticated
  USING (
    uploaded_by = (select auth.uid())
    OR (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user')
  );

-- Remove legacy/broad vehicle document policies.
DROP POLICY IF EXISTS "Authenticated users can view vehicle documents" ON vehicle_documents;
DROP POLICY IF EXISTS "Admin and manager can upload vehicle documents" ON vehicle_documents;
DROP POLICY IF EXISTS "Admin and manager can update vehicle documents" ON vehicle_documents;
DROP POLICY IF EXISTS "Admin can delete vehicle documents" ON vehicle_documents;
DROP POLICY IF EXISTS "Current roles can view vehicle documents" ON vehicle_documents;
DROP POLICY IF EXISTS "Current roles can insert vehicle documents" ON vehicle_documents;
DROP POLICY IF EXISTS "Current roles can update vehicle documents" ON vehicle_documents;
DROP POLICY IF EXISTS "Current roles can delete vehicle documents" ON vehicle_documents;

CREATE POLICY "Current roles can view vehicle documents"
  ON vehicle_documents FOR SELECT TO authenticated
  USING (
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user', 'member')
    OR uploaded_by = (select auth.uid())
  );

CREATE POLICY "Current roles can insert vehicle documents"
  ON vehicle_documents FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = (select auth.uid())
    AND (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user', 'member')
  );

CREATE POLICY "Current roles can update vehicle documents"
  ON vehicle_documents FOR UPDATE TO authenticated
  USING (
    uploaded_by = (select auth.uid())
    OR (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user')
  )
  WITH CHECK (
    uploaded_by = (select auth.uid())
    OR (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user')
  );

CREATE POLICY "Current roles can delete vehicle documents"
  ON vehicle_documents FOR DELETE TO authenticated
  USING (
    uploaded_by = (select auth.uid())
    OR (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user')
  );

-- Storage policies remain upload/delete capable for authenticated app users,
-- but direct public reads are removed. Downloads go through signed-document-url.
DROP POLICY IF EXISTS "Public can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view booking documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view vehicle document files" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload booking documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload document files" ON storage.objects;
CREATE POLICY "Authenticated users can upload document files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IN ('booking-documents', 'vehicle-documents')
    AND (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user', 'member')
  );

DROP POLICY IF EXISTS "Authenticated users can update booking documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Current roles can update document files" ON storage.objects;
CREATE POLICY "Current roles can update document files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IN ('booking-documents', 'vehicle-documents')
    AND (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user', 'member')
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IN ('booking-documents', 'vehicle-documents')
    AND (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user', 'member')
  );

DROP POLICY IF EXISTS "Admin and manager can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete booking documents" ON storage.objects;
DROP POLICY IF EXISTS "Current roles can delete document files" ON storage.objects;
CREATE POLICY "Current roles can delete document files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IN ('booking-documents', 'vehicle-documents')
    AND (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'user', 'member')
  );
