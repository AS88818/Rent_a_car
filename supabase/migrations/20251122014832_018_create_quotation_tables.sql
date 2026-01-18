/*
  # Create Quotation Calculator Tables

  1. New Tables
    - `category_pricing`
      - Stores pricing rules for each vehicle category
      - Includes tier-based discounts and peak/off-peak rates
    - `season_rules`
      - Defines peak and off-peak seasons
      - Uses MM-DD format for recurring annual seasons
    - `quotes`
      - Stores saved quotations for future reference
  
  2. Security
    - Enable RLS on all tables
    - Allow authenticated users to read pricing and season rules
    - Allow authenticated users to create and manage quotes
*/

-- Category Pricing Table
CREATE TABLE IF NOT EXISTS category_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text UNIQUE NOT NULL,
  off_peak_rate numeric NOT NULL DEFAULT 0,
  peak_rate numeric NOT NULL DEFAULT 0,
  self_drive_deposit numeric NOT NULL DEFAULT 0,
  tier1_days int NOT NULL DEFAULT 3,
  tier1_discount numeric NOT NULL DEFAULT 0,
  tier2_days int NOT NULL DEFAULT 7,
  tier2_discount numeric NOT NULL DEFAULT 0,
  tier3_days int NOT NULL DEFAULT 12,
  tier3_discount numeric NOT NULL DEFAULT 0,
  tier4_days int NOT NULL DEFAULT 18,
  tier4_discount numeric NOT NULL DEFAULT 0,
  tier5_days int NOT NULL DEFAULT 25,
  tier5_discount numeric NOT NULL DEFAULT 0,
  tier6_days int NOT NULL DEFAULT 30,
  tier6_discount numeric NOT NULL DEFAULT 0,
  tier7_days int NOT NULL DEFAULT 90,
  tier7_discount numeric NOT NULL DEFAULT 0,
  tier8_days int NOT NULL DEFAULT 180,
  tier8_discount numeric NOT NULL DEFAULT 0,
  tier9_days int NOT NULL DEFAULT 365,
  tier9_discount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Season Rules Table
CREATE TABLE IF NOT EXISTS season_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_name text NOT NULL,
  date_start text NOT NULL,
  date_end text NOT NULL,
  season_type text NOT NULL CHECK (season_type IN ('Peak', 'Off Peak')),
  created_at timestamptz DEFAULT now()
);

-- Quotes Table
CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  client_name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  has_chauffeur boolean NOT NULL DEFAULT false,
  has_half_day boolean NOT NULL DEFAULT false,
  other_fee_1_desc text,
  other_fee_1_amount numeric DEFAULT 0,
  other_fee_2_desc text,
  other_fee_2_amount numeric DEFAULT 0,
  quote_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE category_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view category pricing"
  ON category_pricing FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update category pricing"
  ON category_pricing FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view season rules"
  ON season_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view all quotes"
  ON quotes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create quotes"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update quotes"
  ON quotes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete quotes"
  ON quotes FOR DELETE
  TO authenticated
  USING (true);

-- Seed Season Rules
INSERT INTO season_rules (season_name, date_start, date_end, season_type) VALUES
  ('Off Peak Spring', '04-06', '05-31', 'Off Peak'),
  ('Off Peak Fall', '10-01', '12-04', 'Off Peak'),
  ('Peak Winter/Spring', '01-01', '04-05', 'Peak'),
  ('Peak Summer', '06-01', '09-30', 'Peak'),
  ('Peak Holiday', '12-05', '12-31', 'Peak')
ON CONFLICT DO NOTHING;

-- Seed Category Pricing (example data - adjust as needed)
INSERT INTO category_pricing (
  category_name, off_peak_rate, peak_rate, self_drive_deposit,
  tier1_days, tier1_discount,
  tier2_days, tier2_discount,
  tier3_days, tier3_discount,
  tier4_days, tier4_discount,
  tier5_days, tier5_discount,
  tier6_days, tier6_discount,
  tier7_days, tier7_discount,
  tier8_days, tier8_discount,
  tier9_days, tier9_discount
) VALUES
  ('Compact', 5000, 6000, 50000, 3, 0, 7, 0.05, 12, 0.10, 18, 0.15, 25, 0.20, 30, 0.25, 90, 0.30, 180, 0.35, 365, 0.40),
  ('Sedan', 7000, 8500, 70000, 3, 0, 7, 0.05, 12, 0.10, 18, 0.15, 25, 0.20, 30, 0.25, 90, 0.30, 180, 0.35, 365, 0.40),
  ('SUV', 10000, 12000, 100000, 3, 0, 7, 0.05, 12, 0.10, 18, 0.15, 25, 0.20, 30, 0.25, 90, 0.30, 180, 0.35, 365, 0.40),
  ('Luxury', 15000, 18000, 150000, 3, 0, 7, 0.05, 12, 0.10, 18, 0.15, 25, 0.20, 30, 0.25, 90, 0.30, 180, 0.35, 365, 0.40),
  ('Van', 12000, 14000, 120000, 3, 0, 7, 0.05, 12, 0.10, 18, 0.15, 25, 0.20, 30, 0.25, 90, 0.30, 180, 0.35, 365, 0.40)
ON CONFLICT (category_name) DO NOTHING;