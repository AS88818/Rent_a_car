/*
  # Require handover mileage to be at least current vehicle mileage

  Staff must enter the actual odometer reading at handover, but it cannot be
  below the vehicle's current recorded mileage. This prevents placeholder
  values such as 1, 2, or 900 from confirming a booking when the vehicle is
  already recorded at 10,000 km.
*/

CREATE OR REPLACE FUNCTION enforce_handover_mileage_for_confirmed_booking()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_current_mileage numeric;
  v_should_check_minimum boolean := false;
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

  IF NEW.status <> 'Draft' AND NEW.handover_mileage IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      v_should_check_minimum := true;
    ELSE
      v_should_check_minimum :=
        NEW.handover_mileage IS DISTINCT FROM OLD.handover_mileage
        OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
        OR (COALESCE(OLD.status, 'Draft') = 'Draft' AND NEW.status <> 'Draft');
    END IF;

    IF v_should_check_minimum THEN
      SELECT current_mileage
      INTO v_current_mileage
      FROM vehicles
      WHERE id = NEW.vehicle_id;

      IF NEW.handover_mileage < COALESCE(v_current_mileage, 0) THEN
        RAISE EXCEPTION 'Handover mileage (%) cannot be lower than current vehicle mileage (%)',
          NEW.handover_mileage,
          COALESCE(v_current_mileage, 0)
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_require_handover_mileage_for_confirmed_booking ON bookings;
CREATE TRIGGER trigger_require_handover_mileage_for_confirmed_booking
  BEFORE INSERT OR UPDATE OF status, handover_mileage, vehicle_id ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_handover_mileage_for_confirmed_booking();
