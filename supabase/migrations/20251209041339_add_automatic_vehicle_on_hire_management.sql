/*
  # Add Automatic Vehicle On-Hire Status Management

  1. Purpose
    - Automatically manage vehicle on_hire status based on active bookings
    - Prevent manual on_hire flag from being set incorrectly
    - Sync vehicle status with booking lifecycle

  2. New Functions
    - update_vehicle_on_hire_status() - Updates vehicle based on active bookings
    - sync_vehicle_status_on_booking() - Trigger function for booking changes

  3. Triggers
    - Automatically update vehicle status when bookings are created/updated
    - Set on_hire=true and status='On Hire' when booking is active
    - Reset on_hire=false and status='Available' when no active bookings

  4. Important Notes
    - A booking is "active" when current time is between start_datetime and end_datetime
    - AND booking status is 'Active'
    - When on hire, branch_id is set to NULL
    - When booking ends, vehicle is automatically assigned to drop-off branch
    - If drop-off location matches a branch name, branch_id is set automatically
    - If drop-off location doesn't match any branch, branch_id stays NULL (manual assignment needed)
*/

-- Function to update vehicle on-hire status based on active bookings
CREATE OR REPLACE FUNCTION update_vehicle_on_hire_status(vehicle_uuid uuid)
RETURNS void AS $$
DECLARE
  active_booking_count integer;
  booking_location text;
  booking_client text;
  last_end_location text;
  dropoff_branch_id uuid;
BEGIN
  -- Count active bookings for this vehicle
  -- A booking is active if:
  -- 1. Status is 'Active'
  -- 2. Current time is between start and end datetime
  SELECT COUNT(*), MAX(start_location), MAX(client_name)
  INTO active_booking_count, booking_location, booking_client
  FROM bookings
  WHERE vehicle_id = vehicle_uuid
    AND status = 'Active'
    AND start_datetime <= NOW()
    AND end_datetime >= NOW();

  -- Update vehicle based on active bookings
  IF active_booking_count > 0 THEN
    -- Vehicle is on hire
    UPDATE vehicles
    SET
      on_hire = true,
      status = 'On Hire',
      branch_id = NULL,
      on_hire_location = COALESCE(booking_client, booking_location)
    WHERE id = vehicle_uuid;
  ELSE
    -- Vehicle is not on hire
    -- Get the most recent completed booking's drop-off location
    SELECT end_location
    INTO last_end_location
    FROM bookings
    WHERE vehicle_id = vehicle_uuid
      AND status = 'Active'
      AND end_datetime < NOW()
    ORDER BY end_datetime DESC
    LIMIT 1;

    -- Try to match drop-off location to a branch
    IF last_end_location IS NOT NULL THEN
      SELECT id
      INTO dropoff_branch_id
      FROM branches
      WHERE branch_name = last_end_location
      LIMIT 1;
    END IF;

    -- Update vehicle (only if currently marked as on_hire)
    UPDATE vehicles
    SET
      on_hire = false,
      status = CASE
        WHEN health_flag = 'Grounded' THEN 'Grounded'
        ELSE 'Available'
      END,
      on_hire_location = NULL,
      branch_id = dropoff_branch_id  -- Will be NULL if no branch match found
    WHERE id = vehicle_uuid
      AND on_hire = true;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to sync vehicle status when booking changes
CREATE OR REPLACE FUNCTION sync_vehicle_status_on_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT and UPDATE
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    -- Update the vehicle's on-hire status
    PERFORM update_vehicle_on_hire_status(NEW.vehicle_id);
    RETURN NEW;
  END IF;

  -- Handle DELETE
  IF (TG_OP = 'DELETE') THEN
    -- Update the vehicle's on-hire status
    PERFORM update_vehicle_on_hire_status(OLD.vehicle_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for booking changes
DROP TRIGGER IF EXISTS trigger_sync_vehicle_status_on_booking ON bookings;
CREATE TRIGGER trigger_sync_vehicle_status_on_booking
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION sync_vehicle_status_on_booking();

-- Update all vehicles to have correct on-hire status based on current bookings
DO $$
DECLARE
  vehicle_record RECORD;
BEGIN
  FOR vehicle_record IN SELECT DISTINCT id FROM vehicles LOOP
    PERFORM update_vehicle_on_hire_status(vehicle_record.id);
  END LOOP;
END $$;

-- Add comment
COMMENT ON FUNCTION update_vehicle_on_hire_status(uuid) IS 
  'Updates vehicle on_hire status and location based on active bookings. A booking is active when current time is between start and end datetime and status is Active.';

COMMENT ON FUNCTION sync_vehicle_status_on_booking() IS 
  'Trigger function that automatically updates vehicle on-hire status when bookings are created, updated, or deleted.';
