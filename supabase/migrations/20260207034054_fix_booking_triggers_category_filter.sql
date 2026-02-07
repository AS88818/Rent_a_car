/*
  # Fix Booking Email Triggers with Category and Vehicle Filtering

  1. Changes
    - Rewrite `queue_booking_emails()` to only select templates where template_category = 'booking'
    - Add vehicle_ids filtering: templates with empty vehicle_ids apply to all vehicles,
      otherwise the booking's vehicle_id must be in the template's vehicle_ids array
    - Apply same filters to `update_booking_emails()` for datetime change re-queuing

  2. Why
    - Previously, the trigger queued ALL active/approved templates (including invoice_receipt
      and quote_submission) whenever a booking was created or updated
    - This caused incorrect emails to be queued (86 stale entries cleared in prior migration)
*/

CREATE OR REPLACE FUNCTION queue_booking_emails()
RETURNS trigger AS $$
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
  IF NEW.client_email IS NULL OR NEW.client_email = '' THEN
    RETURN NEW;
  END IF;

  SELECT v.reg_number, v.category_id, vc.category_name
  INTO vehicle_record
  FROM vehicles v
  LEFT JOIN vehicle_categories vc ON v.category_id = vc.id
  WHERE v.id = NEW.vehicle_id;

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

  FOR template_record IN
    SELECT * FROM email_templates
    WHERE is_active = true
      AND approval_status = 'approved'
      AND template_category = 'booking'
      AND (vehicle_ids = '{}' OR NEW.vehicle_id::text = ANY(vehicle_ids))
  LOOP
    interval_value := make_interval(
      mins => CASE WHEN template_record.schedule_unit = 'minutes' THEN template_record.schedule_value ELSE 0 END,
      hours => CASE WHEN template_record.schedule_unit = 'hours' THEN template_record.schedule_value ELSE 0 END,
      days => CASE WHEN template_record.schedule_unit = 'days' THEN template_record.schedule_value ELSE 0 END
    );

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

    IF scheduled_time < NOW() AND template_record.schedule_type != 'immediate' THEN
      CONTINUE;
    END IF;

    email_subject := replace_email_variables(template_record.subject, booking_data);
    email_body := replace_email_variables(template_record.body, booking_data);

    SELECT COUNT(*) INTO existing_count
    FROM email_queue
    WHERE booking_id = NEW.id
      AND email_type = template_record.template_key
      AND status IN ('pending', 'processing', 'sent');

    IF existing_count = 0 THEN
      INSERT INTO email_queue (
        booking_id, email_type, recipient_email, recipient_name,
        subject, body, scheduled_for, status
      ) VALUES (
        NEW.id, template_record.template_key, NEW.client_email, NEW.client_name,
        email_subject, email_body, scheduled_time, 'pending'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION update_booking_emails()
RETURNS trigger AS $$
DECLARE
  vehicle_record record;
  template_record record;
  booking_data jsonb;
  email_subject text;
  email_body text;
  scheduled_time timestamptz;
  interval_value interval;
BEGIN
  IF NEW.status = 'Cancelled' OR NEW.status = 'Completed' THEN
    UPDATE email_queue
    SET status = 'cancelled'
    WHERE booking_id = NEW.id
      AND status IN ('pending', 'processing');

    RETURN NEW;
  END IF;

  IF NEW.client_email IS NULL OR NEW.client_email = '' THEN
    DELETE FROM email_queue
    WHERE booking_id = NEW.id
      AND status = 'pending';

    RETURN NEW;
  END IF;

  SELECT v.reg_number, v.category_id, vc.category_name
  INTO vehicle_record
  FROM vehicles v
  LEFT JOIN vehicle_categories vc ON v.category_id = vc.id
  WHERE v.id = NEW.vehicle_id;

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

  IF OLD.client_email IS DISTINCT FROM NEW.client_email THEN
    UPDATE email_queue
    SET recipient_email = NEW.client_email
    WHERE booking_id = NEW.id
      AND status = 'pending';
  END IF;

  IF OLD.client_name IS DISTINCT FROM NEW.client_name THEN
    UPDATE email_queue
    SET recipient_name = NEW.client_name
    WHERE booking_id = NEW.id
      AND status = 'pending';
  END IF;

  IF OLD.start_datetime IS DISTINCT FROM NEW.start_datetime
    OR OLD.end_datetime IS DISTINCT FROM NEW.end_datetime
    OR OLD.vehicle_id IS DISTINCT FROM NEW.vehicle_id THEN

    DELETE FROM email_queue
    WHERE booking_id = NEW.id
      AND status = 'pending'
      AND email_type IN (
        SELECT template_key FROM email_templates
        WHERE schedule_type IN ('before_start', 'after_start', 'before_end', 'after_end')
          AND template_category = 'booking'
      );

    FOR template_record IN
      SELECT * FROM email_templates
      WHERE is_active = true
        AND approval_status = 'approved'
        AND template_category = 'booking'
        AND schedule_type IN ('before_start', 'after_start', 'before_end', 'after_end')
        AND (vehicle_ids = '{}' OR NEW.vehicle_id::text = ANY(vehicle_ids))
    LOOP
      interval_value := make_interval(
        mins => CASE WHEN template_record.schedule_unit = 'minutes' THEN template_record.schedule_value ELSE 0 END,
        hours => CASE WHEN template_record.schedule_unit = 'hours' THEN template_record.schedule_value ELSE 0 END,
        days => CASE WHEN template_record.schedule_unit = 'days' THEN template_record.schedule_value ELSE 0 END
      );

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

      IF scheduled_time < NOW() THEN
        CONTINUE;
      END IF;

      email_subject := replace_email_variables(template_record.subject, booking_data);
      email_body := replace_email_variables(template_record.body, booking_data);

      INSERT INTO email_queue (
        booking_id, email_type, recipient_email, recipient_name,
        subject, body, scheduled_for, status
      ) VALUES (
        NEW.id, template_record.template_key, NEW.client_email, NEW.client_name,
        email_subject, email_body, scheduled_time, 'pending'
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
