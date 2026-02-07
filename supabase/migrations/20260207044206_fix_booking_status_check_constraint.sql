/*
  # Fix Booking Status CHECK Constraint

  1. Changes
    - Update bookings status CHECK constraint to match app values
    - DB currently allows 'Deposit Not Paid' but app uses 'Advance Payment Not Paid'
    - Also update any existing rows using old value

  2. Important Notes
    - Drops and recreates the CHECK constraint (safe - no data loss)
    - Updates any existing rows that may have the old status value
*/

UPDATE bookings
SET status = 'Advance Payment Not Paid'
WHERE status = 'Deposit Not Paid';

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status = ANY (ARRAY['Draft'::text, 'Advance Payment Not Paid'::text, 'Active'::text, 'Completed'::text, 'Cancelled'::text]));
