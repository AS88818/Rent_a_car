/*
  # Add 25% Deposit Payment System

  1. Changes to Bookings Table
    - Add `total_amount` (numeric) - Full booking cost
    - Add `deposit_amount` (numeric) - Required deposit (25% of total)
    - Add `deposit_paid` (boolean) - Whether deposit has been paid
    - Add `deposit_payment_date` (date) - When deposit was paid
    - Add `deposit_payment_method` (text) - How deposit was paid
    - Add `balance_amount` (numeric) - Remaining amount after deposit

  2. Changes to Invoices Table
    - Add `deposit_amount` (numeric) - Required deposit amount
    - Add `amount_paid` (numeric) - Amount paid so far
    - Add `balance_due` (numeric) - Remaining balance
    - Update payment_status to include 'Partially Paid'

  3. New Table: booking_deposits
    - Track individual deposit transactions
    - Provides audit trail for deposit payments

  4. Security
    - Maintain existing RLS policies
    - Audit logging for deposit payments
*/

-- Add deposit tracking fields to bookings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE bookings ADD COLUMN total_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'deposit_amount'
  ) THEN
    ALTER TABLE bookings ADD COLUMN deposit_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'deposit_paid'
  ) THEN
    ALTER TABLE bookings ADD COLUMN deposit_paid boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'deposit_payment_date'
  ) THEN
    ALTER TABLE bookings ADD COLUMN deposit_payment_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'deposit_payment_method'
  ) THEN
    ALTER TABLE bookings ADD COLUMN deposit_payment_method text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'balance_amount'
  ) THEN
    ALTER TABLE bookings ADD COLUMN balance_amount numeric DEFAULT 0;
  END IF;
END $$;

-- Add deposit tracking fields to invoices table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'deposit_amount'
  ) THEN
    ALTER TABLE invoices ADD COLUMN deposit_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'amount_paid'
  ) THEN
    ALTER TABLE invoices ADD COLUMN amount_paid numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'balance_due'
  ) THEN
    ALTER TABLE invoices ADD COLUMN balance_due numeric DEFAULT 0;
  END IF;
END $$;

-- Create booking_deposits table for tracking deposit transactions
CREATE TABLE IF NOT EXISTS booking_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL CHECK (payment_method IN ('Cash', 'Bank Transfer', 'Card', 'Mobile Money', 'Other')),
  reference_number text,
  notes text,
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on booking_deposits
ALTER TABLE booking_deposits ENABLE ROW LEVEL SECURITY;

-- Admins and managers can view all deposit records
CREATE POLICY "Admins and managers can view deposit records"
  ON booking_deposits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- Admins and managers can insert deposit records
CREATE POLICY "Admins and managers can insert deposit records"
  ON booking_deposits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_booking_deposits_booking_id ON booking_deposits(booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_deposit_paid ON bookings(deposit_paid);

-- Function to auto-calculate balance_amount for bookings
CREATE OR REPLACE FUNCTION calculate_booking_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Calculate balance as total - deposit if deposit is paid
  IF NEW.deposit_paid THEN
    NEW.balance_amount = NEW.total_amount - NEW.deposit_amount;
  ELSE
    NEW.balance_amount = NEW.total_amount;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for auto-calculating booking balance
DROP TRIGGER IF EXISTS trigger_calculate_booking_balance ON bookings;

CREATE TRIGGER trigger_calculate_booking_balance
BEFORE INSERT OR UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION calculate_booking_balance();

-- Function to auto-calculate balance_due for invoices
CREATE OR REPLACE FUNCTION calculate_invoice_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Calculate balance as total - amount paid
  NEW.balance_due = NEW.total_amount - NEW.amount_paid;

  -- Auto-update payment status based on amount paid
  IF NEW.amount_paid = 0 THEN
    NEW.payment_status = 'Pending';
  ELSIF NEW.amount_paid >= NEW.total_amount THEN
    NEW.payment_status = 'Paid';
  ELSE
    NEW.payment_status = 'Partially Paid';
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for auto-calculating invoice balance
DROP TRIGGER IF EXISTS trigger_calculate_invoice_balance ON invoices;

CREATE TRIGGER trigger_calculate_invoice_balance
BEFORE INSERT OR UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION calculate_invoice_balance();

-- Function to record deposit payment for a booking
CREATE OR REPLACE FUNCTION record_booking_deposit(
  p_booking_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_reference_number text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_deposit_amount numeric;
BEGIN
  -- Get current user
  v_user_id := auth.uid();

  -- Get the required deposit amount
  SELECT deposit_amount INTO v_deposit_amount
  FROM bookings
  WHERE id = p_booking_id;

  -- Validate amount is at least the deposit amount
  IF p_amount < v_deposit_amount THEN
    RAISE EXCEPTION 'Payment amount must be at least the deposit amount';
  END IF;

  -- Insert deposit record
  INSERT INTO booking_deposits (
    booking_id,
    amount,
    payment_date,
    payment_method,
    reference_number,
    notes,
    recorded_by
  ) VALUES (
    p_booking_id,
    p_amount,
    p_payment_date,
    p_payment_method,
    p_reference_number,
    p_notes,
    v_user_id
  );

  -- Update booking
  UPDATE bookings
  SET
    deposit_paid = true,
    deposit_payment_date = p_payment_date,
    deposit_payment_method = p_payment_method,
    status = CASE
      WHEN status = 'Deposit Not Paid' THEN 'Active'
      ELSE status
    END
  WHERE id = p_booking_id;

  RETURN true;
END;
$$;

-- Add comment explaining the deposit system
COMMENT ON COLUMN bookings.deposit_amount IS 'Required deposit amount (25% of total booking cost)';
COMMENT ON COLUMN invoices.deposit_amount IS 'Required deposit amount (25% of invoice total)';
COMMENT ON TABLE booking_deposits IS 'Tracks individual deposit payment transactions for bookings';
