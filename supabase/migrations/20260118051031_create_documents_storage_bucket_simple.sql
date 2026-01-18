/*
  # Create Documents Storage Bucket

  1. Storage Setup
    - Create 'documents' bucket for storing booking documents
    - Set bucket to public for easy access (security handled by application layer and booking_documents table RLS)
*/

-- Create the documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;
