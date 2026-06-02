/*
  # Add booking mileage fields

  Feature 6 adds mileage allowance display on quotes and mileage capture on bookings.

  - `company_settings.daily_mileage_allowance_km` stores the global allowance used
    for quote inclusions and booking excess calculations.
  - `bookings.handover_mileage` and `bookings.return_mileage` capture odometer
    readings at pickup and return.
  - `bookings.avg_daily_km` is generated for reporting.
  - A booking return mileage update advances `vehicles.current_mileage` without
    ever lowering it.
*/

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS daily_mileage_allowance_km integer NOT NULL DEFAULT 250;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'company_settings_daily_mileage_allowance_positive'
  ) THEN
    ALTER TABLE company_settings
      ADD CONSTRAINT company_settings_daily_mileage_allowance_positive
      CHECK (daily_mileage_allowance_km > 0);
  END IF;
END $$;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS handover_mileage integer,
  ADD COLUMN IF NOT EXISTS return_mileage integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'bookings'
      AND column_name = 'avg_daily_km'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE bookings
      ADD COLUMN avg_daily_km numeric GENERATED ALWAYS AS (
        CASE
          WHEN handover_mileage IS NOT NULL
            AND return_mileage IS NOT NULL
            AND return_mileage >= handover_mileage
            AND EXTRACT(EPOCH FROM (end_datetime - start_datetime)) > 0
          THEN ROUND(
            ((return_mileage - handover_mileage)::numeric /
              GREATEST(1, CEIL(EXTRACT(EPOCH FROM (end_datetime - start_datetime)) / 86400.0))
            ),
            2
          )
          ELSE NULL
        END
      ) STORED;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_handover_mileage_nonnegative'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_handover_mileage_nonnegative
      CHECK (handover_mileage IS NULL OR handover_mileage >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_return_mileage_nonnegative'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_return_mileage_nonnegative
      CHECK (return_mileage IS NULL OR return_mileage >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_return_mileage_after_handover'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_return_mileage_after_handover
      CHECK (
        handover_mileage IS NULL
        OR return_mileage IS NULL
        OR return_mileage >= handover_mileage
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_vehicle_mileage_from_booking_return()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.return_mileage IS NOT NULL THEN
    UPDATE vehicles
    SET
      current_mileage = GREATEST(COALESCE(current_mileage, 0), NEW.return_mileage),
      last_mileage_update = CASE
        WHEN NEW.return_mileage > COALESCE(current_mileage, 0)
          THEN COALESCE(NEW.end_datetime::date, CURRENT_DATE)
        ELSE last_mileage_update
      END,
      updated_at = now()
    WHERE id = NEW.vehicle_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_vehicle_mileage_on_booking_return ON bookings;
CREATE TRIGGER trigger_update_vehicle_mileage_on_booking_return
  AFTER INSERT OR UPDATE OF return_mileage, vehicle_id, end_datetime ON bookings
  FOR EACH ROW
  WHEN (NEW.return_mileage IS NOT NULL)
  EXECUTE FUNCTION update_vehicle_mileage_from_booking_return();

CREATE OR REPLACE VIEW company_settings_public
WITH (security_invoker = true)
AS
SELECT
  id,
  company_name,
  tagline,
  email,
  phone_nanyuki,
  phone_nairobi,
  website_url,
  address,
  bank_name,
  bank_account,
  mpesa_till,
  logo_url,
  email_signature,
  currency_code,
  currency_locale,
  google_client_id,
  google_calendar_id,
  google_sync_enabled,
  google_last_sync_at,
  google_redirect_uri,
  quote_whatsapp_template,
  daily_mileage_allowance_km,
  updated_at,
  updated_by
FROM company_settings;

COMMENT ON COLUMN company_settings.daily_mileage_allowance_km IS 'Global included mileage allowance per rental day, in kilometres.';
COMMENT ON COLUMN bookings.handover_mileage IS 'Vehicle odometer reading captured at handover/pickup.';
COMMENT ON COLUMN bookings.return_mileage IS 'Vehicle odometer reading captured at return/dropoff.';
COMMENT ON COLUMN bookings.avg_daily_km IS 'Generated average daily kilometres driven for the booking.';
