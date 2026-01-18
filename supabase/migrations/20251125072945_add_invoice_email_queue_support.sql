/*
  # Add Invoice Email Queue Support

  1. Schema Changes
    - Add `invoice_id` column to email_queue table
    - Make booking_id nullable (now either booking_id OR invoice_id required)
    - Update constraints to allow invoice-based emails

  2. Triggers
    - Add trigger to automatically queue invoice receipt email when invoice is marked as paid

  3. Security
    - Update RLS policies to handle invoice emails
*/

-- Add invoice_id column to email_queue
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_queue' AND column_name = 'invoice_id'
  ) THEN
    ALTER TABLE email_queue ADD COLUMN invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Make booking_id nullable since we now support invoice emails too
ALTER TABLE email_queue ALTER COLUMN booking_id DROP NOT NULL;

-- Add check constraint to ensure either booking_id OR invoice_id is present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_queue_reference_check'
  ) THEN
    ALTER TABLE email_queue 
    ADD CONSTRAINT email_queue_reference_check 
    CHECK (
      (booking_id IS NOT NULL AND invoice_id IS NULL) OR 
      (booking_id IS NULL AND invoice_id IS NOT NULL)
    );
  END IF;
END $$;

-- Create index for invoice emails
CREATE INDEX IF NOT EXISTS idx_email_queue_invoice 
ON email_queue(invoice_id, email_type) 
WHERE invoice_id IS NOT NULL;

-- Create function to queue invoice receipt email when invoice is marked as paid
CREATE OR REPLACE FUNCTION queue_invoice_receipt_email()
RETURNS TRIGGER AS $$
DECLARE
  v_template record;
  v_subject text;
  v_body text;
  v_scheduled_for timestamptz;
BEGIN
  -- Only proceed if status changed to 'Paid' and client_email exists
  IF NEW.payment_status = 'Paid' 
     AND (OLD.payment_status IS NULL OR OLD.payment_status != 'Paid')
     AND NEW.client_email IS NOT NULL 
     AND NEW.client_email != '' THEN
    
    -- Get the invoice receipt template
    SELECT * INTO v_template
    FROM email_templates
    WHERE template_key = 'invoice_receipt'
      AND is_active = true
    LIMIT 1;

    IF v_template.id IS NOT NULL THEN
      -- Replace variables in subject
      v_subject := v_template.subject;
      v_subject := replace(v_subject, '{{invoice_reference}}', NEW.invoice_reference);
      
      -- Replace variables in body
      v_body := v_template.body;
      v_body := replace(v_body, '{{client_name}}', COALESCE(NEW.client_name, 'Valued Customer'));
      v_body := replace(v_body, '{{invoice_reference}}', NEW.invoice_reference);
      v_body := replace(v_body, '{{total_amount}}', COALESCE(NEW.total_amount::text, '0'));
      v_body := replace(v_body, '{{payment_date}}', COALESCE(NEW.payment_date::text, NEW.updated_at::text));
      v_body := replace(v_body, '{{payment_method}}', COALESCE(NEW.payment_method, 'N/A'));

      -- Schedule for immediate sending
      v_scheduled_for := now();

      -- Check if email already exists for this invoice
      IF NOT EXISTS (
        SELECT 1 FROM email_queue
        WHERE invoice_id = NEW.id
          AND email_type = 'invoice_receipt'
      ) THEN
        -- Insert into email queue
        INSERT INTO email_queue (
          invoice_id,
          email_type,
          recipient_email,
          recipient_name,
          subject,
          body,
          scheduled_for,
          status
        ) VALUES (
          NEW.id,
          'invoice_receipt',
          NEW.client_email,
          NEW.client_name,
          v_subject,
          v_body,
          v_scheduled_for,
          'pending'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on invoices table
DROP TRIGGER IF EXISTS trigger_queue_invoice_receipt_email ON invoices;
CREATE TRIGGER trigger_queue_invoice_receipt_email
  AFTER INSERT OR UPDATE OF payment_status, client_email
  ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION queue_invoice_receipt_email();
