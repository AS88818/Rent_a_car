/*
  # Add Automatic On-Hire Management for Vehicles
  
  ## Overview
  Automatically updates vehicle on-hire status based on booking status changes.
  
  ## Changes
  1. Creates function to manage vehicle on-hire status
  2. Adds triggers on bookings table for automatic updates
  
  ## Behavior
  - **When booking becomes Active**: 
    - Sets vehicle `on_hire = true`
    - Sets `branch_id = NULL`
    - Sets `on_hire_location` to client name
  
  - **When booking is Completed or Cancelled**:
    - Sets vehicle `on_hire = false`
    - Restores `branch_id` from booking's branch_id
    - Clears `on_hire_location`
  
  ## Security
  - Function uses SECURITY DEFINER to bypass RLS
  - Only triggered by booking status changes
*/

-- Create function to manage vehicle on-hire status
CREATE OR REPLACE FUNCTION manage_vehicle_on_hire_status()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- When a new booking becomes Active
  IF (TG_OP = 'INSERT' AND NEW.status = 'Active') OR
     (TG_OP = 'UPDATE' AND NEW.status = 'Active' AND OLD.status != 'Active') THEN
    
    UPDATE vehicles
    SET 
      on_hire = true,
      branch_id = NULL,
      on_hire_location = NEW.client_name
    WHERE id = NEW.vehicle_id;
    
  -- When booking is Completed or Cancelled, return vehicle to branch
  ELSIF TG_OP = 'UPDATE' AND 
        NEW.status IN ('Completed', 'Cancelled') AND 
        OLD.status NOT IN ('Completed', 'Cancelled') THEN
    
    UPDATE vehicles
    SET 
      on_hire = false,
      branch_id = NEW.branch_id,
      on_hire_location = NULL
    WHERE id = NEW.vehicle_id;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger for INSERT operations (new bookings)
DROP TRIGGER IF EXISTS trigger_manage_vehicle_on_hire_insert ON bookings;
CREATE TRIGGER trigger_manage_vehicle_on_hire_insert
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION manage_vehicle_on_hire_status();

-- Add trigger for UPDATE operations (booking status changes)
DROP TRIGGER IF EXISTS trigger_manage_vehicle_on_hire_update ON bookings;
CREATE TRIGGER trigger_manage_vehicle_on_hire_update
  AFTER UPDATE ON bookings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION manage_vehicle_on_hire_status();
