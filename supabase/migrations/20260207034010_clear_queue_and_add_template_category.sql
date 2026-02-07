/*
  # Clear Email Queue and Add Template Category

  1. Changes
    - Delete all existing email_queue entries (stale data from broken trigger)
    - Add `template_category` column to `email_templates` with values: booking, invoice, quote
    - Set correct category for each existing template based on template_key
    - Add CHECK constraint to enforce valid category values
    - Add `processing` to email_queue status values

  2. Template Category Assignments
    - booking_confirmation, pickup_reminder, dropoff_reminder, feedback_request -> 'booking'
    - invoice_receipt -> 'invoice'
    - quote_submission -> 'quote'

  3. Email Queue Status
    - Add 'processing' status for concurrency protection during send attempts
*/

-- Clear all stale email queue entries
DELETE FROM email_queue;

-- Add template_category column to email_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_templates' AND column_name = 'template_category'
  ) THEN
    ALTER TABLE email_templates ADD COLUMN template_category text NOT NULL DEFAULT 'booking';
  END IF;
END $$;

-- Set correct categories for existing templates
UPDATE email_templates SET template_category = 'booking'
WHERE template_key IN ('booking_confirmation', 'pickup_reminder', 'dropoff_reminder', 'feedback_request');

UPDATE email_templates SET template_category = 'invoice'
WHERE template_key = 'invoice_receipt';

UPDATE email_templates SET template_category = 'quote'
WHERE template_key = 'quote_submission';

-- Add CHECK constraint for valid category values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_templates_template_category_check'
  ) THEN
    ALTER TABLE email_templates ADD CONSTRAINT email_templates_template_category_check
      CHECK (template_category IN ('booking', 'invoice', 'quote'));
  END IF;
END $$;

-- Add index on template_category for filtering performance
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(template_category);

-- Add CHECK constraint for email_queue status including 'processing'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_queue_status_check'
  ) THEN
    ALTER TABLE email_queue DROP CONSTRAINT email_queue_status_check;
  END IF;
  
  ALTER TABLE email_queue ADD CONSTRAINT email_queue_status_check
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled'));
END $$;
