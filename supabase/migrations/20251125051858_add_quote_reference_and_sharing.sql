/*
  # Add Quote Reference and Sharing Features

  1. Changes
    - Add `quote_reference` column to quotes table
    - Add function to auto-generate quote references
    - Add trigger to generate reference on insert
    - Add indexes for efficient lookup

  2. Quote Reference Format
    - QT-YYYYMMDD-XXX (e.g., QT-20250125-001)
    - Daily counter resets each day
    - Unique per day
*/

-- Add quote_reference column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'quote_reference'
  ) THEN
    ALTER TABLE quotes ADD COLUMN quote_reference text UNIQUE;
  END IF;
END $$;

-- Create function to generate quote reference
CREATE OR REPLACE FUNCTION generate_quote_reference()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  today_date text;
  counter integer;
  new_reference text;
BEGIN
  today_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  SELECT COUNT(*) + 1 INTO counter
  FROM quotes
  WHERE quote_reference LIKE 'QT-' || today_date || '-%';

  new_reference := 'QT-' || today_date || '-' || LPAD(counter::text, 3, '0');

  RETURN new_reference;
END;
$$;

-- Create trigger function to auto-generate reference on insert
CREATE OR REPLACE FUNCTION set_quote_reference_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.quote_reference IS NULL THEN
    NEW.quote_reference := generate_quote_reference();
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS set_quote_reference ON quotes;

CREATE TRIGGER set_quote_reference
BEFORE INSERT ON quotes
FOR EACH ROW
EXECUTE FUNCTION set_quote_reference_trigger();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_quotes_reference ON quotes(quote_reference);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at DESC);

-- Update existing quotes to have references (if any exist without them)
DO $$
DECLARE
  quote_record RECORD;
  new_ref text;
  day_counter integer := 0;
  current_day date := NULL;
BEGIN
  FOR quote_record IN
    SELECT id, created_at
    FROM quotes
    WHERE quote_reference IS NULL
    ORDER BY created_at
  LOOP
    IF current_day != DATE(quote_record.created_at) THEN
      current_day := DATE(quote_record.created_at);
      day_counter := 0;
    END IF;

    day_counter := day_counter + 1;
    new_ref := 'QT-' || TO_CHAR(quote_record.created_at, 'YYYYMMDD') || '-' || LPAD(day_counter::text, 3, '0');

    UPDATE quotes
    SET quote_reference = new_ref
    WHERE id = quote_record.id;
  END LOOP;
END $$;
