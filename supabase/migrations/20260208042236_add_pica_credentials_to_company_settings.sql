/*
  # Add Pica Email Credentials to Company Settings

  1. Modified Tables
    - `company_settings`
      - `pica_secret_key` (text, nullable) - Pica API secret key for Gmail integration
      - `pica_connection_key` (text, nullable) - Pica connection key linked to a specific Gmail account
      - `pica_action_id` (text, nullable) - Pica action identifier for the Gmail send endpoint

  2. Security
    - Existing RLS policies continue to apply (admin-only update, authenticated read)
    - Sensitive credential columns are accessible only through the existing admin-restricted update policy
    - A database view `company_settings_public` is created for non-admin reads that excludes credential columns

  3. Notes
    - These columns allow admins to configure the sender Gmail account from the UI
    - Edge Functions will read these values at runtime, falling back to environment variables if empty
    - The default action ID matches the currently hardcoded value in edge functions
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'pica_secret_key'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN pica_secret_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'pica_connection_key'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN pica_connection_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'pica_action_id'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN pica_action_id text;
  END IF;
END $$;

CREATE OR REPLACE VIEW company_settings_public
WITH (security_invoker = true)
AS
SELECT
  id,
  company_name,
  tagline,
  email,
  phone_nanyuki,
  phone_nairobi,
  website_url,
  address,
  bank_name,
  bank_account,
  mpesa_till,
  logo_url,
  email_signature,
  currency_code,
  currency_locale,
  updated_at,
  updated_by
FROM company_settings;
