/*
  # Update Email Queue Triggers to Use Template Schedules and Vehicle Filtering

  1. Changes
    - Modify queue_booking_emails() to read from template configuration
    - Filter templates by approval_status = 'approved'
    - Filter templates by vehicle category (null = all categories, or specific category)
    - Use schedule_type, schedule_value, schedule_unit from template
    - Calculate scheduled_for dynamically based on template config
  
  2. Schedule Types
    - immediate: Send right away (scheduled_for = NOW)
    - before_start: Send X units before start_datetime
    - after_start: Send X units after start_datetime
    - before_end: Send X units before end_datetime
    - after_end: Send X units after end_datetime
  
  3. Important Notes
    - Only approved templates are used
    - Templates with vehicle_category_id = NULL apply to all bookings
    - Templates with specific category only apply to matching bookings
    - Scheduled times in the past are skipped
    - Duplicate prevention still applies
*/

-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_queue_booking_emails ON bookings;

-- Recreate the queue_booking_emails function with new logic
CREATE OR REPLACE FUNCTION queue_booking_emails()
RETURNS TRIGGER AS $$
DECLARE
  vehicle_record record;
  template_record record;
  booking_data jsonb;
  email_subject text;
  email_body text;
  scheduled_time timestamptz;
  existing_count integer;
  interval_value interval;
BEGIN
  -- Only process if client_email is provided
  IF NEW.client_email IS NULL OR NEW.client_email = '' THEN
    RETURN NEW;
  END IF;
  
  -- Get vehicle details including category
  SELECT v.reg_number, v.category_id, vc.category_name
  INTO vehicle_record
  FROM vehicles v
  LEFT JOIN vehicle_categories vc ON v.category_id = vc.id
  WHERE v.id = NEW.vehicle_id;
  
  -- Prepare booking data for variable replacement
  booking_data := jsonb_build_object(
    'client_name', NEW.client_name,
    'vehicle_reg', COALESCE(vehicle_record.reg_number, 'N/A'),
    'start_date', TO_CHAR(NEW.start_datetime, 'DD Mon YYYY'),
    'start_time', TO_CHAR(NEW.start_datetime, 'HH24:MI'),
    'end_date', TO_CHAR(NEW.end_datetime, 'DD Mon YYYY'),
    'end_time', TO_CHAR(NEW.end_datetime, 'HH24:MI'),
    'start_location', NEW.start_location,
    'end_location', NEW.end_location,
    'duration', calculate_duration(NEW.start_datetime, NEW.end_datetime),
    'contact', NEW.contact
  );
  
  -- Loop through all approved and active templates
  FOR template_record IN
    SELECT * FROM email_templates
    WHERE is_active = true
      AND approval_status = 'approved'
      AND (vehicle_category_id IS NULL OR vehicle_category_id = vehicle_record.category_id)
  LOOP
    -- Calculate interval based on schedule_unit and schedule_value
    interval_value := make_interval(
      mins => CASE WHEN template_record.schedule_unit = 'minutes' THEN template_record.schedule_value ELSE 0 END,
      hours => CASE WHEN template_record.schedule_unit = 'hours' THEN template_record.schedule_value ELSE 0 END,
      days => CASE WHEN template_record.schedule_unit = 'days' THEN template_record.schedule_value ELSE 0 END
    );
    
    -- Calculate scheduled time based on schedule_type
    CASE template_record.schedule_type
      WHEN 'immediate' THEN
        scheduled_time := NOW();
      WHEN 'before_start' THEN
        scheduled_time := NEW.start_datetime - interval_value;
      WHEN 'after_start' THEN
        scheduled_time := NEW.start_datetime + interval_value;
      WHEN 'before_end' THEN
        scheduled_time := NEW.end_datetime - interval_value;
      WHEN 'after_end' THEN
        scheduled_time := NEW.end_datetime + interval_value;
      ELSE
        scheduled_time := NOW();
    END CASE;
    
    -- Skip if scheduled time is in the past (except for immediate)
    IF scheduled_time < NOW() AND template_record.schedule_type != 'immediate' THEN
      CONTINUE;
    END IF;
    
    -- Replace variables in subject and body
    email_subject := replace_email_variables(template_record.subject, booking_data);
    email_body := replace_email_variables(template_record.body, booking_data);
    
    -- Check if email already exists for this booking and template
    SELECT COUNT(*) INTO existing_count
    FROM email_queue
    WHERE booking_id = NEW.id 
      AND email_type = template_record.template_key
      AND status IN ('pending', 'sent');
    
    -- Queue email if it doesn't already exist
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
        template_record.template_key,
        NEW.client_email,
        NEW.client_name,
        email_subject,
        email_body,
        scheduled_time,
        'pending'
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER trigger_queue_booking_emails
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION queue_booking_emails();

-- Update the update_booking_emails function similarly
DROP TRIGGER IF EXISTS trigger_update_booking_emails ON bookings;

CREATE OR REPLACE FUNCTION update_booking_emails()
RETURNS TRIGGER AS $$
DECLARE
  vehicle_record record;
  template_record record;
  booking_data jsonb;
  email_subject text;
  email_body text;
  scheduled_time timestamptz;
  interval_value interval;
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

  -- Get vehicle details including category
  SELECT v.reg_number, v.category_id, vc.category_name
  INTO vehicle_record
  FROM vehicles v
  LEFT JOIN vehicle_categories vc ON v.category_id = vc.id
  WHERE v.id = NEW.vehicle_id;

  -- Prepare booking data for variable replacement
  booking_data := jsonb_build_object(
    'client_name', NEW.client_name,
    'vehicle_reg', COALESCE(vehicle_record.reg_number, 'N/A'),
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

  -- Handle datetime changes - recreate affected emails
  IF OLD.start_datetime IS DISTINCT FROM NEW.start_datetime 
     OR OLD.end_datetime IS DISTINCT FROM NEW.end_datetime 
     OR OLD.vehicle_id IS DISTINCT FROM NEW.vehicle_id THEN
    
    -- Delete all pending emails that are time-sensitive
    DELETE FROM email_queue
    WHERE booking_id = NEW.id
      AND status = 'pending'
      AND email_type IN (
        SELECT template_key FROM email_templates 
        WHERE schedule_type IN ('before_start', 'after_start', 'before_end', 'after_end')
      );
    
    -- Recreate emails based on current templates
    FOR template_record IN
      SELECT * FROM email_templates
      WHERE is_active = true
        AND approval_status = 'approved'
        AND schedule_type IN ('before_start', 'after_start', 'before_end', 'after_end')
        AND (vehicle_category_id IS NULL OR vehicle_category_id = vehicle_record.category_id)
    LOOP
      -- Calculate interval
      interval_value := make_interval(
        mins => CASE WHEN template_record.schedule_unit = 'minutes' THEN template_record.schedule_value ELSE 0 END,
        hours => CASE WHEN template_record.schedule_unit = 'hours' THEN template_record.schedule_value ELSE 0 END,
        days => CASE WHEN template_record.schedule_unit = 'days' THEN template_record.schedule_value ELSE 0 END
      );
      
      -- Calculate scheduled time
      CASE template_record.schedule_type
        WHEN 'before_start' THEN
          scheduled_time := NEW.start_datetime - interval_value;
        WHEN 'after_start' THEN
          scheduled_time := NEW.start_datetime + interval_value;
        WHEN 'before_end' THEN
          scheduled_time := NEW.end_datetime - interval_value;
        WHEN 'after_end' THEN
          scheduled_time := NEW.end_datetime + interval_value;
        ELSE
          CONTINUE;
      END CASE;
      
      -- Skip if in the past
      IF scheduled_time < NOW() THEN
        CONTINUE;
      END IF;
      
      -- Replace variables
      email_subject := replace_email_variables(template_record.subject, booking_data);
      email_body := replace_email_variables(template_record.body, booking_data);
      
      -- Insert new email
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
        template_record.template_key,
        NEW.client_email,
        NEW.client_name,
        email_subject,
        email_body,
        scheduled_time,
        'pending'
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER trigger_update_booking_emails
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_emails();
