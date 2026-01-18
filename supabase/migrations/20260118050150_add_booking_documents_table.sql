/*
  # Add Booking Documents Table

  1. New Tables
    - `booking_documents`
      - `id` (uuid, primary key)
      - `booking_id` (uuid, foreign key to bookings)
      - `document_type` (text: 'license', 'contract', 'id_document', 'other')
      - `document_name` (text: original filename)
      - `document_url` (text: URL to stored document)
      - `file_size` (integer: size in bytes)
      - `uploaded_by` (uuid, foreign key to users)
      - `uploaded_at` (timestamptz)
      - `notes` (text: optional notes about the document)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `booking_documents` table
    - Add policies for authenticated users to view/manage documents for their branch
    - Admins can view/manage all documents

  3. Indexes
    - Add index on booking_id for faster lookups
    - Add index on document_type for filtering
*/

-- Create booking_documents table
CREATE TABLE IF NOT EXISTS booking_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('license', 'contract', 'id_document', 'insurance', 'other')),
  document_name text NOT NULL,
  document_url text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  uploaded_by uuid REFERENCES users(id),
  uploaded_at timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE booking_documents ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_booking_documents_booking_id ON booking_documents(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_documents_type ON booking_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_booking_documents_uploaded_by ON booking_documents(uploaded_by);

-- Create RLS policies
CREATE POLICY "Users can view documents for bookings in their branch"
  ON booking_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_documents.booking_id
      AND (
        (auth.jwt() ->> 'role') = 'admin'
        OR b.branch_id = (auth.jwt() ->> 'branch_id')::uuid
      )
    )
  );

CREATE POLICY "Users can insert documents for bookings in their branch"
  ON booking_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_documents.booking_id
      AND (
        (auth.jwt() ->> 'role') = 'admin'
        OR b.branch_id = (auth.jwt() ->> 'branch_id')::uuid
      )
    )
  );

CREATE POLICY "Users can update documents they uploaded or admin"
  ON booking_documents FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'admin'
    OR uploaded_by = (auth.jwt() ->> 'sub')::uuid
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'admin'
    OR uploaded_by = (auth.jwt() ->> 'sub')::uuid
  );

CREATE POLICY "Users can delete documents they uploaded or admin"
  ON booking_documents FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'admin'
    OR uploaded_by = (auth.jwt() ->> 'sub')::uuid
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_booking_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_booking_documents_updated_at
  BEFORE UPDATE ON booking_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_documents_updated_at();

-- Set search path for security
ALTER FUNCTION public.update_booking_documents_updated_at() SET search_path = public, pg_temp;
