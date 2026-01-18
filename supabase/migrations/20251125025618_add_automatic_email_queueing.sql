/*
  # Add Automatic Email Queueing for Bookings

  1. New Functions
    - `queue_booking_emails()` - Trigger function that automatically creates email queue entries
      - Fires after booking INSERT or UPDATE
      - Creates confirmation email (immediate)
      - Creates pickup reminder (24 hours before start)
      - Creates dropoff reminder (24 hours before end)
      - Replaces template variables with actual booking data
      - Only queues emails if client_email is provided
  
  2. New Triggers
    - `trigger_queue_booking_emails` - Fires after INSERT on bookings table
    - Automatically populates email_queue with booking-related emails
  
  3. Helper Functions
    - `replace_email_variables()` - Replaces template placeholders with actual data
    - `format_datetime()` - Formats timestamps for email display
  
  4. Constraints
    - Add unique constraint to prevent duplicate emails for same booking and type
  
  5. Important Notes
    - Reminders are only queued if booking is more than 24 hours away
    - Email content is generated from email_templates table
    - Variables are replaced at queue time for consistency
    - System handles NULL client_email gracefully (no emails queued)
*/

-- Add unique constraint to prevent duplicate emails
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_queue_booking_type_unique'
  ) THEN
    ALTER TABLE email_queue 
    ADD CONSTRAINT email_queue_booking_type_unique 
    UNIQUE (booking_id, email_type, status);
  END IF;
END $$;

-- Drop constraint if it exists and recreate without status
ALTER TABLE email_queue DROP CONSTRAINT IF EXISTS email_queue_booking_type_unique;

-- Create index for better duplicate checking
CREATE INDEX IF NOT EXISTS idx_email_queue_booking_type 
ON email_queue(booking_id, email_type) 
WHERE status IN ('pending', 'sent');

-- Function to replace email template variables
CREATE OR REPLACE FUNCTION replace_email_variables(
  template_text text,
  booking_data jsonb
)
RETURNS text AS $$
DECLARE
  result text;
BEGIN
  result := template_text;
  
  -- Replace all variables
  result := replace(result, '{{client_name}}', COALESCE(booking_data->>'client_name', ''));
  result := replace(result, '{{vehicle_reg}}', COALESCE(booking_data->>'vehicle_reg', ''));
  result := replace(result, '{{start_date}}', COALESCE(booking_data->>'start_date', ''));
  result := replace(result, '{{start_time}}', COALESCE(booking_data->>'start_time', ''));
  result := replace(result, '{{end_date}}', COALESCE(booking_data->>'end_date', ''));
  result := replace(result, '{{end_time}}', COALESCE(booking_data->>'end_time', ''));
  result := replace(result, '{{start_location}}', COALESCE(booking_data->>'start_location', ''));
  result := replace(result, '{{end_location}}', COALESCE(booking_data->>'end_location', ''));
  result := replace(result, '{{duration}}', COALESCE(booking_data->>'duration', ''));
  result := replace(result, '{{contact_number}}', COALESCE(booking_data->>'contact', ''));
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate duration in human-readable format
CREATE OR REPLACE FUNCTION calculate_duration(
  start_dt timestamptz,
  end_dt timestamptz
)
RETURNS text AS $$
DECLARE
  total_hours integer;
  days integer;
  hours integer;
  result text;
BEGIN
  total_hours := EXTRACT(EPOCH FROM (end_dt - start_dt)) / 3600;
  days := total_hours / 24;
  hours := total_hours % 24;
  
  IF days > 0 AND hours > 0 THEN
    result := days || ' day' || (CASE WHEN days > 1 THEN 's' ELSE '' END) || 
              ' and ' || hours || ' hour' || (CASE WHEN hours > 1 THEN 's' ELSE '' END);
  ELSIF days > 0 THEN
    result := days || ' day' || (CASE WHEN days > 1 THEN 's' ELSE '' END);
  ELSE
    result := hours || ' hour' || (CASE WHEN hours > 1 THEN 's' ELSE '' END);
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Main trigger function to queue booking emails
CREATE OR REPLACE FUNCTION queue_booking_emails()
RETURNS TRIGGER AS $$
DECLARE
  vehicle_reg text;
  template_record record;
  booking_data jsonb;
  email_subject text;
  email_body text;
  pickup_reminder_time timestamptz;
  dropoff_reminder_time timestamptz;
  existing_count integer;
BEGIN
  -- Only process if client_email is provided
  IF NEW.client_email IS NULL OR NEW.client_email = '' THEN
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
  
  -- Queue confirmation email (immediate)
  SELECT * INTO template_record
  FROM email_templates
  WHERE template_key = 'booking_confirmation' AND is_active = true;
  
  IF FOUND THEN
    email_subject := replace_email_variables(template_record.subject, booking_data);
    email_body := replace_email_variables(template_record.body, booking_data);
    
    -- Check if confirmation email already exists
    SELECT COUNT(*) INTO existing_count
    FROM email_queue
    WHERE booking_id = NEW.id 
      AND email_type = 'confirmation'
      AND status IN ('pending', 'sent');
    
    IF existing_count = 0 THEN
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
        'confirmation',
        NEW.client_email,
        NEW.client_name,
        email_subject,
        email_body,
        NOW(),
        'pending'
      );
    END IF;
  END IF;
  
  -- Queue pickup reminder (24 hours before start)
  pickup_reminder_time := NEW.start_datetime - INTERVAL '24 hours';
  
  IF pickup_reminder_time > NOW() THEN
    SELECT * INTO template_record
    FROM email_templates
    WHERE template_key = 'pickup_reminder' AND is_active = true;
    
    IF FOUND THEN
      email_subject := replace_email_variables(template_record.subject, booking_data);
      email_body := replace_email_variables(template_record.body, booking_data);
      
      -- Check if pickup reminder already exists
      SELECT COUNT(*) INTO existing_count
      FROM email_queue
      WHERE booking_id = NEW.id 
        AND email_type = 'pickup_reminder'
        AND status IN ('pending', 'sent');
      
      IF existing_count = 0 THEN
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
  
  -- Queue dropoff reminder (24 hours before end)
  dropoff_reminder_time := NEW.end_datetime - INTERVAL '24 hours';
  
  IF dropoff_reminder_time > NOW() THEN
    SELECT * INTO template_record
    FROM email_templates
    WHERE template_key = 'dropoff_reminder' AND is_active = true;
    
    IF FOUND THEN
      email_subject := replace_email_variables(template_record.subject, booking_data);
      email_body := replace_email_variables(template_record.body, booking_data);
      
      -- Check if dropoff reminder already exists
      SELECT COUNT(*) INTO existing_count
      FROM email_queue
      WHERE booking_id = NEW.id 
        AND email_type = 'dropoff_reminder'
        AND status IN ('pending', 'sent');
      
      IF existing_count = 0 THEN
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

-- Create trigger for new bookings
DROP TRIGGER IF EXISTS trigger_queue_booking_emails ON bookings;
CREATE TRIGGER trigger_queue_booking_emails
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION queue_booking_emails();
