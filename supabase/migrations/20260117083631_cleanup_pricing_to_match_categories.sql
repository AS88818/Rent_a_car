/*
  # Clean Up Pricing Table to Match Actual Vehicle Categories

  1. Problem
    - Pricing table has 11 categories
    - Vehicle categories table only has 5 categories
    - This causes "Subject to Availability" and "?" for non-existent categories
    
  2. Solution
    - Delete pricing entries for categories that don't exist
    - Keep only: 1. Compact SUV - 2 Door, 2. Compact SUV - 4 Door, 3. Single Cab Pickup, Car, SUV
*/

-- Delete pricing entries for categories that don't exist in vehicle_categories
DELETE FROM category_pricing 
WHERE category_name NOT IN (
  '1. Compact SUV - 2 Door',
  '2. Compact SUV - 4 Door',
  '3. Single Cab Pickup',
  'Car',
  'SUV'
);
