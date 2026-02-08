/*
  # Add Google Calendar Integration to Company Settings

  1. Modified Tables
    - `company_settings`
      - `google_client_id` (text, nullable) - Google OAuth app client ID
      - `google_client_secret` (text, nullable) - Google OAuth app client secret
      - `google_redirect_uri` (text, nullable) - OAuth redirect URI
      - `google_access_token` (text, nullable) - Company Google account access token
      - `google_refresh_token` (text, nullable) - Company Google account refresh token
      - `google_calendar_id` (text, nullable) - Target Google Calendar ID
      - `google_token_expiry` (timestamptz, nullable) - When access token expires
      - `google_sync_enabled` (boolean, default false) - Master on/off switch for auto-sync
      - `google_last_sync_at` (timestamptz, nullable) - Last successful sync timestamp

  2. Security
    - Recreated `company_settings_public` view to expose only non-sensitive Google fields
    - Sensitive fields (client_secret, access_token, refresh_token) are excluded from public view
    - Non-sensitive fields (sync_enabled, calendar_id, last_sync_at, client_id) are visible

  3. Notes
    - Moves Google Calendar config from per-user to company-wide
    - All booking sync operations will use these company-level credentials
    - Only admins can update via existing RLS policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'google_client_id'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN google_client_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'google_client_secret'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN google_client_secret text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'google_redirect_uri'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN google_redirect_uri text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'google_access_token'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN google_access_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'google_refresh_token'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN google_refresh_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'google_calendar_id'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN google_calendar_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'google_token_expiry'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN google_token_expiry timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'google_sync_enabled'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN google_sync_enabled boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'google_last_sync_at'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN google_last_sync_at timestamptz;
  END IF;
END $$;

DROP VIEW IF EXISTS company_settings_public;

CREATE VIEW company_settings_public
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
  google_client_id,
  google_calendar_id,
  google_sync_enabled,
  google_last_sync_at,
  google_redirect_uri,
  updated_at,
  updated_by
FROM company_settings;
