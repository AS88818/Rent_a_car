/*
  # Add Gmail Refresh Token to Company Settings

  Adds a dedicated gmail_refresh_token column for direct Gmail API sending,
  separate from the calendar google_refresh_token which may belong to a
  different Google account.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'gmail_refresh_token'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN gmail_refresh_token text;
  END IF;
END $$;
