-- Fix: Remove broad SELECT policies that allow unauthenticated file listing
-- on the documents and vehicle-images storage buckets.
--
-- Public buckets serve files via CDN URL without RLS — these SELECT policies
-- are only needed for Storage API list()/download() calls, which this app
-- does not use. Removing them eliminates file enumeration risk.

-- 1. documents bucket: drop the 2 broad policies (from 20260404000000)
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can view documents" ON storage.objects;

-- Add a narrower policy scoped to vehicle-documents/ to replace the
-- broad "Authenticated users can view documents" for that subfolder.
-- (The booking-documents/ path is already covered by the existing
-- "Authenticated users can view booking documents" policy from 20260118070000.)
DROP POLICY IF EXISTS "Authenticated users can view vehicle document files" ON storage.objects;
CREATE POLICY "Authenticated users can view vehicle document files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'vehicle-documents'
  );

-- 2. vehicle-images bucket: drop the broad public SELECT policy (from 20251208063906)
-- Public bucket serves images via CDN; no SELECT policy needed for URL access.
DROP POLICY IF EXISTS "Anyone can view vehicle images" ON storage.objects;
