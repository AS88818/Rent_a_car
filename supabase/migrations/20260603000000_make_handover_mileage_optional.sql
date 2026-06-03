/*
  # Make booking handover mileage optional

  Handover mileage is captured at the actual pickup/handover, not necessarily
  when a booking is created in advance. This removes the required-mileage rule
  while keeping the sanity check that any entered handover mileage must not be
  lower than the vehicle's current recorded mileage.
*/

DROP TRIGGER IF EXISTS trigger_require_handover_mileage_for_confirmed_booking ON bookings;
DROP FUNCTION IF EXISTS public.enforce_handover_mileage_for_confirmed_booking();

CREATE OR REPLACE FUNCTION public.enforce_handover_mileage_minimum_when_present()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_mileage numeric;
  v_should_validate boolean := false;
BEGIN
  IF COALESCE(NEW.status, '') <> 'Draft' AND NEW.handover_mileage IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      v_should_validate := true;
    ELSE
      v_should_validate :=
        NEW.handover_mileage IS DISTINCT FROM OLD.handover_mileage
        OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
        OR NEW.status IS DISTINCT FROM OLD.status;
    END IF;

    IF v_should_validate THEN
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

DROP TRIGGER IF EXISTS trigger_validate_handover_mileage_when_present ON bookings;
CREATE TRIGGER trigger_validate_handover_mileage_when_present
  BEFORE INSERT OR UPDATE OF status, handover_mileage, vehicle_id ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_handover_mileage_minimum_when_present();

REVOKE EXECUTE ON FUNCTION public.enforce_handover_mileage_minimum_when_present() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_handover_mileage_minimum_when_present() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_handover_mileage_minimum_when_present() FROM authenticated;
