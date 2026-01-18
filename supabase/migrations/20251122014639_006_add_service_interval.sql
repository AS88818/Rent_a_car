/*
  # Add Service Interval Tracking

  1. Changes
    - Add `service_interval_km` column to vehicles table (default 5000 km)
    - Add `last_service_mileage` column to vehicles table
    - These fields will help track when service is due based on mileage
  
  2. Notes
    - Service due = last_service_mileage + service_interval_km - current_mileage
    - If service due < 1000 km, vehicle should show in "Service Due Soon" dashboard section
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'service_interval_km'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN service_interval_km numeric DEFAULT 5000;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'last_service_mileage'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN last_service_mileage numeric DEFAULT 0;
  END IF;
END $$;