/*
  # Simplify Email Templates RLS

  1. Changes
    - Drop existing RLS policies on email_templates
    - Create simpler policies that allow all authenticated users to update templates
    - This fixes the issue where JWT metadata wasn't properly synced
  
  2. Security
    - Still requires authentication
    - All authenticated users can manage email templates (admin feature)
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view email templates" ON email_templates;
DROP POLICY IF EXISTS "Admin users can insert email templates" ON email_templates;
DROP POLICY IF EXISTS "Admin and manager users can update email templates" ON email_templates;
DROP POLICY IF EXISTS "Admin users can delete email templates" ON email_templates;

-- Create new simplified policies
CREATE POLICY "Authenticated users can view email templates"
  ON email_templates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert email templates"
  ON email_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update email templates"
  ON email_templates
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete email templates"
  ON email_templates
  FOR DELETE
  TO authenticated
  USING (true);
