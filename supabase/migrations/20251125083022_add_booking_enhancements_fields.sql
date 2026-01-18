/*
  # Add Booking Enhancement Fields

  1. Changes
    - Add `invoice_number` field to bookings table for linking to invoices
    - Add `current_location` field to vehicles table for location tracking
    - Update booking status enum to include 'Draft' and 'Deposit Not Paid'
    - Ensure booking_type field exists for hire type tracking

  2. New Fields
    - bookings.invoice_number: Optional text field for invoice reference
    - vehicles.current_location: Text field for current vehicle location
    - bookings.status: Expanded to include 'Draft' and 'Deposit Not Paid'

  3. Security
    - All changes maintain existing RLS policies
    - No new security risks introduced
*/

-- Add invoice_number to bookings if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'invoice_number'
  ) THEN
    ALTER TABLE bookings ADD COLUMN invoice_number text;
  END IF;
END $$;

-- Add current_location to vehicles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'current_location'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN current_location text;
  END IF;
END $$;

-- Update booking status constraint to include Draft and Deposit Not Paid
DO $$
BEGIN
  -- Drop existing constraint
  ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
  
  -- Add new constraint with expanded values
  ALTER TABLE bookings ADD CONSTRAINT bookings_status_check 
    CHECK (status IN ('Draft', 'Deposit Not Paid', 'Active', 'Completed', 'Cancelled'));
END $$;

-- Ensure booking_type column exists (it should from previous migrations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'booking_type'
  ) THEN
    ALTER TABLE bookings ADD COLUMN booking_type text CHECK (booking_type IN ('self_drive', 'chauffeur', 'transfer'));
  END IF;
END $$;

-- Ensure chauffeur_name and chauffeur_id exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'chauffeur_name'
  ) THEN
    ALTER TABLE bookings ADD COLUMN chauffeur_name text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'chauffeur_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN chauffeur_id text;
  END IF;
END $$;

-- Create index for invoice lookups
CREATE INDEX IF NOT EXISTS idx_bookings_invoice_number ON bookings(invoice_number);

-- Create function to auto-update vehicle current_location when booking completes
CREATE OR REPLACE FUNCTION update_vehicle_location_on_booking_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- When booking status changes to Completed, update vehicle current_location to end_location
  IF NEW.status = 'Completed' AND OLD.status != 'Completed' THEN
    UPDATE vehicles
    SET current_location = NEW.end_location
    WHERE id = NEW.vehicle_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-updating vehicle location
DROP TRIGGER IF EXISTS trigger_update_vehicle_location ON bookings;

CREATE TRIGGER trigger_update_vehicle_location
AFTER UPDATE ON bookings
FOR EACH ROW
WHEN (NEW.status = 'Completed' AND OLD.status IS DISTINCT FROM 'Completed')
EXECUTE FUNCTION update_vehicle_location_on_booking_complete();
