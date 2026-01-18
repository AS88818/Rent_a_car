/*
  # Create Pricing Config Table for Global Settings

  1. New Table
    - `pricing_config` - Stores global pricing configuration
      - `id` (uuid, primary key)
      - `chauffeur_fee_per_day` (numeric) - Daily chauffeur fee
      - `vat_percentage` (numeric) - VAT rate (default 16%)
      - `updated_at` (timestamp)
      - `updated_by` (uuid, references users)

  2. Security
    - Enable RLS
    - Only authenticated users can read
    - Only admin users can update

  3. Default Data
    - Insert default configuration values
*/

-- Create pricing_config table
CREATE TABLE IF NOT EXISTS pricing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chauffeur_fee_per_day numeric NOT NULL DEFAULT 4000,
  vat_percentage numeric NOT NULL DEFAULT 0.16,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE pricing_config ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read pricing config
CREATE POLICY "Authenticated users can read pricing config"
  ON pricing_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admin users can update pricing config
CREATE POLICY "Admin users can update pricing config"
  ON pricing_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Insert default configuration (only if table is empty)
INSERT INTO pricing_config (chauffeur_fee_per_day, vat_percentage)
SELECT 4000, 0.16
WHERE NOT EXISTS (SELECT 1 FROM pricing_config);

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_pricing_config_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

-- Create trigger to auto-update timestamp
DROP TRIGGER IF EXISTS pricing_config_updated_at ON pricing_config;

CREATE TRIGGER pricing_config_updated_at
BEFORE UPDATE ON pricing_config
FOR EACH ROW
EXECUTE FUNCTION update_pricing_config_timestamp();
