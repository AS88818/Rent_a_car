-- Support assigning snags to external parties (non-registered users)

-- 1. Add external name column to snag_assignments
ALTER TABLE snag_assignments ADD COLUMN IF NOT EXISTS assigned_to_external text;

-- 2. Drop NOT NULL on assigned_to so external assignments can omit it
ALTER TABLE snag_assignments ALTER COLUMN assigned_to DROP NOT NULL;

-- 3. Require at least one of assigned_to or assigned_to_external
ALTER TABLE snag_assignments ADD CONSTRAINT snag_assignments_assignee_required
  CHECK (assigned_to IS NOT NULL OR assigned_to_external IS NOT NULL);

-- 4. Add external name column to snags
ALTER TABLE snags ADD COLUMN IF NOT EXISTS assigned_to_external text;

-- 5. Replace the closed-must-be-assigned constraint to allow external assignees
ALTER TABLE snags DROP CONSTRAINT IF EXISTS snags_closed_must_be_assigned;
ALTER TABLE snags ADD CONSTRAINT snags_closed_must_be_assigned
  CHECK (
    (status = 'Closed' AND (assigned_to IS NOT NULL OR assigned_to_external IS NOT NULL)) OR
    (status != 'Closed')
  );

-- 6. Update the snag sync trigger to also copy assigned_to_external
CREATE OR REPLACE FUNCTION update_snag_on_assignment()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE snags
  SET
    assigned_to = NEW.assigned_to,
    assigned_to_external = NEW.assigned_to_external,
    assignment_deadline = NEW.deadline
  WHERE id = NEW.snag_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Update notification trigger to skip external assignments (no user to notify)
CREATE OR REPLACE FUNCTION notify_snag_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_snag_description text;
  v_vehicle_reg text;
BEGIN
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.description, v.reg_number INTO v_snag_description, v_vehicle_reg
  FROM snags s
  JOIN vehicles v ON v.id = s.vehicle_id
  WHERE s.id = NEW.snag_id;

  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (
    NEW.assigned_to,
    'snag_assigned',
    'New Snag Assignment',
    'You have been assigned: "' || v_snag_description || '" for vehicle ' || v_vehicle_reg,
    '/snags?vehicle=' || (SELECT vehicle_id FROM snags WHERE id = NEW.snag_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
