/*
  # Add Extended Vehicle Details

  1. Changes to vehicles table
    - Add `next_service_mileage` (integer) - Next scheduled service mileage in km
    - Add `make` (text) - Vehicle manufacturer
    - Add `model` (text) - Vehicle model
    - Add `colour` (text) - Vehicle color
    - Add `fuel_type` (text) - Fuel type (Petrol, Diesel, Electric, Hybrid)
    - Add `transmission` (text) - Transmission type (Manual, Auto)
    - Add `spare_key` (boolean) - Whether spare key is available
    - Add `owner_name` (text) - Name of the vehicle owner

  2. Notes
    - All new fields are optional to maintain compatibility with existing records
    - Fuel type supports multiple options for modern vehicles
    - Next service calculation will be: next_service_mileage - current_mileage
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'next_service_mileage'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN next_service_mileage integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'make'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN make text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'model'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN model text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'colour'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN colour text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'fuel_type'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN fuel_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'transmission'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN transmission text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'spare_key'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN spare_key boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'owner_name'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN owner_name text;
  END IF;
END $$;