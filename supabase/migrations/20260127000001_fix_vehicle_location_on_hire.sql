/*
  # Fix vehicle location handling for on-hire status

  1. Changes
    - Vehicle branch_id should NOT be cleared when going on hire
    - Vehicle branch_id should be updated based on drop-off location when booking completes
    - On hire is a STATUS, not a location change

  2. Logic
    - When booking becomes Active: Set on_hire = true, keep branch_id unchanged
    - When booking is Completed: Set on_hire = false, update branch_id to match end_location branch
    - When booking is Cancelled: Set on_hire = false, keep branch_id unchanged
*/

-- Update the function to manage vehicle on-hire status
CREATE OR REPLACE FUNCTION manage_vehicle_on_hire_status()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  end_location_branch_id uuid;
BEGIN
  -- When a new booking becomes Active
  IF (TG_OP = 'INSERT' AND NEW.status = 'Active') OR
     (TG_OP = 'UPDATE' AND NEW.status = 'Active' AND OLD.status != 'Active') THEN

    -- Only set on_hire flag, do NOT change branch_id
    UPDATE vehicles
    SET
      on_hire = true,
      on_hire_location = NEW.client_name
    WHERE id = NEW.vehicle_id;

  -- When booking is Completed, update branch based on drop-off location
  ELSIF TG_OP = 'UPDATE' AND
        NEW.status = 'Completed' AND
        OLD.status != 'Completed' THEN

    -- Try to find a branch matching the end_location
    SELECT id INTO end_location_branch_id
    FROM branches
    WHERE LOWER(branch_name) LIKE '%' || LOWER(SPLIT_PART(NEW.end_location, ' ', 1)) || '%'
       OR LOWER(NEW.end_location) LIKE '%' || LOWER(SPLIT_PART(branch_name, ' ', 1)) || '%'
    LIMIT 1;

    -- Update vehicle: clear on_hire, update branch if found
    UPDATE vehicles
    SET
      on_hire = false,
      on_hire_location = NULL,
      branch_id = COALESCE(end_location_branch_id, branch_id)
    WHERE id = NEW.vehicle_id;

  -- When booking is Cancelled, just clear on_hire status
  ELSIF TG_OP = 'UPDATE' AND
        NEW.status = 'Cancelled' AND
        OLD.status NOT IN ('Completed', 'Cancelled') THEN

    -- Only clear on_hire, keep branch_id unchanged
    UPDATE vehicles
    SET
      on_hire = false,
      on_hire_location = NULL
    WHERE id = NEW.vehicle_id;

  END IF;

  RETURN NEW;
END;
$$;
