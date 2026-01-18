/*
  # Create Invoices Table

  1. New Table
    - `invoices` - Stores invoice records created from quotes
      - `id` (uuid, primary key)
      - `invoice_reference` (text, unique) - Format: INV-YYYYMMDD-XXX
      - `quote_id` (uuid, references quotes.id) - Original quote
      - `client_name` (text) - Client name
      - `client_email` (text) - Client email
      - `invoice_date` (date) - Date invoice was created
      - `due_date` (date) - Payment due date
      - `selected_categories` (jsonb) - Array of selected vehicle categories/details
      - `subtotal` (numeric) - Subtotal amount
      - `vat` (numeric) - VAT amount
      - `total_amount` (numeric) - Total amount including VAT
      - `payment_status` (text) - Pending, Paid, Overdue
      - `payment_method` (text) - Cash, Bank Transfer, Card, Mobile Money, Other
      - `payment_date` (date) - Date payment was received
      - `notes` (text) - Additional notes
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `created_by` (uuid, references users.id)

  2. Security
    - Enable RLS on `invoices` table
    - Admin users can do everything
    - Manager users can view and update invoices
    - Regular staff cannot access invoices

  3. Functions
    - Auto-generate invoice reference numbers
    - Auto-update timestamp on changes
*/

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_reference text UNIQUE NOT NULL,
  quote_id uuid REFERENCES quotes(id),
  client_name text NOT NULL,
  client_email text,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  selected_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  vat numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'Pending',
  payment_method text,
  payment_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create index on invoice_reference for fast lookups
CREATE INDEX IF NOT EXISTS idx_invoices_reference ON invoices(invoice_reference);

-- Create index on payment_status for filtering
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(payment_status);

-- Create index on due_date for overdue detection
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- Create index on quote_id for linking
CREATE INDEX IF NOT EXISTS idx_invoices_quote_id ON invoices(quote_id);

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Admin users can do everything
CREATE POLICY "Admin users can manage all invoices"
  ON invoices
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Manager users can view and update invoices
CREATE POLICY "Manager users can view invoices"
  ON invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Manager users can update invoices"
  ON invoices
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- Function to generate invoice reference
CREATE OR REPLACE FUNCTION generate_invoice_reference()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  date_part text;
  sequence_num integer;
  new_reference text;
BEGIN
  date_part := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(invoice_reference FROM '\d+$') AS integer
    )
  ), 0) + 1
  INTO sequence_num
  FROM invoices
  WHERE invoice_reference LIKE 'INV-' || date_part || '-%';

  new_reference := 'INV-' || date_part || '-' || LPAD(sequence_num::text, 3, '0');

  RETURN new_reference;
END;
$$;

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_invoice_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger to auto-update timestamp
DROP TRIGGER IF EXISTS invoices_updated_at ON invoices;

CREATE TRIGGER invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION update_invoice_timestamp();

-- Function to check and update overdue invoices
CREATE OR REPLACE FUNCTION update_overdue_invoices()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE invoices
  SET payment_status = 'Overdue'
  WHERE payment_status = 'Pending'
    AND due_date < CURRENT_DATE;
END;
$$;