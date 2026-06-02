/*
  # Add security deposit reminder fields

  Stores how the refundable security deposit was received directly on the
  booking. This is operational metadata only; it does not create payment rows
  or update invoices.
*/

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS security_deposit_method text;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS security_deposit_reference_number text;

ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS bookings_security_deposit_method_check;

ALTER TABLE bookings
ADD CONSTRAINT bookings_security_deposit_method_check
CHECK (
  security_deposit_method IS NULL OR
  security_deposit_method IN ('Cash', 'Bank Transfer', 'Card', 'Mobile Money', 'Other')
);

COMMENT ON COLUMN bookings.security_deposit_method IS 'Operational reminder: how the refundable security deposit was received.';
COMMENT ON COLUMN bookings.security_deposit_reference_number IS 'Optional receipt, transaction, or bank reference for the refundable security deposit.';
