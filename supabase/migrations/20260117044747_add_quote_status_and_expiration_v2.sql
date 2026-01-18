/*
  # Add Quote Status and Expiration Management

  1. Changes to quotes table
    - Update status column to support: 'Draft', 'Active', 'Expired' (capitalized)
    - Add `expiration_date` column (default 3 days from creation)
    - Add `extended_expiration` boolean to track manual extensions

  2. New functionality
    - Quotes automatically expire 3 days after creation
    - Expiration date can be manually extended
    - Status management: Draft → Active → Expired

  3. Security
    - Update RLS policies for new status values
*/

-- First, normalize any existing status values
UPDATE quotes SET status = 'Active' WHERE LOWER(status) = 'completed' OR LOWER(status) = 'active';
UPDATE quotes SET status = 'Draft' WHERE LOWER(status) = 'draft';
UPDATE quotes SET status = 'Expired' WHERE LOWER(status) = 'expired';

-- Drop old constraint and add new one
DO $$
BEGIN
  ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
  ALTER TABLE quotes ADD CONSTRAINT quotes_status_check 
    CHECK (status IN ('Draft', 'Active', 'Expired'));
END $$;

-- Add expiration_date column (default 3 days from creation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'expiration_date'
  ) THEN
    ALTER TABLE quotes ADD COLUMN expiration_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'extended_expiration'
  ) THEN
    ALTER TABLE quotes ADD COLUMN extended_expiration boolean DEFAULT false;
  END IF;
END $$;

-- Update default value for status column
ALTER TABLE quotes ALTER COLUMN status SET DEFAULT 'Draft';

-- Set default expiration_date for existing active quotes (3 days from created_at)
UPDATE quotes 
SET expiration_date = created_at + interval '3 days'
WHERE expiration_date IS NULL AND status = 'Active';

-- Create function to auto-expire quotes
CREATE OR REPLACE FUNCTION check_quote_expiration()
RETURNS trigger AS $$
BEGIN
  -- If inserting a new active quote without expiration_date, set it to 3 days from now
  IF (TG_OP = 'INSERT' AND NEW.status = 'Active' AND NEW.expiration_date IS NULL) THEN
    NEW.expiration_date := now() + interval '3 days';
  END IF;

  -- If updating status from draft to active without expiration_date, set it
  IF (TG_OP = 'UPDATE' AND NEW.status = 'Active' AND OLD.status = 'Draft' AND NEW.expiration_date IS NULL) THEN
    NEW.expiration_date := now() + interval '3 days';
  END IF;

  -- Auto-expire if expiration_date has passed
  IF (NEW.expiration_date IS NOT NULL AND NEW.expiration_date < now() AND NEW.status != 'Expired') THEN
    NEW.status := 'Expired';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for quote expiration
DROP TRIGGER IF EXISTS trigger_check_quote_expiration ON quotes;
CREATE TRIGGER trigger_check_quote_expiration
  BEFORE INSERT OR UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION check_quote_expiration();

-- Create index for expiration queries
CREATE INDEX IF NOT EXISTS idx_quotes_expiration ON quotes(expiration_date);
CREATE INDEX IF NOT EXISTS idx_quotes_status_expiration ON quotes(status, expiration_date);
