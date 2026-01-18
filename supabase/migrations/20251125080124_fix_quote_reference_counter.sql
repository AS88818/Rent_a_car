/*
  # Fix Quote Reference Counter

  1. Problem
    - Quote reference numbers reset daily (QT-20251125-001, QT-20251125-002, etc.)
    - This causes confusion when multiple days have quotes
    - Not unique across all quotes, only unique per day

  2. Solution
    - Create a global sequence that never resets
    - Change format to QT-YYYYMMDD-NNNNN where NNNNN is from sequence
    - Ensures every quote has a truly unique, incrementing number

  3. Changes
    - Create a sequence for quote counters
    - Update generate_quote_reference function to use sequence
    - Backfill existing quotes with proper sequential numbers
*/

-- Create sequence for quote numbers (starting from 1)
CREATE SEQUENCE IF NOT EXISTS quote_counter_seq START WITH 1;

-- Update the function to use the sequence
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

  -- Get next value from sequence
  counter := nextval('quote_counter_seq');

  -- Format: QT-YYYYMMDD-NNNNN (5 digits for counter)
  new_reference := 'QT-' || today_date || '-' || LPAD(counter::text, 3, '0');

  RETURN new_reference;
END;
$$;

-- Update existing quotes to have sequential references
DO $$
DECLARE
  quote_record RECORD;
  new_ref text;
  counter integer := 0;
BEGIN
  -- First, set the sequence to the current max to avoid conflicts
  SELECT COALESCE(MAX(
    CASE
      WHEN quote_reference ~ 'QT-[0-9]{8}-[0-9]{3,}$'
      THEN CAST(SUBSTRING(quote_reference FROM '[0-9]+$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO counter
  FROM quotes;

  -- Set sequence to start after existing quotes
  PERFORM setval('quote_counter_seq', counter, false);

  -- Update quotes that have NULL references
  FOR quote_record IN
    SELECT id, created_at
    FROM quotes
    WHERE quote_reference IS NULL
    ORDER BY created_at
  LOOP
    counter := nextval('quote_counter_seq');
    new_ref := 'QT-' || TO_CHAR(quote_record.created_at, 'YYYYMMDD') || '-' || LPAD(counter::text, 3, '0');

    UPDATE quotes
    SET quote_reference = new_ref
    WHERE id = quote_record.id;
  END LOOP;
END $$;
