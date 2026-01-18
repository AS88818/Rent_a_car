/*
  # Add Google Calendar Sync Support

  1. Changes to Tables
    - Add `google_event_id` column to `bookings` table for tracking synced calendar events

  2. Notes
    - This column stores the Google Calendar event ID for each booking
    - Used to update or delete events when bookings change
    - Nullable as not all bookings will have Google Calendar sync enabled
*/

-- Add google_event_id column to bookings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'google_event_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN google_event_id text;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bookings_google_event_id
  ON bookings(google_event_id) WHERE google_event_id IS NOT NULL;
