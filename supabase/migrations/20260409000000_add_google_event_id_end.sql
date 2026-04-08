DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'google_event_id_end'
  ) THEN
    ALTER TABLE bookings ADD COLUMN google_event_id_end text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_google_event_id_end
  ON bookings(google_event_id_end) WHERE google_event_id_end IS NOT NULL;
