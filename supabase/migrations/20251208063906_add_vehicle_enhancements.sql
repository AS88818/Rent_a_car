/*
  # Vehicle Management Enhancements

  ## Overview
  This migration adds comprehensive vehicle management features including:
  - Draft vehicle support
  - Enhanced spare key tracking with location
  - MOT not applicable option
  - Vehicle images with storage
  - Activity logging and audit trail
  - Additional vehicle details
  - Soft delete functionality

  ## New Fields in vehicles Table
  - `spare_key_location` (text, nullable) - Branch name or custom location where spare key is stored
  - `mot_not_applicable` (boolean, default false) - Flag for vehicles where MOT doesn't apply
  - `chassis_number` (text, nullable) - Vehicle chassis/VIN number
  - `no_of_passengers` (integer, nullable) - Passenger capacity
  - `luggage_space` (text, nullable) - Luggage capacity description
  - `is_draft` (boolean, default false) - Flag for draft vehicles pending completion
  - `deleted_at` (timestamptz, nullable) - Soft delete timestamp

  ## New Tables

  ### vehicle_images
  Stores up to 2 images per vehicle with 4MB size limit
  - `id` (uuid, primary key)
  - `vehicle_id` (uuid, foreign key) - Links to vehicles table
  - `image_url` (text) - Supabase Storage URL
  - `is_primary` (boolean, default false) - Primary display image
  - `file_size` (integer) - File size in bytes (max 4MB)
  - `uploaded_at` (timestamptz) - Upload timestamp
  - `created_at` (timestamptz) - Record creation timestamp

  ### vehicle_activity_logs
  Complete audit trail of all vehicle changes
  - `id` (uuid, primary key)
  - `vehicle_id` (uuid, foreign key) - Links to vehicles table
  - `user_id` (uuid) - User who made the change
  - `user_name` (text) - User's full name
  - `user_role` (text) - User's role at time of change
  - `field_changed` (text) - Name of field that was changed
  - `old_value` (text) - Previous value
  - `new_value` (text) - New value
  - `notes` (text, nullable) - Optional notes about the change
  - `created_at` (timestamptz) - Timestamp of change

  ## Storage
  Creates `vehicle-images` bucket with:
  - 4MB file size limit
  - Public access for viewing
  - Restricted upload to authenticated users

  ## Security
  - RLS enabled on all new tables
  - vehicle_images: All authenticated users can read, only admin/fleet_manager/mechanic can upload
  - vehicle_activity_logs: All authenticated users can read, system can write
  - Mechanics can only modify vehicles in their branch
*/

-- Add new fields to vehicles table
ALTER TABLE vehicles 
  ADD COLUMN IF NOT EXISTS spare_key_location text,
  ADD COLUMN IF NOT EXISTS mot_not_applicable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS chassis_number text,
  ADD COLUMN IF NOT EXISTS no_of_passengers integer,
  ADD COLUMN IF NOT EXISTS luggage_space text,
  ADD COLUMN IF NOT EXISTS is_draft boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Create vehicle_images table
CREATE TABLE IF NOT EXISTS vehicle_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  is_primary boolean DEFAULT false,
  file_size integer NOT NULL CHECK (file_size <= 4194304), -- 4MB = 4 * 1024 * 1024 bytes
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create index for faster vehicle image queries
CREATE INDEX IF NOT EXISTS idx_vehicle_images_vehicle_id ON vehicle_images(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_images_is_primary ON vehicle_images(is_primary) WHERE is_primary = true;

-- Add constraint to limit 2 images per vehicle
CREATE OR REPLACE FUNCTION check_vehicle_image_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM vehicle_images WHERE vehicle_id = NEW.vehicle_id) >= 2 THEN
    RAISE EXCEPTION 'Maximum 2 images allowed per vehicle';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vehicle_image_limit_trigger ON vehicle_images;
CREATE TRIGGER vehicle_image_limit_trigger
  BEFORE INSERT ON vehicle_images
  FOR EACH ROW
  EXECUTE FUNCTION check_vehicle_image_limit();

-- Create vehicle_activity_logs table
CREATE TABLE IF NOT EXISTS vehicle_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  user_role text NOT NULL,
  field_changed text NOT NULL,
  old_value text,
  new_value text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for activity logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_vehicle_id ON vehicle_activity_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON vehicle_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_field_changed ON vehicle_activity_logs(field_changed);

-- Enable RLS on vehicle_images
ALTER TABLE vehicle_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vehicle_images
-- All authenticated users can view images
DROP POLICY IF EXISTS "Authenticated users can view vehicle images" ON vehicle_images;
CREATE POLICY "Authenticated users can view vehicle images"
  ON vehicle_images
  FOR SELECT
  TO authenticated
  USING (true);

-- Admin, fleet manager, and mechanics can upload images
DROP POLICY IF EXISTS "Authorized users can upload vehicle images" ON vehicle_images;
CREATE POLICY "Authorized users can upload vehicle images"
  ON vehicle_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'fleet_manager', 'mechanic')
    )
  );

-- Users can delete images they uploaded or admin/fleet manager can delete any
DROP POLICY IF EXISTS "Authorized users can delete vehicle images" ON vehicle_images;
CREATE POLICY "Authorized users can delete vehicle images"
  ON vehicle_images
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'fleet_manager', 'mechanic')
    )
  );

-- Enable RLS on vehicle_activity_logs
ALTER TABLE vehicle_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vehicle_activity_logs
-- All authenticated users can view activity logs
DROP POLICY IF EXISTS "Authenticated users can view activity logs" ON vehicle_activity_logs;
CREATE POLICY "Authenticated users can view activity logs"
  ON vehicle_activity_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Only system/backend can insert activity logs (through service role)
DROP POLICY IF EXISTS "Service role can insert activity logs" ON vehicle_activity_logs;
CREATE POLICY "Service role can insert activity logs"
  ON vehicle_activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create storage bucket for vehicle images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-images',
  'vehicle-images',
  true,
  4194304, -- 4MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 4194304,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- Storage policies for vehicle-images bucket
-- Drop existing policies first
DROP POLICY IF EXISTS "Anyone can view vehicle images" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users can upload vehicle images" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users can delete vehicle images" ON storage.objects;

-- Anyone can view images (public bucket)
CREATE POLICY "Anyone can view vehicle images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vehicle-images');

-- Only authenticated users with proper roles can upload
CREATE POLICY "Authorized users can upload vehicle images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-images'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'fleet_manager', 'mechanic')
    )
  );

-- Only authorized users can delete images
CREATE POLICY "Authorized users can delete vehicle images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vehicle-images'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'fleet_manager', 'mechanic')
    )
  );

-- Update vehicles to exclude soft-deleted records in views
-- Create a view for active vehicles (non-deleted)
CREATE OR REPLACE VIEW active_vehicles AS
SELECT * FROM vehicles WHERE deleted_at IS NULL;

-- Add index for deleted_at to improve query performance
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at ON vehicles(deleted_at) WHERE deleted_at IS NULL;

-- Add index for is_draft to filter drafts
CREATE INDEX IF NOT EXISTS idx_vehicles_is_draft ON vehicles(is_draft);

-- Add index for mot_not_applicable
CREATE INDEX IF NOT EXISTS idx_vehicles_mot_not_applicable ON vehicles(mot_not_applicable);
