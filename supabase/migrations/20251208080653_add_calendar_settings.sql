/*
  # Add Calendar Settings Table

  1. New Tables
    - `user_calendar_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `google_access_token` (text, encrypted)
      - `google_refresh_token` (text, encrypted)
      - `google_calendar_id` (text)
      - `token_expiry` (timestamptz)
      - `sync_enabled` (boolean)
      - `last_sync_at` (timestamptz)
      - `calendar_preferences` (jsonb) - stores user preferences like selected categories, default view
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `user_calendar_settings` table
    - Add policy for users to manage their own calendar settings
*/

CREATE TABLE IF NOT EXISTS user_calendar_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  google_access_token text,
  google_refresh_token text,
  google_calendar_id text,
  token_expiry timestamptz,
  sync_enabled boolean DEFAULT false,
  last_sync_at timestamptz,
  calendar_preferences jsonb DEFAULT '{
    "selectedCategories": [],
    "defaultView": "month",
    "showWeekends": true,
    "startOfWeek": 0
  }'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_calendar_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calendar settings"
  ON user_calendar_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar settings"
  ON user_calendar_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar settings"
  ON user_calendar_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar settings"
  ON user_calendar_settings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_user_calendar_settings_user_id
  ON user_calendar_settings(user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_user_calendar_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_calendar_settings_updated_at
  BEFORE UPDATE ON user_calendar_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_calendar_settings_updated_at();