/*
  # Enhance Email Templates with Scheduling, Vehicle Categories, and Approval Workflow

  1. New Columns in email_templates
    - schedule_type (enum) - when to send: immediate, before_start, after_start, before_end, after_end
    - schedule_value (integer) - how many units (e.g., 24, 2, 48)
    - schedule_unit (enum) - time unit: minutes, hours, days
    - vehicle_category_id (uuid, nullable) - links template to specific category
    - is_system_template (boolean) - protects default templates from deletion
    - approval_status (enum) - draft, pending, approved, rejected
    - created_by (uuid) - tracks who created the template
    - approved_by (uuid, nullable) - tracks who approved
    - approved_at (timestamptz, nullable) - when approved
    - rejection_reason (text, nullable) - why rejected
    - created_at (timestamptz) - when created
    - updated_at (timestamptz) - last modified
  
  2. Indexes
    - Index on vehicle_category_id for efficient filtering
    - Index on approval_status for querying approved templates
    - Index on created_by for user's templates
  
  3. Migration Strategy
    - Add new columns with defaults for existing records
    - Mark existing templates as system templates and approved
    - Set default schedule values for existing templates
    - Add foreign key constraints
  
  4. Important Notes
    - Existing templates are marked as system templates
    - System templates cannot be deleted
    - All new custom templates start as 'draft' status
    - Only approved templates are used for sending emails
*/

-- Create enum types for scheduling
DO $$ BEGIN
  CREATE TYPE schedule_type AS ENUM ('immediate', 'before_start', 'after_start', 'before_end', 'after_end');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE schedule_unit AS ENUM ('minutes', 'hours', 'days');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE template_approval_status AS ENUM ('draft', 'pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new columns to email_templates
ALTER TABLE email_templates 
  ADD COLUMN IF NOT EXISTS schedule_type schedule_type DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS schedule_value integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS schedule_unit schedule_unit DEFAULT 'hours',
  ADD COLUMN IF NOT EXISTS vehicle_category_id uuid,
  ADD COLUMN IF NOT EXISTS is_system_template boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_status template_approval_status DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add foreign key for vehicle_category_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_templates_vehicle_category_id_fkey'
  ) THEN
    ALTER TABLE email_templates 
    ADD CONSTRAINT email_templates_vehicle_category_id_fkey 
    FOREIGN KEY (vehicle_category_id) 
    REFERENCES vehicle_categories(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key for created_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_templates_created_by_fkey'
  ) THEN
    ALTER TABLE email_templates 
    ADD CONSTRAINT email_templates_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key for approved_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_templates_approved_by_fkey'
  ) THEN
    ALTER TABLE email_templates 
    ADD CONSTRAINT email_templates_approved_by_fkey 
    FOREIGN KEY (approved_by) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_templates_vehicle_category 
  ON email_templates(vehicle_category_id);

CREATE INDEX IF NOT EXISTS idx_email_templates_approval_status 
  ON email_templates(approval_status);

CREATE INDEX IF NOT EXISTS idx_email_templates_created_by 
  ON email_templates(created_by);

CREATE INDEX IF NOT EXISTS idx_email_templates_is_system 
  ON email_templates(is_system_template);

-- Update existing templates to be system templates with proper schedule settings
UPDATE email_templates
SET 
  is_system_template = true,
  approval_status = 'approved'::template_approval_status,
  schedule_type = CASE 
    WHEN template_key = 'booking_confirmation' THEN 'immediate'::schedule_type
    WHEN template_key = 'pickup_reminder' THEN 'before_start'::schedule_type
    WHEN template_key = 'dropoff_reminder' THEN 'before_end'::schedule_type
    ELSE 'immediate'::schedule_type
  END,
  schedule_value = CASE 
    WHEN template_key = 'booking_confirmation' THEN 0
    WHEN template_key = 'pickup_reminder' THEN 24
    WHEN template_key = 'dropoff_reminder' THEN 24
    ELSE 0
  END,
  schedule_unit = 'hours'::schedule_unit,
  approved_at = now()
WHERE template_key IN ('booking_confirmation', 'pickup_reminder', 'dropoff_reminder');

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_email_template_timestamp ON email_templates;
CREATE TRIGGER trigger_update_email_template_timestamp
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_template_updated_at();

-- Add RLS policies for email_templates
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can view approved templates
DROP POLICY IF EXISTS "Users can view approved templates" ON email_templates;
CREATE POLICY "Users can view approved templates"
  ON email_templates
  FOR SELECT
  TO authenticated
  USING (approval_status = 'approved' OR created_by = auth.uid());

-- Policy: Users can view their own drafts
DROP POLICY IF EXISTS "Users can view own drafts" ON email_templates;
CREATE POLICY "Users can view own drafts"
  ON email_templates
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Policy: Users can create templates
DROP POLICY IF EXISTS "Users can create templates" ON email_templates;
CREATE POLICY "Users can create templates"
  ON email_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid() AND approval_status = 'draft');

-- Policy: Users can update their own draft or rejected templates
DROP POLICY IF EXISTS "Users can update own draft templates" ON email_templates;
CREATE POLICY "Users can update own draft templates"
  ON email_templates
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() AND approval_status IN ('draft', 'rejected'))
  WITH CHECK (created_by = auth.uid());

-- Policy: Admins can update any template
DROP POLICY IF EXISTS "Admins can update any template" ON email_templates;
CREATE POLICY "Admins can update any template"
  ON email_templates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Policy: Users can delete their own custom templates (not system templates)
DROP POLICY IF EXISTS "Users can delete own custom templates" ON email_templates;
CREATE POLICY "Users can delete own custom templates"
  ON email_templates
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() 
    AND is_system_template = false
  );

-- Policy: Admins can delete any custom template
DROP POLICY IF EXISTS "Admins can delete custom templates" ON email_templates;
CREATE POLICY "Admins can delete custom templates"
  ON email_templates
  FOR DELETE
  TO authenticated
  USING (
    is_system_template = false
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );
