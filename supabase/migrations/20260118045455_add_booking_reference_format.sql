/*
  # Add Booking Reference System

  1. Changes
    - Add booking_reference column to bookings table
    - Create sequence for booking counter
    - Create function to generate booking references in format: BKXXXX_CATEGORY_LOCATION_DATE_TYPE
    - Create trigger to auto-generate references on insert
    - Backfill existing bookings with references

  2. Reference Format
    - Format: BKXXXX_CATEGORY_LOCATION_DATE_TYPE
    - Examples:
      - BK0001_STD_NRB_25JAN26_SELF
      - BK0002_SUV_NYK_15FEB26_CHAUFFEUR
      - BK0003_COMPACT_MBA_10MAR26_TRANSFER

  3. Components
    - BK: Booking prefix
    - XXXX: Sequential 4-digit counter (padded with zeros)
    - CATEGORY: Abbreviated vehicle category name
    - LOCATION: Abbreviated pickup location (3-letter code)
    - DATE: Start date in format DDMMMYY (e.g., 25JAN26)
    - TYPE: Booking type (SELF, CHAUFFEUR, TRANSFER)
*/

-- Add booking_reference column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'booking_reference'
  ) THEN
    ALTER TABLE bookings ADD COLUMN booking_reference text UNIQUE;
  END IF;
END $$;

-- Create sequence for booking numbers (starting from 1)
CREATE SEQUENCE IF NOT EXISTS booking_counter_seq START WITH 1;

-- Create function to generate booking reference
CREATE OR REPLACE FUNCTION generate_booking_reference(
  p_vehicle_id uuid,
  p_start_location text DEFAULT '',
  p_start_date date DEFAULT CURRENT_DATE,
  p_booking_type text DEFAULT 'self_drive'
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  counter integer;
  category_name text;
  category_abbr text;
  location_abbr text;
  date_str text;
  booking_type_abbr text;
  new_reference text;
BEGIN
  -- Get next value from sequence
  counter := nextval('booking_counter_seq');

  -- Get vehicle category name
  SELECT vc.category_name INTO category_name
  FROM vehicles v
  JOIN vehicle_categories vc ON v.category_id = vc.id
  WHERE v.id = p_vehicle_id;

  -- Default to UNKNOWN if vehicle or category not found
  IF category_name IS NULL THEN
    category_name := 'UNKNOWN';
  END IF;

  -- Abbreviate category using the existing function
  category_abbr := abbreviate_category(category_name);

  -- Abbreviate location using the existing function
  location_abbr := abbreviate_location(p_start_location);
  IF location_abbr = '' THEN
    location_abbr := 'LOC';
  END IF;

  -- Format date as DDMMMYY (e.g., 25JAN26)
  date_str := TO_CHAR(p_start_date, 'DDMON');
  date_str := date_str || SUBSTRING(TO_CHAR(p_start_date, 'YY') FROM 1 FOR 2);
  date_str := UPPER(date_str);

  -- Determine booking type abbreviation
  booking_type_abbr := CASE
    WHEN p_booking_type = 'self_drive' THEN 'SELF'
    WHEN p_booking_type = 'chauffeur' THEN 'CHAUFFEUR'
    WHEN p_booking_type = 'transfer' THEN 'TRANSFER'
    ELSE 'SELF'
  END;

  -- Format: BKXXXX_CATEGORY_LOCATION_DATE_TYPE
  new_reference := 'BK' || LPAD(counter::text, 4, '0') || '_' ||
                   category_abbr || '_' ||
                   location_abbr || '_' ||
                   date_str || '_' ||
                   booking_type_abbr;

  RETURN new_reference;
END;
$$;

-- Create trigger function to set booking reference on insert
CREATE OR REPLACE FUNCTION set_booking_reference_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.booking_reference IS NULL THEN
    NEW.booking_reference := generate_booking_reference(
      NEW.vehicle_id,
      NEW.start_location,
      DATE(NEW.start_datetime),
      COALESCE(NEW.booking_type, 'self_drive')
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on bookings table
DROP TRIGGER IF EXISTS set_booking_reference ON bookings;

CREATE TRIGGER set_booking_reference
BEFORE INSERT ON bookings
FOR EACH ROW
EXECUTE FUNCTION set_booking_reference_trigger();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bookings_reference ON bookings(booking_reference);

-- Backfill existing bookings with references
DO $$
DECLARE
  booking_record RECORD;
  counter integer := 0;
  new_ref text;
BEGIN
  -- Find the highest existing counter value (if any)
  SELECT COALESCE(MAX(
    CASE
      WHEN booking_reference ~ '^BK[0-9]{4}_'
      THEN CAST(SUBSTRING(booking_reference FROM 3 FOR 4) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO counter
  FROM bookings
  WHERE booking_reference IS NOT NULL;

  -- Set sequence to continue from the highest value
  PERFORM setval('booking_counter_seq', counter);

  -- Update bookings that don't have references
  FOR booking_record IN
    SELECT id, vehicle_id, start_location, start_datetime, booking_type
    FROM bookings
    WHERE booking_reference IS NULL
    ORDER BY created_at
  LOOP
    new_ref := generate_booking_reference(
      booking_record.vehicle_id,
      booking_record.start_location,
      DATE(booking_record.start_datetime),
      COALESCE(booking_record.booking_type, 'self_drive')
    );

    UPDATE bookings
    SET booking_reference = new_ref
    WHERE id = booking_record.id;
  END LOOP;
END $$;

-- Set search path for security
ALTER FUNCTION public.generate_booking_reference(uuid, text, date, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.set_booking_reference_trigger() SET search_path = public, pg_temp;
