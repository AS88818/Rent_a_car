/*
  # Fix Booking Notification Link
  
  Changes the booking assignment notification link from /bookings to /calendar
  since /calendar is accessible to all users including drivers/chauffeurs.
*/

CREATE OR REPLACE FUNCTION notify_booking_chauffeur_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_vehicle_reg text;
  v_booking_ref text;
  v_client_name text;
  v_start_datetime timestamptz;
  v_chauffeur_user_id uuid;
BEGIN
  IF NEW.chauffeur_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' AND OLD.chauffeur_id = NEW.chauffeur_id THEN
    RETURN NEW;
  END IF;

  SELECT v.reg_number INTO v_vehicle_reg
  FROM vehicles v
  WHERE v.id = NEW.vehicle_id;

  v_booking_ref := COALESCE(NEW.booking_reference, 'Booking');
  v_client_name := NEW.client_name;
  v_start_datetime := NEW.start_datetime;

  SELECT id INTO v_chauffeur_user_id
  FROM users
  WHERE id::text = NEW.chauffeur_id::text
  LIMIT 1;

  IF v_chauffeur_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, message, link, priority, metadata)
  VALUES (
    v_chauffeur_user_id,
    'booking_assigned',
    'New Booking Assignment',
    'You have been assigned to ' || v_booking_ref || ' for ' || v_client_name || 
    ' (' || v_vehicle_reg || ') on ' || to_char(v_start_datetime, 'DD Mon YYYY'),
    '/calendar',
    'info',
    jsonb_build_object(
      'booking_id', NEW.id,
      'vehicle_id', NEW.vehicle_id,
      'vehicle_reg', v_vehicle_reg,
      'client_name', v_client_name,
      'start_datetime', v_start_datetime
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
