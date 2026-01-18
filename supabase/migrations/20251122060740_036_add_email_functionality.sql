/*
  # Add Email Functionality

  1. Changes to Existing Tables
    - Add `client_email` column to bookings table for storing client email addresses
  
  2. New Tables
    - `email_templates`
      - `id` (uuid, primary key)
      - `template_key` (text, unique) - unique identifier for the template type
      - `template_name` (text) - friendly name for the template
      - `subject` (text) - email subject line with variable placeholders
      - `body` (text) - email body content with variable placeholders
      - `available_variables` (text[]) - list of available variables for this template
      - `is_active` (boolean) - whether this template is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `email_queue`
      - `id` (uuid, primary key)
      - `booking_id` (uuid, references bookings)
      - `email_type` (text) - type of email: 'confirmation', 'pickup_reminder', 'dropoff_reminder'
      - `recipient_email` (text)
      - `recipient_name` (text)
      - `subject` (text)
      - `body` (text)
      - `status` (text) - 'pending', 'sent', 'failed'
      - `scheduled_for` (timestamptz) - when to send the email
      - `sent_at` (timestamptz) - when the email was actually sent
      - `error_message` (text) - error details if failed
      - `attempts` (integer) - number of send attempts
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  3. Security
    - Enable RLS on new tables
    - Add appropriate policies for authenticated users
*/

-- Add email column to bookings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'client_email'
  ) THEN
    ALTER TABLE bookings ADD COLUMN client_email text;
  END IF;
END $$;

-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text UNIQUE NOT NULL,
  template_name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  available_variables text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read email templates"
  ON email_templates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and manager users can insert email templates"
  ON email_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role')::text IN ('admin', 'manager')
  );

CREATE POLICY "Admin and manager users can update email templates"
  ON email_templates
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'role')::text IN ('admin', 'manager')
  )
  WITH CHECK (
    (auth.jwt()->>'role')::text IN ('admin', 'manager')
  );

CREATE POLICY "Admin users can delete email templates"
  ON email_templates
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt()->>'role')::text = 'admin'
  );

-- Create email_queue table
CREATE TABLE IF NOT EXISTS email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  email_type text NOT NULL,
  recipient_email text NOT NULL,
  recipient_name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text DEFAULT 'pending',
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  error_message text,
  attempts integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read email queue"
  ON email_queue
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and manager users can manage email queue"
  ON email_queue
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt()->>'role')::text IN ('admin', 'manager')
  )
  WITH CHECK (
    (auth.jwt()->>'role')::text IN ('admin', 'manager')
  );

-- Insert default email templates
INSERT INTO email_templates (template_key, template_name, subject, body, available_variables, is_active)
VALUES
  (
    'booking_confirmation',
    'Booking Confirmation',
    'Booking Confirmation - {{vehicle_reg}} from {{start_date}}',
    E'Dear {{client_name}},\n\nThank you for your booking!\n\nBooking Details:\n- Vehicle: {{vehicle_reg}}\n- Pick-up: {{start_date}} at {{start_time}} from {{start_location}}\n- Drop-off: {{end_date}} at {{end_time}} at {{end_location}}\n- Duration: {{duration}}\n\nContact: {{contact_number}}\n\nWe look forward to serving you!\n\nBest regards,\nFleetHub Team',
    ARRAY['client_name', 'vehicle_reg', 'start_date', 'start_time', 'end_date', 'end_time', 'start_location', 'end_location', 'duration', 'contact_number'],
    true
  ),
  (
    'pickup_reminder',
    'Pick-up Reminder',
    'Reminder: Vehicle Pick-up Tomorrow - {{vehicle_reg}}',
    E'Dear {{client_name}},\n\nThis is a reminder that your vehicle pick-up is scheduled for tomorrow.\n\nBooking Details:\n- Vehicle: {{vehicle_reg}}\n- Pick-up: {{start_date}} at {{start_time}} from {{start_location}}\n- Drop-off: {{end_date}} at {{end_time}} at {{end_location}}\n\nPlease ensure you bring:\n- Valid driver\'s license\n- Identification\n- Payment method\n\nIf you need to make any changes, please contact us immediately.\n\nBest regards,\nFleetHub Team',
    ARRAY['client_name', 'vehicle_reg', 'start_date', 'start_time', 'end_date', 'end_time', 'start_location', 'end_location'],
    true
  ),
  (
    'dropoff_reminder',
    'Drop-off Reminder',
    'Reminder: Vehicle Drop-off Tomorrow - {{vehicle_reg}}',
    E'Dear {{client_name}},\n\nThis is a reminder that your vehicle drop-off is scheduled for tomorrow.\n\nBooking Details:\n- Vehicle: {{vehicle_reg}}\n- Drop-off: {{end_date}} at {{end_time}} at {{end_location}}\n\nPlease ensure:\n- The vehicle is returned with a full tank (or as agreed)\n- All belongings are removed from the vehicle\n- The vehicle is in the same condition as received\n\nThank you for choosing FleetHub!\n\nBest regards,\nFleetHub Team',
    ARRAY['client_name', 'vehicle_reg', 'end_date', 'end_time', 'end_location'],
    true
  )
ON CONFLICT (template_key) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_email_templates_updated_at ON email_templates;
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_queue_updated_at ON email_queue;
CREATE TRIGGER update_email_queue_updated_at
  BEFORE UPDATE ON email_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
