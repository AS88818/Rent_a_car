/*
  # Add Quote Draft Support and Email Storage

  1. Changes to quotes table
    - Add `client_email` column for storing client email
    - Add `status` column (draft, completed)
    - Add `quote_inputs` jsonb column to store all input state for drafts
    - Update RLS policies to handle draft quotes

  2. Benefits
    - Save unfinished quotes as drafts
    - Resume work on draft quotes later
    - Store client email for sending quotes via Resend
    - Track quote completion status
*/

-- Add new columns to quotes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'client_email'
  ) THEN
    ALTER TABLE quotes ADD COLUMN client_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'status'
  ) THEN
    ALTER TABLE quotes ADD COLUMN status text DEFAULT 'completed' CHECK (status IN ('draft', 'completed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'quote_inputs'
  ) THEN
    ALTER TABLE quotes ADD COLUMN quote_inputs jsonb;
  END IF;
END $$;

-- Create index for filtering by status
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_user_status ON quotes(user_id, status);

-- Update existing quotes to have 'completed' status if null
UPDATE quotes SET status = 'completed' WHERE status IS NULL;
