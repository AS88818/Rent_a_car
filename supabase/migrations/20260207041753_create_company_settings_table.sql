/*
  # Create Company Settings Table

  1. New Tables
    - `company_settings` (singleton row pattern)
      - `id` (uuid, primary key)
      - `company_name` (text) - Main company name
      - `tagline` (text) - Company tagline/subtitle
      - `email` (text) - Company contact email
      - `phone_nanyuki` (text) - Nanyuki branch phone
      - `phone_nairobi` (text) - Nairobi branch phone
      - `website_url` (text) - Company website
      - `address` (text) - Company physical address
      - `bank_name` (text) - Bank for payment info
      - `bank_account` (text) - Bank account number
      - `mpesa_till` (text) - M-Pesa till number
      - `logo_url` (text) - URL/path to company logo
      - `email_signature` (text) - Shared email signature block
      - `currency_code` (text) - Currency code (e.g. KES)
      - `currency_locale` (text) - Locale for formatting (e.g. en-KE)
      - `updated_at` (timestamptz)
      - `updated_by` (uuid)

  2. Security
    - Enable RLS
    - All authenticated users can read settings
    - Only admins can update settings

  3. Seed Data
    - Insert current hard-coded values as default settings
*/

CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'Rent A Car In Kenya',
  tagline text NOT NULL DEFAULT 'Premium Vehicle Rentals',
  email text NOT NULL DEFAULT 'info@rentacarinkenya.com',
  phone_nanyuki text NOT NULL DEFAULT '+254722513739',
  phone_nairobi text NOT NULL DEFAULT '+254721177642',
  website_url text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  bank_name text NOT NULL DEFAULT 'Example Bank Kenya',
  bank_account text NOT NULL DEFAULT '1234567890',
  mpesa_till text NOT NULL DEFAULT '123456',
  logo_url text NOT NULL DEFAULT '/rent-a-car-in-kenya-logo-hd2-135x134.png',
  email_signature text NOT NULL DEFAULT '',
  currency_code text NOT NULL DEFAULT 'KES',
  currency_locale text NOT NULL DEFAULT 'en-KE',
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view company settings"
  ON company_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can update company settings"
  ON company_settings
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT (auth.jwt()->'app_metadata'->>'role')::text) = 'admin'
  )
  WITH CHECK (
    (SELECT (auth.jwt()->'app_metadata'->>'role')::text) = 'admin'
  );

INSERT INTO company_settings (
  company_name,
  tagline,
  email,
  phone_nanyuki,
  phone_nairobi,
  bank_name,
  bank_account,
  mpesa_till,
  logo_url,
  email_signature,
  currency_code,
  currency_locale
) VALUES (
  'Rent A Car In Kenya',
  'Premium Vehicle Rentals',
  'info@rentacarinkenya.com',
  '+254722513739',
  '+254721177642',
  'Example Bank Kenya',
  '1234567890',
  '123456',
  '/rent-a-car-in-kenya-logo-hd2-135x134.png',
  'Rent A Car In Kenya
Premium Vehicle Rentals
Email: info@rentacarinkenya.com
Nanyuki Branch - Tel: +254722513739
Nairobi Branch - Tel: +254721177642',
  'KES',
  'en-KE'
);