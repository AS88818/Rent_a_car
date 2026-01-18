/*
  # Handle Email Queue Updates on Booking Changes

  1. New Trigger Function
    - `update_booking_emails()` - Handles email queue updates when bookings change
    - Updates pending reminder emails when booking dates change
    - Updates recipient email when client_email changes
    - Marks emails as cancelled when booking is cancelled/deleted
  
  2. New Trigger
    - `trigger_update_booking_emails` - Fires after UPDATE on bookings table
    - Automatically adjusts email queue based on booking changes
  
  3. Important Notes
    - Only updates pending emails (not sent or failed)
    - Recalculates scheduled_for times when dates change
    - Preserves email history by not deleting sent emails
    - Creates new emails if dates changed significantly
*/

-- Function to update email queue when booking is updated
CREATE OR REPLACE FUNCTION update_booking_emails()
RETURNS TRIGGER AS $$
DECLARE
  vehicle_reg text;
  template_record record;
  booking_data jsonb;
  email_subject text;
  email_body text;
  pickup_reminder_time timestamptz;
  dropoff_reminder_time timestamptz;
BEGIN
  -- If booking is cancelled or deleted, mark pending emails as cancelled
  IF NEW.status = 'Cancelled' OR NEW.status = 'Completed' THEN
    UPDATE email_queue
    SET status = 'cancelled'
    WHERE booking_id = NEW.id
      AND status = 'pending';
    
    RETURN NEW;
  END IF;

  -- Only process if client_email is provided
  IF NEW.client_email IS NULL OR NEW.client_email = '' THEN
    -- Delete pending emails if email was removed
    DELETE FROM email_queue
    WHERE booking_id = NEW.id
      AND status = 'pending';
    
    RETURN NEW;
  END IF;

  -- Get vehicle registration
  SELECT reg_number INTO vehicle_reg
  FROM vehicles
  WHERE id = NEW.vehicle_id;

  -- Prepare booking data for variable replacement
  booking_data := jsonb_build_object(
    'client_name', NEW.client_name,
    'vehicle_reg', COALESCE(vehicle_reg, 'N/A'),
    'start_date', TO_CHAR(NEW.start_datetime, 'DD Mon YYYY'),
    'start_time', TO_CHAR(NEW.start_datetime, 'HH24:MI'),
    'end_date', TO_CHAR(NEW.end_datetime, 'DD Mon YYYY'),
    'end_time', TO_CHAR(NEW.end_datetime, 'HH24:MI'),
    'start_location', NEW.start_location,
    'end_location', NEW.end_location,
    'duration', calculate_duration(NEW.start_datetime, NEW.end_datetime),
    'contact', NEW.contact
  );

  -- Update recipient email if it changed
  IF OLD.client_email IS DISTINCT FROM NEW.client_email THEN
    UPDATE email_queue
    SET recipient_email = NEW.client_email
    WHERE booking_id = NEW.id
      AND status = 'pending';
  END IF;

  -- Update recipient name if it changed
  IF OLD.client_name IS DISTINCT FROM NEW.client_name THEN
    UPDATE email_queue
    SET recipient_name = NEW.client_name
    WHERE booking_id = NEW.id
      AND status = 'pending';
  END IF;

  -- Handle start datetime changes
  IF OLD.start_datetime IS DISTINCT FROM NEW.start_datetime THEN
    pickup_reminder_time := NEW.start_datetime - INTERVAL '24 hours';
    
    -- Delete old pickup reminder
    DELETE FROM email_queue
    WHERE booking_id = NEW.id
      AND email_type = 'pickup_reminder'
      AND status = 'pending';
    
    -- Create new pickup reminder if time is in future
    IF pickup_reminder_time > NOW() THEN
      SELECT * INTO template_record
      FROM email_templates
      WHERE template_key = 'pickup_reminder' AND is_active = true;
      
      IF FOUND THEN
        email_subject := replace_email_variables(template_record.subject, booking_data);
        email_body := replace_email_variables(template_record.body, booking_data);
        
        INSERT INTO email_queue (
          booking_id,
          email_type,
          recipient_email,
          recipient_name,
          subject,
          body,
          scheduled_for,
          status
        ) VALUES (
          NEW.id,
          'pickup_reminder',
          NEW.client_email,
          NEW.client_name,
          email_subject,
          email_body,
          pickup_reminder_time,
          'pending'
        );
      END IF;
    END IF;
  END IF;

  -- Handle end datetime changes
  IF OLD.end_datetime IS DISTINCT FROM NEW.end_datetime THEN
    dropoff_reminder_time := NEW.end_datetime - INTERVAL '24 hours';
    
    -- Delete old dropoff reminder
    DELETE FROM email_queue
    WHERE booking_id = NEW.id
      AND email_type = 'dropoff_reminder'
      AND status = 'pending';
    
    -- Create new dropoff reminder if time is in future
    IF dropoff_reminder_time > NOW() THEN
      SELECT * INTO template_record
      FROM email_templates
      WHERE template_key = 'dropoff_reminder' AND is_active = true;
      
      IF FOUND THEN
        email_subject := replace_email_variables(template_record.subject, booking_data);
        email_body := replace_email_variables(template_record.body, booking_data);
        
        INSERT INTO email_queue (
          booking_id,
          email_type,
          recipient_email,
          recipient_name,
          subject,
          body,
          scheduled_for,
          status
        ) VALUES (
          NEW.id,
          'dropoff_reminder',
          NEW.client_email,
          NEW.client_name,
          email_subject,
          email_body,
          dropoff_reminder_time,
          'pending'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for booking updates
DROP TRIGGER IF EXISTS trigger_update_booking_emails ON bookings;
CREATE TRIGGER trigger_update_booking_emails
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_emails();
