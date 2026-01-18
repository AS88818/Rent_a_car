/*
  # Add Outside Office Hours Charges

  1. Changes to Tables
    - Add `outside_hours_charges` column to `bookings` table
    - Add `outside_hours_charges` column to `quotes` table

  2. Details
    - Stores extra charges for pickups/drop-offs outside office hours (9am-6pm)
    - Default is 0 (no extra charges)
    - Charges are KES 1,000 per instance (pickup and/or drop-off outside hours)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'outside_hours_charges'
  ) THEN
    ALTER TABLE bookings
    ADD COLUMN outside_hours_charges numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'outside_hours_charges'
  ) THEN
    ALTER TABLE quotes
    ADD COLUMN outside_hours_charges numeric DEFAULT 0;
  END IF;
END $$;
