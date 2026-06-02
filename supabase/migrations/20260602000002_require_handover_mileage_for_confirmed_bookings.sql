/*
  # Require handover mileage for confirmed bookings

  A draft can exist without an odometer reading, but a confirmed booking must
  capture the handover mileage at pickup. This trigger protects non-UI insert
  paths without forcing existing confirmed bookings to be backfilled before they
  can be edited for unrelated fields.
*/

CREATE OR REPLACE FUNCTION enforce_handover_mileage_for_confirmed_booking()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'Draft'
    AND NEW.handover_mileage IS NULL
    AND (
      TG_OP = 'INSERT'
      OR (TG_OP = 'UPDATE' AND COALESCE(OLD.status, 'Draft') = 'Draft')
    )
  THEN
    RAISE EXCEPTION 'Handover mileage is required before confirming a booking'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_require_handover_mileage_for_confirmed_booking ON bookings;
CREATE TRIGGER trigger_require_handover_mileage_for_confirmed_booking
  BEFORE INSERT OR UPDATE OF status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_handover_mileage_for_confirmed_booking();
