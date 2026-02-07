/*
  # Enhance Notification System for Vehicle Alerts and Booking Assignments

  ## Overview
  This migration enhances the existing notification system to support:
  - Vehicle alerts (MOT expiry, insurance expiry, service due)
  - Booking assignments for chauffeurs
  - Priority levels for notifications
  - Metadata field for additional context

  ## Changes to notifications table
  1. Add new notification types to the CHECK constraint
  2. Add `priority` column for urgency levels (urgent, warning, info)
  3. Add `metadata` JSONB column for additional context
  4. Add indexes for efficient querying

  ## New Triggers
  - Trigger on bookings table to notify chauffeurs when assigned

  ## Security
  - Existing RLS policies remain in effect
  - New insert policy for system-generated notifications
*/

-- =============================================
-- 1. MODIFY NOTIFICATIONS TABLE
-- =============================================

-- Drop the existing type constraint to add new notification types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the new type constraint with extended notification types
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    -- Existing types
    'snag_assigned',
    'deadline_approaching',
    'snag_completed',
    'snag_overdue',
    'assignment_updated',
    -- New vehicle alert types
    'service_due',
    'mot_expiring',
    'insurance_expiring',
    'vehicle_grounded',
    -- Booking types
    'booking_assigned',
    'booking_updated',
    'booking_reminder'
  ));

-- Add priority column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'priority'
  ) THEN
    ALTER TABLE notifications ADD COLUMN priority text DEFAULT 'info' 
      CHECK (priority IN ('urgent', 'warning', 'info'));
  END IF;
END $$;

-- Add metadata column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE notifications ADD COLUMN metadata jsonb DEFAULT '{}';
  END IF;
END $$;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);

-- =============================================
-- 2. CREATE BOOKING ASSIGNMENT NOTIFICATION TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION notify_booking_chauffeur_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_vehicle_reg text;
  v_booking_ref text;
  v_client_name text;
  v_start_datetime timestamptz;
  v_chauffeur_user_id uuid;
BEGIN
  -- Only trigger when chauffeur_id is set or changed
  IF NEW.chauffeur_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Skip if chauffeur hasn't changed (on updates)
  IF TG_OP = 'UPDATE' AND OLD.chauffeur_id = NEW.chauffeur_id THEN
    RETURN NEW;
  END IF;

  -- Get booking and vehicle details
  SELECT v.reg_number INTO v_vehicle_reg
  FROM vehicles v
  WHERE v.id = NEW.vehicle_id;

  v_booking_ref := COALESCE(NEW.booking_reference, 'Booking');
  v_client_name := NEW.client_name;
  v_start_datetime := NEW.start_datetime;

  -- Find the user record for this chauffeur
  -- The chauffeur_id in bookings might be user id or we need to match by name
  -- First try direct ID match
  SELECT id INTO v_chauffeur_user_id
  FROM users
  WHERE id::text = NEW.chauffeur_id::text
  LIMIT 1;

  -- If no direct match, the chauffeur_id might be stored differently
  -- In this case, we skip notification (chauffeur not in users table)
  IF v_chauffeur_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Create notification for the chauffeur
  INSERT INTO notifications (user_id, type, title, message, link, priority, metadata)
  VALUES (
    v_chauffeur_user_id,
    'booking_assigned',
    'New Booking Assignment',
    'You have been assigned to ' || v_booking_ref || ' for ' || v_client_name || 
    ' (' || v_vehicle_reg || ') on ' || to_char(v_start_datetime, 'DD Mon YYYY'),
    '/bookings',
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

-- Create trigger for booking chauffeur assignment
DROP TRIGGER IF EXISTS on_booking_chauffeur_assigned ON bookings;
CREATE TRIGGER on_booking_chauffeur_assigned
  AFTER INSERT OR UPDATE OF chauffeur_id ON bookings
  FOR EACH ROW
  WHEN (NEW.chauffeur_id IS NOT NULL)
  EXECUTE FUNCTION notify_booking_chauffeur_assignment();

-- =============================================
-- 3. CREATE HELPER FUNCTION FOR VEHICLE ALERTS
-- =============================================

-- Function to create vehicle alert notifications for admin/manager users
CREATE OR REPLACE FUNCTION create_vehicle_alert_notification(
  p_vehicle_id uuid,
  p_notification_type text,
  p_title text,
  p_message text,
  p_priority text,
  p_metadata jsonb DEFAULT '{}'
) RETURNS void AS $$
DECLARE
  v_user_record RECORD;
  v_link text;
BEGIN
  -- Construct the link to vehicle details
  v_link := '/vehicles/' || p_vehicle_id;

  -- Create notification for all admin and manager users
  FOR v_user_record IN
    SELECT id FROM users
    WHERE role IN ('admin', 'manager')
    AND deleted_at IS NULL
  LOOP
    -- Check if a similar unread notification already exists (deduplication)
    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = v_user_record.id
      AND type = p_notification_type
      AND metadata->>'vehicle_id' = p_vehicle_id::text
      AND read = false
      AND created_at > NOW() - INTERVAL '24 hours'
    ) THEN
      INSERT INTO notifications (user_id, type, title, message, link, priority, metadata)
      VALUES (
        v_user_record.id,
        p_notification_type,
        p_title,
        p_message,
        v_link,
        p_priority,
        p_metadata || jsonb_build_object('vehicle_id', p_vehicle_id)
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 4. UPDATE RLS POLICIES FOR NEW NOTIFICATION TYPES
-- =============================================

-- Ensure insert policy allows system functions to create notifications
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow delete for user's own notifications (for cleanup)
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
