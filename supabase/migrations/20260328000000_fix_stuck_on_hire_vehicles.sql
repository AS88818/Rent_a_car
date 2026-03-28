/*
  # Fix vehicles stuck On Hire

  ## Problem
  Bookings that expire naturally (end_datetime passes) stay in 'Active' status forever.
  The trigger `manage_vehicle_booking_status` only fires on explicit status changes
  (Completed/Cancelled), so vehicles remain 'On Hire' indefinitely.

  ## Changes

  1. Part A: Data fix — auto-complete all stale Active bookings.
     Updating booking status to 'Completed' fires the existing trigger, which
     resets vehicle status automatically.

  2. Part B: pg_cron job — prevent future occurrences.
     Runs hourly to auto-complete bookings that expire without being manually closed.

  3. Part C: Safety net — directly fix any vehicles still stuck On Hire with
     no active booking (handles trigger failures or missed edge cases).
*/


-- ============================================================
-- PART A: Auto-complete all stale Active bookings
-- ============================================================
-- Firing the trigger via status update is the cleanest approach:
-- it reuses existing trigger logic to reset vehicle status.

UPDATE bookings
SET status = 'Completed'
WHERE status = 'Active'
  AND end_datetime < NOW();


-- ============================================================
-- PART B: pg_cron job — prevent future stuck On Hire vehicles
-- ============================================================

CREATE OR REPLACE FUNCTION auto_complete_overdue_bookings()
RETURNS void AS $$
BEGIN
  UPDATE bookings
  SET status = 'Completed'
  WHERE status = 'Active'
    AND end_datetime < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Schedule to run every hour (pg_cron must be enabled on the project)
SELECT cron.schedule(
  'auto-complete-overdue-bookings',
  '0 * * * *',
  'SELECT auto_complete_overdue_bookings()'
);


-- ============================================================
-- PART C: Safety net — fix orphaned On Hire vehicles
-- ============================================================
-- Runs AFTER Part A so it only catches vehicles where the trigger
-- failed to fire (e.g. silent trigger errors or pre-migration data).

UPDATE vehicles v
SET status = CASE WHEN v.health_flag = 'Grounded' THEN 'Grounded' ELSE 'Available' END
WHERE v.status = 'On Hire'
  AND NOT EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.vehicle_id = v.id
      AND b.status = 'Active'
      AND b.end_datetime > NOW()
  );
