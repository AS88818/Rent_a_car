/*
  # Fix Snag Notification Deep Link

  Updates the notify_snag_assignment trigger function to include the snag_id
  in both the notification link and metadata, enabling direct navigation to
  the specific snag from the notification.

  Link changes from:  /snags?vehicle={vehicle_id}
  Link changes to:    /snags?vehicle={vehicle_id}&snag={snag_id}
*/

CREATE OR REPLACE FUNCTION notify_snag_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_snag_description text;
  v_vehicle_reg text;
  v_vehicle_id uuid;
BEGIN
  -- Get snag and vehicle details
  SELECT s.description, s.vehicle_id, v.reg_number
    INTO v_snag_description, v_vehicle_id, v_vehicle_reg
  FROM snags s
  JOIN vehicles v ON v.id = s.vehicle_id
  WHERE s.id = NEW.snag_id;

  -- Create notification for assigned user with deep link to the specific snag
  INSERT INTO notifications (user_id, type, title, message, link, metadata)
  VALUES (
    NEW.assigned_to,
    'snag_assigned',
    'New Snag Assignment',
    'You have been assigned: "' || v_snag_description || '" for vehicle ' || v_vehicle_reg,
    '/snags?vehicle=' || v_vehicle_id || '&snag=' || NEW.snag_id,
    jsonb_build_object(
      'snag_id', NEW.snag_id,
      'vehicle_id', v_vehicle_id,
      'vehicle_reg', v_vehicle_reg
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
