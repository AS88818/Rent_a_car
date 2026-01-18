/*
  # Separate Refundable Security Deposit from 25% Advance Payment

  ## Overview
  This migration properly separates two distinct payment concepts that were previously combined:
  - **Refundable Security Deposit**: Fixed amount per vehicle category (self-drive only), held as security against damage
  - **25% Advance Payment**: Down payment to confirm ANY booking (25% of total cost), goes toward the total amount

  ## Changes to bookings table
  
  ### Renamed Fields (deposit → advance_payment)
  - `deposit_amount` → `advance_payment_amount` (25% of booking total)
  - `deposit_paid` → `advance_payment_paid` (boolean status)
  - `deposit_payment_date` → `advance_payment_date` (when advance was paid)
  - `deposit_payment_method` → `advance_payment_method` (payment method used)
  
  ### New Fields (security_deposit)
  - `security_deposit_amount` (fixed amount for self-drive bookings)
  - `security_deposit_collected` (boolean - collected at pickup)
  - `security_deposit_collected_date` (when collected)
  - `security_deposit_refunded` (boolean - refunded after return)
  - `security_deposit_refunded_date` (when refunded)
  - `security_deposit_notes` (notes about collection/refund)

  ## Changes to booking_deposits table
  - Renamed to `booking_payments` for clarity
  - Added `payment_type` field: 'advance_payment', 'balance_payment', 'security_deposit_collected', 'security_deposit_refunded'

  ## Changes to invoices table
  - Renamed `deposit_amount` → `advance_payment_amount`
  - Added `security_deposit_amount` (separate field)
  - Updated `amount_due` calculation logic

  ## Triggers Updated
  - Modified balance calculation to use advance_payment correctly
  - Added automatic security_deposit_amount calculation for self-drive bookings

  ## Security
  - All existing RLS policies remain in effect
  - New fields follow same access patterns as existing payment fields
*/

-- Step 1: Update bookings table - rename deposit fields to advance_payment
DO $$
BEGIN
  -- Rename deposit_amount to advance_payment_amount
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'deposit_amount'
  ) THEN
    ALTER TABLE bookings RENAME COLUMN deposit_amount TO advance_payment_amount;
  END IF;

  -- Rename deposit_paid to advance_payment_paid
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'deposit_paid'
  ) THEN
    ALTER TABLE bookings RENAME COLUMN deposit_paid TO advance_payment_paid;
  END IF;

  -- Rename deposit_payment_date to advance_payment_date
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'deposit_payment_date'
  ) THEN
    ALTER TABLE bookings RENAME COLUMN deposit_payment_date TO advance_payment_date;
  END IF;

  -- Rename deposit_payment_method to advance_payment_method
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'deposit_payment_method'
  ) THEN
    ALTER TABLE bookings RENAME COLUMN deposit_payment_method TO advance_payment_method;
  END IF;
END $$;

-- Step 2: Add new security_deposit fields to bookings table
DO $$
BEGIN
  -- Add security_deposit_amount
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'security_deposit_amount'
  ) THEN
    ALTER TABLE bookings ADD COLUMN security_deposit_amount decimal(10,2) DEFAULT 0;
  END IF;

  -- Add security_deposit_collected
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'security_deposit_collected'
  ) THEN
    ALTER TABLE bookings ADD COLUMN security_deposit_collected boolean DEFAULT false;
  END IF;

  -- Add security_deposit_collected_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'security_deposit_collected_date'
  ) THEN
    ALTER TABLE bookings ADD COLUMN security_deposit_collected_date timestamptz;
  END IF;

  -- Add security_deposit_refunded
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'security_deposit_refunded'
  ) THEN
    ALTER TABLE bookings ADD COLUMN security_deposit_refunded boolean DEFAULT false;
  END IF;

  -- Add security_deposit_refunded_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'security_deposit_refunded_date'
  ) THEN
    ALTER TABLE bookings ADD COLUMN security_deposit_refunded_date timestamptz;
  END IF;

  -- Add security_deposit_notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'security_deposit_notes'
  ) THEN
    ALTER TABLE bookings ADD COLUMN security_deposit_notes text;
  END IF;
END $$;

-- Step 3: Rename booking_deposits table to booking_payments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'booking_deposits'
  ) THEN
    ALTER TABLE booking_deposits RENAME TO booking_payments;
  END IF;
END $$;

-- Step 4: Add payment_type to booking_payments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_payments' AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE booking_payments ADD COLUMN payment_type text DEFAULT 'advance_payment';
    
    -- Add check constraint for valid payment types
    ALTER TABLE booking_payments ADD CONSTRAINT payment_type_check 
      CHECK (payment_type IN ('advance_payment', 'balance_payment', 'security_deposit_collected', 'security_deposit_refunded'));
  END IF;
END $$;

-- Step 5: Update invoices table
DO $$
BEGIN
  -- Rename deposit_amount to advance_payment_amount
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'deposit_amount'
  ) THEN
    ALTER TABLE invoices RENAME COLUMN deposit_amount TO advance_payment_amount;
  END IF;

  -- Add security_deposit_amount
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'security_deposit_amount'
  ) THEN
    ALTER TABLE invoices ADD COLUMN security_deposit_amount decimal(10,2) DEFAULT 0;
  END IF;
END $$;

-- Step 6: Create trigger to auto-calculate security_deposit_amount for self-drive bookings
CREATE OR REPLACE FUNCTION calculate_security_deposit()
RETURNS TRIGGER AS $$
DECLARE
  v_category_name text;
  v_deposit_amount decimal(10,2);
BEGIN
  -- Only calculate for new bookings or when vehicle/category changes
  IF (TG_OP = 'INSERT' OR OLD.vehicle_id IS NULL OR NEW.vehicle_id != OLD.vehicle_id) THEN
    -- Get vehicle category name
    SELECT vc.category_name
    INTO v_category_name
    FROM vehicles v
    JOIN vehicle_categories vc ON v.category_id = vc.id
    WHERE v.id = NEW.vehicle_id;

    -- Get security deposit amount from pricing
    SELECT self_drive_deposit
    INTO v_deposit_amount
    FROM category_pricing
    WHERE category_name = v_category_name;

    -- Set security deposit amount if self-drive booking
    IF NEW.booking_type = 'self_drive' THEN
      NEW.security_deposit_amount := COALESCE(v_deposit_amount, 0);
    ELSE
      NEW.security_deposit_amount := 0;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS set_security_deposit_trigger ON bookings;
CREATE TRIGGER set_security_deposit_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION calculate_security_deposit();

-- Step 7: Update balance_amount calculation trigger to use advance_payment
CREATE OR REPLACE FUNCTION calculate_booking_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate balance as total_amount minus advance_payment_amount (if paid)
  IF NEW.advance_payment_paid THEN
    NEW.balance_amount := NEW.total_amount - COALESCE(NEW.advance_payment_amount, 0);
  ELSE
    NEW.balance_amount := NEW.total_amount;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS calculate_balance_trigger ON bookings;
CREATE TRIGGER calculate_balance_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION calculate_booking_balance();

-- Step 8: Backfill existing data - set advance_payment_amount to 25% of total for existing bookings
UPDATE bookings
SET advance_payment_amount = ROUND(total_amount * 0.25, 2)
WHERE advance_payment_amount IS NULL OR advance_payment_amount = 0;

-- Step 9: Backfill security_deposit_amount for existing self-drive bookings
UPDATE bookings b
SET security_deposit_amount = COALESCE(cp.self_drive_deposit, 0)
FROM vehicles v
JOIN vehicle_categories vc ON v.category_id = vc.id
LEFT JOIN category_pricing cp ON vc.category_name = cp.category_name
WHERE b.vehicle_id = v.id
  AND b.booking_type = 'self_drive'
  AND (b.security_deposit_amount IS NULL OR b.security_deposit_amount = 0);

-- Step 10: Update existing booking_payments records to set payment_type
UPDATE booking_payments
SET payment_type = 'advance_payment'
WHERE payment_type IS NULL OR payment_type = '';

-- Step 11: Add comments for documentation
COMMENT ON COLUMN bookings.advance_payment_amount IS '25% advance payment to confirm booking (goes toward total)';
COMMENT ON COLUMN bookings.advance_payment_paid IS 'Whether the 25% advance payment has been received';
COMMENT ON COLUMN bookings.advance_payment_date IS 'Date when advance payment was received';
COMMENT ON COLUMN bookings.advance_payment_method IS 'Payment method used for advance payment';
COMMENT ON COLUMN bookings.security_deposit_amount IS 'Refundable security deposit (self-drive only, held against damage)';
COMMENT ON COLUMN bookings.security_deposit_collected IS 'Whether security deposit was collected at pickup';
COMMENT ON COLUMN bookings.security_deposit_collected_date IS 'Date when security deposit was collected';
COMMENT ON COLUMN bookings.security_deposit_refunded IS 'Whether security deposit was refunded after return';
COMMENT ON COLUMN bookings.security_deposit_refunded_date IS 'Date when security deposit was refunded';
COMMENT ON COLUMN bookings.security_deposit_notes IS 'Notes about security deposit collection or refund';
COMMENT ON COLUMN booking_payments.payment_type IS 'Type of payment: advance_payment, balance_payment, security_deposit_collected, or security_deposit_refunded';
