/*
  # Add Booking Enhancements

  1. Changes
    - Add `booking_type` column to bookings table (TEXT, default 'self_drive')
    - Add `chauffeur_id` column to bookings table (UUID, nullable, references users table)
    - Add `chauffeur_name` column to bookings table (TEXT, nullable)

  2. Notes
    - booking_type can be: 'self_drive', 'chauffeur', or 'transfer'
    - chauffeur_id links to the users table for assigned chauffeur
    - chauffeur_name is denormalized for faster reads
    - Existing bookings will default to 'self_drive' type
*/

DO $$
BEGIN
  -- Add booking_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'booking_type'
  ) THEN
    ALTER TABLE bookings ADD COLUMN booking_type TEXT DEFAULT 'self_drive';
    ALTER TABLE bookings ADD CONSTRAINT bookings_booking_type_check 
      CHECK (booking_type IN ('self_drive', 'chauffeur', 'transfer'));
  END IF;

  -- Add chauffeur_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'chauffeur_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN chauffeur_id UUID REFERENCES users(id);
  END IF;

  -- Add chauffeur_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'chauffeur_name'
  ) THEN
    ALTER TABLE bookings ADD COLUMN chauffeur_name TEXT;
  END IF;
END $$;
