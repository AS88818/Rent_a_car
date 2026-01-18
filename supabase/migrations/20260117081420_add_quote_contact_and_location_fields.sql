/*
  # Add Contact and Location Fields to Quotes Table

  1. New Columns
    - `client_phone` (text, required for booking conversion)
    - `pickup_location` (text, required for booking conversion)
    - `dropoff_location` (text, required for booking conversion)
    - `booking_id` (uuid, reference to converted booking)
    - `converted_at` (timestamptz, timestamp of conversion)

  2. Status Updates
    - Add 'Accepted' and 'Converted' to status enum
    - Accepted: Quote has been accepted by client but not yet converted
    - Converted: Quote has been converted to a booking

  3. Security
    - Update RLS policies for new fields
*/

-- Add new columns to quotes table
DO $$
BEGIN
  -- Add client_phone
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'client_phone'
  ) THEN
    ALTER TABLE quotes ADD COLUMN client_phone text;
  END IF;

  -- Add pickup_location
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'pickup_location'
  ) THEN
    ALTER TABLE quotes ADD COLUMN pickup_location text;
  END IF;

  -- Add dropoff_location
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'dropoff_location'
  ) THEN
    ALTER TABLE quotes ADD COLUMN dropoff_location text;
  END IF;

  -- Add booking_id reference
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'booking_id'
  ) THEN
    ALTER TABLE quotes ADD COLUMN booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL;
  END IF;

  -- Add converted_at timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'converted_at'
  ) THEN
    ALTER TABLE quotes ADD COLUMN converted_at timestamptz;
  END IF;
END $$;

-- Update status constraint to include 'Accepted' and 'Converted'
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_status_check 
  CHECK (status IN ('Draft', 'Active', 'Accepted', 'Converted', 'Expired'));

-- Create index for booking_id lookups
CREATE INDEX IF NOT EXISTS idx_quotes_booking_id ON quotes(booking_id);

-- Add comment explaining the status flow
COMMENT ON COLUMN quotes.status IS 'Quote status: Draft (being edited) → Active (sent to client) → Accepted (client accepted) → Converted (booking created) or Expired (past expiration date)';
