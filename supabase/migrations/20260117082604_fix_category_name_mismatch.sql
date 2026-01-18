/*
  # Fix Category Name Mismatch Between Pricing and Vehicle Categories

  1. Problem
    - category_pricing table has categories like "Compact SUV_2DR"
    - vehicle_categories table has categories like "1. Compact SUV - 2 Door"
    - This mismatch causes availability checks to fail
    - Results in "Subject to Availability" and "?" showing for all categories

  2. Solution
    - Update category_pricing table to match vehicle_categories naming
    - Ensure consistency across the system
*/

-- Update category names in pricing to match vehicle categories
UPDATE category_pricing SET category_name = '1. Compact SUV - 2 Door' WHERE category_name = 'Compact SUV_2DR';
UPDATE category_pricing SET category_name = '2. Compact SUV - 4 Door' WHERE category_name = 'Compact SUV_4DR';
UPDATE category_pricing SET category_name = '3. Single Cab Pickup' WHERE category_name = 'Single Cab';
UPDATE category_pricing SET category_name = '4. Double Cab Pickup' WHERE category_name = 'Double Cab';
UPDATE category_pricing SET category_name = '5. Mid-Size SUV' WHERE category_name = 'Mid-Size SUV';
UPDATE category_pricing SET category_name = '6. Full-Size SUV' WHERE category_name = 'Full-Size SUV';
UPDATE category_pricing SET category_name = '7. Luxury SUV' WHERE category_name = 'Luxury SUV';
UPDATE category_pricing SET category_name = '8. MPV' WHERE category_name = 'MPV';
UPDATE category_pricing SET category_name = '9. Station Wagon' WHERE category_name = 'Station Wagon';

-- Add any missing categories that exist in vehicle_categories but not in pricing
DO $$
BEGIN
  -- Check if SUV category exists in pricing
  IF NOT EXISTS (SELECT 1 FROM category_pricing WHERE category_name = 'SUV') THEN
    INSERT INTO category_pricing (category_name, off_peak_rate, peak_rate, self_drive_deposit)
    VALUES ('SUV', 5000, 6000, 50000);
  END IF;

  -- Check if Car category exists in pricing
  IF NOT EXISTS (SELECT 1 FROM category_pricing WHERE category_name = 'Car') THEN
    INSERT INTO category_pricing (category_name, off_peak_rate, peak_rate, self_drive_deposit)
    VALUES ('Car', 3000, 4000, 30000);
  END IF;
END $$;
